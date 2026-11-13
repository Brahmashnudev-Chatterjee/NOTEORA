import {atomic} from './services/transaction.js'
import {financialSummary} from './services/financialReports.js'
import {decimal,toMinor} from './services/money.js'
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { User,Material,Category,Cart,Order,PaymentWebhookEvent,Review,SellerLedger,SubscriptionPlan,Subscription,Notification,AdminAudit,SupportTicket,UserSession,ActivityLog,Refund,Promotion } from './models.js'
import { auth,allow,type AuthRequest } from './auth.js'
import { authRoutes, passwordSchema, publicUser } from './authRoutes.js'
import { marketplaceRoutes } from './marketplaceRoutes.js'
import { sellerRoutes, reportingBoundaries } from './sellerRoutes.js'

import {financialRoutes} from './financialRoutes.js'
import {presentAccount} from './services/subscriptionService.js'
export const routes=Router()

routes.use(authRoutes)
routes.use(financialRoutes)
routes.use(marketplaceRoutes)
routes.use(sellerRoutes)


routes.get('/categories',async(_req,res)=>res.json(await Category.find().sort({name:1})))
routes.post('/categories',auth,allow('ADMIN','SUPER_ADMIN','MODERATOR'),async(req,res)=>{const name=req.body.name;const slug=name.toLowerCase().replace(/[^a-z0-9]+/g,'-');res.status(201).json(await Category.create({name,slug}))})





routes.get('/notifications',auth,async(req:AuthRequest,res)=>res.json(await Notification.find({user:req.user!.id}).sort({createdAt:-1}).lean()))

routes.get('/admin/dashboard',auth,allow('ADMIN','SUPER_ADMIN','MODERATOR'),async(_req,res)=>{
  const bounds=reportingBoundaries(),owners=await Material.distinct('seller')
  const [users,activeSellers,materials,pending,approved,finance,months]=await Promise.all([User.countDocuments(),User.countDocuments({_id:{$in:owners},active:true,suspended:{$ne:true}}),Material.countDocuments(),Material.countDocuments({status:'PENDING'}),Material.countDocuments({status:'APPROVED'}),financialSummary(),Order.aggregate([{$match:{financialVersion:2,accountedAt:{$exists:true}}},{$set:{effectiveDate:{$ifNull:['$paidAt','$createdAt']}}},{$match:{effectiveDate:{$gte:bounds.seriesFrom,$lt:bounds.monthly.to}}},{$group:{_id:{$dateToString:{date:'$effectiveDate',format:'%Y-%m',timezone:'Asia/Kolkata'}},sales:{$sum:1},revenueMinor:{$sum:'$financial.totalMinor'}}},{$sort:{_id:1}}])])
  res.json({users,activeSellers,materials,pending,approved,totalSales:finance.orderCount,grossTransactionValue:Number(decimal(finance.netCustomerMinor)),financial:finance,months:months.map(x=>({month:x._id,sales:x.sales,revenue:Number(decimal(x.revenueMinor))}))})
})
routes.get('/admin/users',auth,allow('ADMIN','SUPER_ADMIN'),async(_req,res)=>res.json(await Promise.all((await User.find().sort({createdAt:-1}).limit(500)).map(presentAccount))))
routes.patch('/admin/users/:id',auth,allow('ADMIN','SUPER_ADMIN'),async(req:AuthRequest,res)=>{
  const target=await User.findById(req.params.id)
  if(!target)return res.status(404).json({message:'User not found'})
  if(req.body.plan!==undefined)return res.status(400).json({message:'Use verified subscription billing to change entitlements'})
  if(req.body.verified!==undefined)return res.status(400).json({message:'Email verification requires a valid verification token'})
  if(req.user!.role!=='SUPER_ADMIN'&&(target.role!=='USER'||(req.body.role&&req.body.role!=='USER')))return res.status(403).json({message:'Only super administrators may manage privileged accounts'})
  if(String(target._id)===req.user!.id&&req.body.role&&req.body.role!==target.role)return res.status(403).json({message:'Cannot change your own role'})
  const updates:any={}
  for(const key of ['name','role','active','suspended'])if(req.body[key]!==undefined)updates[key]=req.body[key]
  for(const key of ['active','suspended'])if(updates[key]!==undefined){if(![true,false,'true','false'].includes(updates[key]))return res.status(400).json({message:'Invalid account status'});updates[key]=updates[key]===true||updates[key]==='true'}
  if(updates.name!==undefined&&(typeof updates.name!=='string'||!updates.name.trim()||updates.name.length>120))return res.status(400).json({message:'Invalid name'})
  if(updates.role&&!['USER','MODERATOR','ADMIN','SUPER_ADMIN'].includes(updates.role))return res.status(400).json({message:'Invalid role'})
  if(updates.plan&&!['FREE','PRO','ULTRA'].includes(updates.plan))return res.status(400).json({message:'Invalid plan'})
  const changedSecurity=['role','active','suspended'].some(key=>updates[key]!==undefined)
  const u=await User.findByIdAndUpdate(target._id,{$set:updates,...(changedSecurity?{$inc:{securityVersion:1}}:{})},{new:true,runValidators:true})
  await AdminAudit.create({actor:req.user!.id,action:'UPDATE_USER',entity:'User',entityId:String(target._id),details:updates,ip:req.ip})
  res.json({user:publicUser(u)})
})
routes.get('/admin/orders',auth,allow('ADMIN','SUPER_ADMIN'),async(_req,res)=>res.json(await Order.find().populate('user','name email').sort({createdAt:-1})))
routes.get('/admin/audit',auth,allow('ADMIN','SUPER_ADMIN'),async(_req,res)=>res.json(await AdminAudit.find().populate('actor','name email').sort({createdAt:-1})))
routes.post('/admin/users',auth,allow('ADMIN','SUPER_ADMIN'),async(req:AuthRequest,res)=>{
  const {name,email,password,role='USER'}=req.body;const plan='FREE'
  if(req.body.plan&&req.body.plan!=='FREE')return res.status(400).json({message:'Paid plans require verified billing'})
  if(typeof name!=='string'||!name.trim()||name.length>120||typeof email!=='string'||!/^\S+@\S+\.\S+$/.test(email)||!passwordSchema.safeParse(password).success)return res.status(400).json({message:'Valid name, email and password required'})
  if(req.body.verified===true||req.body.verified==='true')return res.status(400).json({message:'Email verification requires a valid verification token'})
  if(!['USER','MODERATOR','ADMIN','SUPER_ADMIN'].includes(role)||!['FREE','PRO','ULTRA'].includes(plan))return res.status(400).json({message:'Invalid role or plan'})
  if(role!=='USER'&&req.user!.role!=='SUPER_ADMIN')return res.status(403).json({message:'Only super administrators may create privileged accounts'})
  if(await User.exists({email:email.trim().toLowerCase()}))return res.status(409).json({message:'An account with this email already exists'})
  const user=await User.create({name:name.trim(),email:email.trim().toLowerCase(),password:await bcrypt.hash(password,12),role,plan,verified:false})
  await AdminAudit.create({actor:req.user!.id,action:'CREATE_USER',entity:'User',entityId:String(user._id),details:{role,plan},ip:req.ip})
  res.status(201).json(publicUser(user))
})
routes.delete('/admin/users/:id',auth,allow('SUPER_ADMIN'),async(req,res)=>{const user=await User.findByIdAndDelete(req.params.id);if(!user)return res.status(404).json({message:'User not found'});await AdminAudit.create({actor:(req as AuthRequest).user?.id,action:'DELETE_USER',entity:'User',entityId:req.params.id,ip:req.ip});res.json({deleted:true})})
routes.get('/admin/categories',auth,allow('ADMIN','SUPER_ADMIN','MODERATOR'),async(_req,res)=>res.json(await Category.find().sort({name:1})))
routes.post('/admin/categories',auth,allow('ADMIN','SUPER_ADMIN'),async(req,res)=>{const name=String(req.body.name||'').trim();if(!name)return res.status(400).json({message:'Category name is required'});const slug=String(req.body.slug||name.toLowerCase().replace(/[^a-z0-9]+/g,'-'));try{const c=await Category.create({name,slug});await AdminAudit.create({actor:(req as AuthRequest).user?.id,action:'CREATE_CATEGORY',entity:'Category',entityId:String(c._id),details:{name},ip:req.ip});res.status(201).json(c)}catch(e:any){res.status(409).json({message:'Category or slug already exists'})}})
routes.patch('/admin/categories/:id',auth,allow('ADMIN','SUPER_ADMIN'),async(req,res)=>{const updates:any={};if(typeof req.body.name==='string')updates.name=req.body.name.trim();if(typeof req.body.slug==='string')updates.slug=req.body.slug.trim();const c=await Category.findByIdAndUpdate(req.params.id,updates,{new:true,runValidators:true});if(!c)return res.status(404).json({message:'Category not found'});res.json(c)})
routes.delete('/admin/categories/:id',auth,allow('ADMIN','SUPER_ADMIN'),async(req,res)=>{await Category.findByIdAndDelete(req.params.id);res.json({deleted:true})})
routes.get('/admin/refunds',auth,allow('ADMIN','SUPER_ADMIN'),async(_req,res)=>res.json(await Refund.find().populate('order','internalOrderId total paymentStatus').populate('requestedBy','name email').sort({createdAt:-1})))
routes.patch('/admin/refunds/:id',auth,allow('ADMIN','SUPER_ADMIN'),async(req:AuthRequest,res)=>{
  if(!['APPROVED','REJECTED'].includes(req.body.status))return res.status(400).json({message:'Only review approval/rejection is supported; provider evidence is required for completion'})
  const result=await atomic(async session=>{const row=await Refund.findById(req.params.id).session(session);if(!row)throw Object.assign(new Error('Refund not found'),{status:404});if(row.status!=='REQUESTED')throw Object.assign(new Error('Only requested refunds can be reviewed'),{status:409});row.status=req.body.status;await row.save({session});await AdminAudit.create([{actor:req.user!.id,action:'REFUND_REVIEW_'+req.body.status,entity:'Refund',entityId:String(row._id)}],{session});return row})
  res.json(result)
})

routes.delete('/admin/refunds/:id',auth,allow('SUPER_ADMIN'),(_req,res)=>res.status(405).json({message:'Financial review history cannot be deleted'}))
routes.get('/admin/activity',auth,allow('ADMIN','SUPER_ADMIN','MODERATOR'),async(req,res)=>{const limit=Math.min(500,Math.max(1,Number(req.query.limit||100)));res.json(await ActivityLog.find().populate('user','name email role').sort({createdAt:-1}).limit(limit))})
routes.get('/admin/sessions',auth,allow('ADMIN','SUPER_ADMIN'),async(req,res)=>res.json(await UserSession.find().populate('user','name email role').sort({loginAt:-1}).limit(200)))
routes.post('/admin/refunds',auth,allow('ADMIN','SUPER_ADMIN'),async(req:AuthRequest,res)=>{
  const {orderId,amount,reason}=req.body;let minor:number
  try{minor=toMinor(amount)}catch{return res.status(400).json({message:'Refund amount must have at most two decimal places'})}
  const order=await Order.findById(orderId)
  if(!order?.accountedAt||!order.financial||!['PAID','PARTIALLY_REFUNDED'].includes(order.paymentStatus))return res.status(409).json({message:'A versioned, accounted payment is required for refund review'})
  if(minor<=0||minor>order.financial.totalMinor-(order.refundedMinor||0)||typeof reason!=='string'||!reason.trim()||reason.length>1000)return res.status(400).json({message:'Valid remaining refund amount and reason are required'})
  await atomic(async session=>{const [record]=await Refund.create([{order:order._id,requestedBy:req.user!.id,amount:Number(decimal(minor)),amountMinor:minor,reason,status:'REQUESTED'}],{session});await AdminAudit.create([{actor:req.user!.id,action:'REFUND_REVIEW_REQUESTED',entity:'Refund',entityId:String(record._id),details:{amountMinor:minor,reason}}],{session})})
  res.status(501).json({message:'Request recorded for review. Provider refund execution is unavailable; no refund or adjustment was made.',localStatus:'REQUESTED',providerRefund:false})
})
