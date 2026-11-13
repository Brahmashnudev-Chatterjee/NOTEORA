import {Router,raw} from 'express'
import crypto from 'node:crypto'
import {z} from 'zod'
import {auth,allow,type AuthRequest} from './auth.js'
import {Cart,Material,Order,Promotion,Subscription,AdminAudit,User,SellerLedger,FinancialAdjustment} from './models.js'
import {catalog,entitlement,subscriptionHistory,cancelSubscription,changeCatalog,presentAccount,type Plan} from './services/subscriptionService.js'
import {financialRules,changeFinancialRules,acceptSignedPayment} from './services/accountingService.js'
import {calculateOrder,financialHash,validateRules,type LineInput,type FinancialRules} from './services/financialService.js'
import {toMinor,decimal,sum} from './services/money.js'
import {atomic} from './services/transaction.js'
import {financialReport,reconcileOrder} from './services/financialReports.js'
import {verifyGatewayWebhook} from './services/payment/webhookService.js'

export const financialRoutes=Router()
const planName=z.enum(['FREE','PRO','ULTRA'])
const planInput=z.object({name:planName,priceMinor:z.number().int().min(0).max(10000000),uploadLimit:z.number().int().min(0).max(1000000).nullable(),quotaBasis:z.enum(['LIFETIME','BILLING_PERIOD']),commissionBps:z.number().int().min(0).max(10000),featured:z.boolean(),analytics:z.boolean()})
const publicPlan=(p:Plan)=>({...p,price:Number(decimal(p.priceMinor)),activeListings:p.uploadLimit,commissionRate:Number(decimal(p.commissionBps))})
export async function customerOrder(o:any){
  const plain=o.toObject?o.toObject():o;const {financial,financialHash:hash,subscriptionTerms,...rest}=plain
  const refunds=plain.paymentStatus==='PARTIALLY_REFUNDED'?await FinancialAdjustment.find({order:plain._id}).lean():[]
  return {...rest,items:plain.items.map((item:any)=>{const line=financial?.lines.find((l:any)=>l.materialId===String(item.material));const remaining=line?line.customerPaymentMinor-sum(refunds.filter(r=>r.lineId===line.id).map(r=>r.customerRefundMinor||0)):0;return {...item,canDownload:plain.paymentStatus==='PAID'||(plain.paymentStatus==='PARTIALLY_REFUNDED'&&!!plain.accountedAt&&remaining>0)}}),amountMinor:financial?{subtotal:financial.subtotalMinor,discount:financial.discountMinor,tax:financial.taxMinor,total:financial.totalMinor}:null}
}
financialRoutes.get('/subscriptions/plans',async(_req,res)=>{const c=await catalog();res.json(c.plans.map(p=>({...publicPlan(p),version:c.version})))})
financialRoutes.get('/subscriptions/me',auth,async(req:AuthRequest,res)=>res.json(await subscriptionHistory(req.user!.id)))
financialRoutes.get('/users/me',auth,async(req:AuthRequest,res)=>res.json(await presentAccount(await User.findById(req.user!.id))))
financialRoutes.post('/seller/subscriptions',auth,async(req:AuthRequest,res)=>{
  if(req.body.plan!=='FREE')return res.status(402).json({message:'Paid subscription activation requires a verified payment. No entitlement was granted.'})
  res.json(await cancelSubscription(req.user!.id))
})
financialRoutes.post('/subscriptions/cancel',auth,async(req:AuthRequest,res)=>res.json(await cancelSubscription(req.user!.id)))
financialRoutes.get('/admin/subscriptions',auth,allow('ADMIN','SUPER_ADMIN'),async(_req,res)=>{const c=await catalog();res.json(c.plans.map(p=>({...publicPlan(p),version:c.version})))})
financialRoutes.get('/admin/subscription-catalog',auth,allow('ADMIN','SUPER_ADMIN'),async(_req,res)=>res.json(await catalog()))
financialRoutes.put('/admin/subscription-catalog',auth,allow('SUPER_ADMIN'),async(req:AuthRequest,res)=>{const p=z.object({expectedVersion:z.number().int(),plans:z.array(planInput).length(3),reason:z.string().trim().min(1).max(1000)}).parse(req.body);res.json(await changeCatalog(p.expectedVersion,p.plans,req.user!.id,p.reason))})
financialRoutes.get('/admin/subscription-members',auth,allow('ADMIN','SUPER_ADMIN'),async(_req,res)=>{const members=await Subscription.find().sort({createdAt:-1}).limit(500).populate('user','name email').lean();res.json(members.map(r=>({...r,status:r.expiresAt&&r.expiresAt<new Date()?'EXPIRED':r.status==='SCHEDULED'&&r.startsAt&&r.startsAt<=new Date()?'ACTIVE':r.status||'LEGACY_REVIEW_REQUIRED'})))})
financialRoutes.patch('/admin/subscription-members/:id',auth,allow('ADMIN','SUPER_ADMIN'),async(req:AuthRequest,res)=>{
  const p=z.object({action:z.enum(['SUSPEND','RESUME','CANCEL']),reason:z.string().trim().min(1).max(1000)}).parse(req.body)
  await atomic(async session=>{const row=await Subscription.findById(req.params.id).session(session);if(!row?.verifiedPaymentEvent||!row.paymentOrder)throw Object.assign(new Error('Verified paid subscription required'),{status:409});const owner=await User.findById(row.user).session(session);if(owner?.role!=='USER'&&req.user!.role!=='SUPER_ADMIN')throw Object.assign(new Error('Privileged account protection'),{status:403});if(p.action==='RESUME'&&(!row.expiresAt||row.expiresAt<=new Date()||row.status!=='SUSPENDED'))throw Object.assign(new Error('Cannot resume an expired or non-suspended subscription'),{status:409});row.status=p.action==='SUSPEND'?'SUSPENDED':p.action==='CANCEL'?'CANCELLED':'ACTIVE';await row.save({session});await AdminAudit.create([{actor:req.user!.id,action:'SUBSCRIPTION_'+p.action,entity:'Subscription',entityId:String(row._id),details:{reason:p.reason}}],{session})})
  res.json({updated:true})
})
for(const method of ['post','patch','delete'] as const)financialRoutes[method](['/admin/subscriptions','/admin/subscriptions/:id'],auth,allow('ADMIN','SUPER_ADMIN'),(_req,res)=>res.status(405).json({message:'Use the versioned plan catalog; direct entitlement/plan CRUD is disabled'}))
financialRoutes.get('/financial/policy',async(_req,res)=>res.json(await financialRules()))
financialRoutes.put('/admin/financial-policy',auth,allow('SUPER_ADMIN'),async(req:AuthRequest,res)=>{
  const p=z.object({expectedVersion:z.number().int(),tax:z.object({status:z.literal('APPROVED'),mode:z.enum(['NONE','EXCLUSIVE','INCLUSIVE']),rateBps:z.number().int().min(0).max(10000),approvalReference:z.string().trim().min(1).max(300)}),gatewayFee:z.object({status:z.literal('APPROVED'),rateBps:z.number().int().min(0).max(10000),fixedMinor:z.number().int().min(0).max(1000000),approvalReference:z.string().trim().min(1).max(300)}),reason:z.string().trim().min(1).max(1000)}).parse(req.body)
  validateRules({version:p.expectedVersion+1,tax:p.tax,gatewayFee:p.gatewayFee})
  res.json(await changeFinancialRules(p.expectedVersion,p,req.user!.id,p.reason))
})
async function quote(user:string,body:any){
  const cart=await Cart.findOne({user}).populate('items.material')
  if(!cart?.items.length)throw Object.assign(new Error('Cart is empty'),{status:400})
  const promos=z.array(z.string().trim().max(30)).max(20).parse(body.promotionCodes||[]),lines:LineInput[]=[]
  const found=await Promotion.find({code:{$in:promos.map(p=>p.toUpperCase())},active:true,$or:[{expiresAt:null},{expiresAt:{$gt:new Date()}}]}).lean()
  for(const row of cart.items){const m:any=row.material;if(!m||m.status!=='APPROVED')throw Object.assign(new Error('Cart contains unavailable material'),{status:409});if(!await User.exists({_id:m.seller,active:true,suspended:{$ne:true}}))throw Object.assign(new Error('Seller is unavailable'),{status:409});const context=await entitlement(String(m.seller));const applicable=found.filter(p=>String(p.seller)===String(m.seller)&&(!p.material||String(p.material)===String(m._id)));if(applicable.length>1)throw Object.assign(new Error('Only one promotion per material is permitted'),{status:400});lines.push({id:String(m._id),materialId:String(m._id),sellerId:String(m.seller),title:m.title,unitPriceMinor:(()=>{try{return toMinor(m.price)}catch{throw Object.assign(new Error('Material price requires accounting review'),{status:409})}})(),commissionBps:context.plan.commissionBps,planVersion:context.catalogVersion,discountBps:applicable.length?toMinor(String(applicable[0].discount)):0})}
  if(promos.some(p=>!found.some(f=>f.code===p.toUpperCase()&&lines.some(l=>l.sellerId===String(f.seller)&&(!f.material||l.materialId===String(f.material))))))throw Object.assign(new Error('Promotion is invalid, expired or not applicable to this cart'),{status:400})
  return {lines,subtotalMinor:sum(lines.map(l=>l.unitPriceMinor)),rules:await financialRules()}
}
financialRoutes.post('/orders/quote',auth,async(req:AuthRequest,res)=>{const q=await quote(req.user!.id,req.body);try{const snapshot=calculateOrder(q.lines,q.rules);res.json({ready:true,subtotalMinor:snapshot.subtotalMinor,discountMinor:snapshot.discountMinor,taxMinor:snapshot.taxMinor,totalMinor:snapshot.totalMinor,policyVersion:q.rules.version,taxMode:q.rules.tax.mode})}catch(e:any){if(e.status===422)return res.status(422).json({ready:false,subtotalMinor:q.subtotalMinor,totalMinor:null,message:e.message});throw e}})
async function createUnpaid(user:string,lines:LineInput[],rules:FinancialRules,purpose:'MATERIAL'|'SUBSCRIPTION',terms?:any){
  const calculated=calculateOrder(lines,rules,purpose),snapshot=terms?{...calculated,entitlementTerms:terms}:calculated,id='NOTE-'+crypto.randomBytes(12).toString('hex').toUpperCase()
  const order=await Order.create({internalOrderId:id,clientOrderId:id,user,purpose,environment:'sandbox',paymentStatus:'CREATED',items:purpose==='MATERIAL'?lines.map(l=>({material:l.materialId,title:l.title,unitPrice:Number(decimal(l.unitPriceMinor)),seller:l.sellerId})):[],subtotal:Number(decimal(snapshot.subtotalMinor)),gst:Number(decimal(snapshot.taxMinor)),discount:Number(decimal(snapshot.discountMinor)),total:Number(decimal(snapshot.totalMinor)),currency:'INR',financial:snapshot,financialHash:financialHash(snapshot),financialVersion:2,subscriptionTerms:terms})
  return {orderId:order._id,status:'CREATED',amountMinor:{subtotal:snapshot.subtotalMinor,discount:snapshot.discountMinor,tax:snapshot.taxMinor,total:snapshot.totalMinor},providerIntegrationAvailable:false,message:'Unpaid order recorded. No payment was collected; provider connection and authoritative verification are required.'}
}
financialRoutes.post('/orders',auth,async(req:AuthRequest,res)=>{const q=await quote(req.user!.id,req.body);res.status(201).json(await createUnpaid(req.user!.id,q.lines,q.rules,'MATERIAL'))})
financialRoutes.post('/subscriptions/orders',auth,async(req:AuthRequest,res)=>{const name=planName.parse(req.body.plan);if(name==='FREE')return res.status(400).json({message:'Free plan does not require a payment order'});const c=await catalog(),plan=c.plans.find(p=>p.name===name)!;res.status(201).json(await createUnpaid(req.user!.id,[{id:'subscription:'+name,sellerId:null,title:name+' subscription',unitPriceMinor:plan.priceMinor,commissionBps:10000,planVersion:c.version}],await financialRules(),'SUBSCRIPTION',{...plan,catalogVersion:c.version}))})
financialRoutes.get('/orders',auth,async(req:AuthRequest,res)=>res.json(await Promise.all((await Order.find({user:req.user!.id}).sort({createdAt:-1})).map(customerOrder))))
financialRoutes.get('/orders/:id/status',auth,async(req:AuthRequest,res)=>{const order=await Order.findOne({_id:req.params.id,user:req.user!.id});if(!order)return res.status(404).json({message:'Order not found'});res.json(await customerOrder(order))})
financialRoutes.patch('/admin/orders/:id',auth,allow('ADMIN','SUPER_ADMIN'),(_req,res)=>res.status(405).json({message:'Financial/payment status is read-only. Only verified provider evidence may confirm a payment.'}))
financialRoutes.patch('/admin/refunds/:id',auth,allow('ADMIN','SUPER_ADMIN'),async(req:AuthRequest,res,next)=>{if(req.body.status==='COMPLETED')return res.status(409).json({message:'Provider-confirmed refund evidence is required; manual completion is disabled'});next()})
financialRoutes.post('/payments/webhook',raw({type:'application/json'}),async(req,res)=>{
  const bytes=Buffer.isBuffer(req.body)?req.body:Buffer.from(JSON.stringify(req.body)),signature=String(req.headers['x-signature']||'')
  let payload:any;try{payload=JSON.parse(bytes.toString())}catch{return res.status(400).json({message:'Invalid event'})}
  const data=payload.data||payload,env=payload.environment||data.environment
  if(env!=='sandbox'||process.env.NODE_ENV==='production')return res.status(403).json({message:'Live/production payment processing is not enabled in Phase D'})
  if(!verifyGatewayWebhook(bytes,signature,env))return res.status(401).json({message:'Invalid webhook signature'})
  const parsed=z.object({eventId:z.string().min(1).max(200),event:z.string(),gatewayOrderId:z.string().min(1),currency:z.literal('INR'),sequence:z.number().int().positive()}).safeParse({eventId:payload.event_id||data.event_id,event:payload.event||data.event,gatewayOrderId:payload.order_id||data.order_id,currency:data.currency,sequence:payload.event_sequence||data.event_sequence})
  if(!parsed.success)return res.status(400).json({message:'Signed event ID, amount, currency, sequence and order reference are required'})
  let amountMinor:number;try{amountMinor=toMinor(data.amount)}catch{return res.status(400).json({message:'Invalid signed amount'})}
  res.json(await acceptSignedPayment({...parsed.data,amountMinor,environment:env,payloadHash:crypto.createHash('sha256').update(bytes).digest('hex')}))
})
financialRoutes.get('/seller/analytics/export',auth,async(req:AuthRequest,res)=>{
  const context=await entitlement(req.user!.id)
  if(!context.plan.analytics)return res.status(403).json({message:'Your effective plan does not include advanced analytics export'})
  const report=await financialReport(req.user!.id),rows=[['period','currency','gross','discount','tax','commission','refunds','netEarnings','orderCount','excludedLegacyOrders','excludedLegacyLedgers']]
  for(const key of ['daily','monthly','annual']){const p=report.periods[key];rows.push([key,'INR',decimal(p.grossMinor),decimal(p.discountMinor),decimal(p.taxMinor),decimal(p.netCommissionMinor),decimal(p.refundMinor),decimal(p.netSellerEarningsMinor),String(p.orderCount),String(p.legacyUnaccountedOrders),String(p.legacyUnaccountedLedgers)])}
  res.type('text/csv').setHeader('Content-Disposition','attachment; filename="seller-financial-report.csv"');res.send(rows.map(r=>r.join(',')).join('\n'))
})
financialRoutes.get('/admin/subscription-summary',auth,allow('ADMIN','SUPER_ADMIN'),async(_req,res)=>{
  const users=await User.find().select('_id'),contexts=await Promise.all(users.map(u=>entitlement(String(u._id))))
  const plans:Record<string,number>={},statuses:Record<string,number>={}
  for(const c of contexts){plans[c.plan.name]=(plans[c.plan.name]||0)+1;statuses[c.status]=(statuses[c.status]||0)+1}
  res.json({plans,statuses,users:users.length})
})
financialRoutes.get('/seller/financial-report',auth,async(req:AuthRequest,res)=>res.json(await financialReport(req.user!.id)))
financialRoutes.get('/seller/settlements',auth,async(req:AuthRequest,res)=>res.json(await SellerLedger.find({seller:req.user!.id}).sort({createdAt:-1}).lean()))
financialRoutes.get('/admin/reports',auth,allow('ADMIN','SUPER_ADMIN'),async(_req,res)=>res.json(await financialReport()))
financialRoutes.get('/admin/orders/:id/reconciliation',auth,allow('ADMIN','SUPER_ADMIN'),async(req,res)=>res.json(await reconcileOrder(String(req.params.id))))
