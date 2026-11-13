import {afterAll,beforeAll,beforeEach,describe,it,expect} from 'vitest'
import {MongoMemoryReplSet} from 'mongodb-memory-server'
import mongoose from 'mongoose'
import request from 'supertest'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {app} from './index.js'
import {User,Order,Cart,Material,Subscription,FinancialPolicy,SellerLedger,FinancialAdjustment,PaymentWebhookEvent,PlanPolicy,UploadQuota,Refund,AdminAudit} from './models.js'
import {testActor,testPdf} from './testFixtures.js'
import {decimal} from './services/money.js'
import {entitlement,addBillingMonth} from './services/subscriptionService.js'
import {applyConfirmedRefund} from './services/accountingService.js'
import {reconcileOrder,financialReport} from './services/financialReports.js'
import {reportingBoundaries} from './services/reportingPeriods.js'

let db:MongoMemoryReplSet,dir:string,buyer:any,seller:any,other:any,admin:any,root:any
const api=(method:'get'|'post'|'put'|'patch',url:string,actor=buyer)=>request(app)[method]('/api/v1'+url).auth(actor.token,{type:'bearer'})
const policy={version:2,tax:{status:'APPROVED',mode:'NONE',rateBps:0,approvalReference:'TEST-ONLY explicit no-tax fixture'},gatewayFee:{status:'APPROVED',rateBps:100,fixedMinor:1,approvalReference:'TEST-ONLY fee policy'}}
async function note(owner=seller,price=100){return Material.create({seller:owner.user._id,title:'Test note '+crypto.randomUUID(),price,status:'APPROVED'})}
async function newOrder(notes:any[],actor=buyer,extra:any={}){await Cart.findOneAndUpdate({user:actor.user._id},{items:notes.map(m=>({material:m._id,quantity:1}))},{upsert:true});return api('post','/orders',actor).send(extra)}
async function paid(orderId:string,overrides:any={},eventId=crypto.randomUUID()){
  const order=await Order.findById(orderId);const gatewayOrderId='fixture-'+order!.internalOrderId
  await Order.updateOne({_id:orderId},{$set:{gatewayOrderId}})
  const body={event_id:eventId,event:'order.paid',event_sequence:1,environment:'sandbox',data:{order_id:gatewayOrderId,amount:decimal(order!.financial.totalMinor),currency:'INR'},...overrides}
  const raw=JSON.stringify(body),stamp=Math.floor(Date.now()/1000),signature=crypto.createHmac('sha256','phase-d-test-secret').update(`${stamp}.${raw}`).digest('hex')
  const response=await request(app).post('/api/v1/payments/webhook').set('Content-Type','application/json').set('X-Signature',`t=${stamp},v1=${signature}`).send(raw)
  return {response,body,raw,signature:`t=${stamp},v1=${signature}`}
}
async function buyPlan(actor:any,name='PRO'){const order=await api('post','/subscriptions/orders',actor).send({plan:name});expect(order.status).toBe(201);expect((await paid(String(order.body.orderId))).response.status).toBe(200);return Subscription.findOne({user:actor.user._id,paymentOrder:order.body.orderId})}
async function upload(actor=seller){return api('post','/materials',actor).field('title','Quota note').field('price','10').field('status','DRAFT').attach('pdf',testPdf(),{filename:'notes.pdf',contentType:'application/pdf'})}
beforeAll(async()=>{db=await MongoMemoryReplSet.create({replSet:{count:1}});await mongoose.connect(db.getUri());await Promise.all(Object.values(mongoose.models).map(m=>m.init()));dir=await fs.mkdtemp(path.join(os.tmpdir(),'noteora-phase-d-'));process.env.PRIVATE_UPLOAD_DIR=dir;process.env.UPI_GATEWAY_ENV='sandbox';process.env.UPI_GATEWAY_SANDBOX_WEBHOOK_SECRET='phase-d-test-secret'},120000)
beforeEach(async()=>{await Promise.all(Object.values(mongoose.models).map(m=>m.deleteMany({})));for(const name of await fs.readdir(dir))await fs.rm(path.join(dir,name),{force:true});[buyer,seller,other,admin,root]=await Promise.all([testActor(),testActor(),testActor(),testActor('ADMIN'),testActor('SUPER_ADMIN')]);await FinancialPolicy.create(policy)})
afterAll(async()=>{await mongoose.disconnect();await db?.stop();if(dir){for(const name of await fs.readdir(dir))await fs.rm(path.join(dir,name),{force:true});await fs.rmdir(dir)}})
describe('Phase D authoritative subscriptions and integer accounting',()=>{
  it('publishes one catalog with reconciled Free/Pro/Ultra terms and rejects entitlement overrides',async()=>{
    const plans=await api('get','/subscriptions/plans');expect(plans.body.map((p:any)=>[p.name,p.priceMinor,p.uploadLimit,p.commissionBps])).toEqual([['FREE',0,5,3000],['PRO',19900,15,2000],['ULTRA',49900,null,1000]])
    expect((await api('post','/seller/subscriptions').send({plan:'PRO',paid:true})).status).toBe(402)
    expect((await api('patch','/admin/users/'+seller.user._id,admin).send({plan:'ULTRA'})).status).toBe(400)
    expect((await entitlement(String(seller.user._id))).plan.name).toBe('FREE')
  })
  it('creates an unpaid subscription order without activating any entitlement',async()=>{
    const r=await api('post','/subscriptions/orders',seller).send({plan:'PRO',paymentStatus:'PAID'})
    expect(r.status).toBe(201);expect(r.body.providerIntegrationAvailable).toBe(false);expect((await entitlement(String(seller.user._id))).plan.name).toBe('FREE')
    expect((await Order.findById(r.body.orderId))!.paymentStatus).toBe('CREATED');expect(await Subscription.countDocuments()).toBe(0)
  })
  it.each(['PRO','ULTRA'])('activates %s only after signed amount/currency/environment verification',async name=>{
    const sub=await buyPlan(seller,name);expect(sub!.verifiedPaymentEvent).toBeTruthy();const context=await entitlement(String(seller.user._id));expect(context.plan.name).toBe(name)
    const me=await api('get','/users/me',seller);expect(me.body.plan).toBe(name);expect(me.body.subscriptionStatus).toBe('ACTIVE')
    expect(await SellerLedger.countDocuments()).toBe(0) // Subscription revenue is not seller material earnings.
  })
  it('keeps cancellation benefits to expiry, enforces expiry/suspension and exposes renewal eligibility',async()=>{
    const sub=await buyPlan(seller);await Subscription.updateOne({_id:sub!._id},{expiresAt:new Date(Date.now()+86400000)})
    expect((await entitlement(String(seller.user._id))).renewalEligible).toBe(true)
    expect((await api('post','/subscriptions/cancel',seller)).status).toBe(200)
    const cancelled=await entitlement(String(seller.user._id));expect(cancelled.status).toBe('CANCELLED');expect(cancelled.plan.name).toBe('PRO');expect(cancelled.renewalEligible).toBe(false)
    expect((await api('patch','/admin/subscription-members/'+sub!._id,admin).send({action:'SUSPEND',reason:'Test suspension'})).status).toBe(200)
    expect((await entitlement(String(seller.user._id))).plan.name).toBe('FREE')
    expect((await api('patch','/admin/subscription-members/'+sub!._id,admin).send({action:'RESUME',reason:'Test resolution'})).status).toBe(200)
    await Subscription.updateOne({_id:sub!._id},{expiresAt:new Date(0)})
    expect((await entitlement(String(seller.user._id))).status).toBe('EXPIRED');expect((await entitlement(String(seller.user._id))).plan.name).toBe('FREE')
  })
  it('schedules paid renewal/plan changes after the existing term without granting an overlapping upgrade',async()=>{
    const first=await buyPlan(seller,'PRO'),next=await buyPlan(seller,'ULTRA')
    expect(next!.startsAt.toISOString()).toBe(first!.expiresAt.toISOString());expect(next!.status).toBe('SCHEDULED');const third=await buyPlan(seller,'PRO');expect(third!.startsAt.toISOString()).toBe(next!.expiresAt.toISOString());expect((await entitlement(String(seller.user._id))).plan.name).toBe('PRO')
    expect((await entitlement(String(seller.user._id),new Date(next!.startsAt.getTime()+1000))).plan.name).toBe('ULTRA')
    expect(addBillingMonth(new Date('2026-01-31T12:00:00Z')).toISOString()).toBe('2026-02-28T12:00:00.000Z')
  })
  it('does not trust legacy User.plan or unverified subscription booleans',async()=>{
    await User.updateOne({_id:seller.user._id},{plan:'ULTRA'});await Subscription.create({user:seller.user._id,plan:'ULTRA',active:true,expiresAt:new Date(Date.now()+86400000)})
    const context=await entitlement(String(seller.user._id));expect(context.plan.name).toBe('FREE');expect(context.legacyReviewRequired).toBe(true)
  })
  it('does not trust fabricated payment references, and removes benefits after a confirmed subscription refund',async()=>{
    await Subscription.create({user:seller.user._id,plan:'ULTRA',status:'ACTIVE',terms:{name:'ULTRA',uploadLimit:null},paymentOrder:new mongoose.Types.ObjectId(),verifiedPaymentEvent:'fabricated',startsAt:new Date(0),expiresAt:new Date(Date.now()+86400000)})
    expect((await entitlement(String(seller.user._id))).plan.name).toBe('FREE')
    const sub=await buyPlan(other,'PRO'),order=await Order.findById(sub!.paymentOrder)
    await applyConfirmedRefund({orderId:String(order!._id),reference:'TEST-SUBSCRIPTION-REFUND',reason:'Test-only confirmed refund',providerConfirmed:true,lines:[{lineId:order!.financial.lines[0].id,customerRefundMinor:order!.financial.totalMinor}]})
    expect((await entitlement(String(other.user._id))).plan.name).toBe('FREE')
  })
  it('serializes the final Free upload slot and retains lifetime usage after deletion',async()=>{
    await Material.insertMany(Array.from({length:4},(_,i)=>({seller:seller.user._id,title:'Existing '+i,price:10,status:'DRAFT'})))
    const results=await Promise.all([upload(),upload()]);expect(results.map(r=>r.status).sort()).toEqual([201,403])
    const created=results.find(r=>r.status===201)!
    expect((await request(app).delete('/api/v1/materials/'+created.body._id).auth(seller.token,{type:'bearer'})).status).toBe(200)
    expect((await upload()).status).toBe(403);expect((await UploadQuota.findOne({user:seller.user._id,periodKey:'LIFETIME'}))!.used).toBe(5)
  })
  it('enforces 15 uploads per Pro period and unlimited Ultra uploads without counting only approvals',async()=>{
    await buyPlan(seller,'PRO');await Material.insertMany(Array.from({length:15},(_,i)=>({seller:seller.user._id,title:'Draft '+i,price:10,status:'DRAFT'})))
    expect((await upload()).status).toBe(403)
    await buyPlan(other,'ULTRA');await Material.insertMany(Array.from({length:101},(_,i)=>({seller:other.user._id,title:'Ultra '+i,price:10,status:'DRAFT'})))
    expect((await upload(other)).status).toBe(201)
  })
  it('resets Pro quota for a newly verified billing period, while expiry falls back to lifetime Free limits',async()=>{
    const first=await buyPlan(seller,'PRO')
    await Subscription.updateOne({_id:first!._id},{startsAt:new Date(Date.now()-2*86400000)})
    await Material.insertMany(Array.from({length:15},(_,i)=>({seller:seller.user._id,title:'Old period '+i,price:10,status:'DRAFT',createdAt:new Date(Date.now()-86400000)})))
    expect((await upload()).status).toBe(403)
    await Subscription.updateOne({_id:first!._id},{expiresAt:new Date(0)})
    expect((await upload()).status).toBe(403)
    await buyPlan(seller,'PRO');expect((await upload()).status).toBe(201)
  })
  it('versions admin plan changes without rewriting existing paid terms and prevents seller/admin rate escalation',async()=>{
    await buyPlan(seller,'PRO');const c=(await api('get','/admin/subscription-catalog',root)).body;c.plans.find((p:any)=>p.name==='PRO').commissionBps=1500
    expect((await api('put','/admin/subscription-catalog',seller).send({...c,expectedVersion:1,reason:'Unauthorized'})).status).toBe(403)
    expect((await api('put','/admin/subscription-catalog',admin).send({...c,expectedVersion:1,reason:'Unauthorized'})).status).toBe(403)
    expect((await api('put','/admin/subscription-catalog',root).send({...c,expectedVersion:1,reason:'Test approved new price policy'})).status).toBe(200)
    expect((await entitlement(String(seller.user._id))).plan.commissionBps).toBe(2000)
    expect((await api('put','/admin/subscription-catalog',root).send({...c,expectedVersion:1,reason:'Stale update'})).status).toBe(409)
  })
  it('enforces featured listing and advanced export entitlements on the backend',async()=>{
    const material=await note(seller)
    expect((await api('get','/materials/featured')).body.items).toHaveLength(0)
    expect((await api('get','/seller/analytics/export',seller)).status).toBe(403)
    const sub=await buyPlan(seller,'PRO')
    expect((await api('get','/materials/featured')).body.items[0]._id).toBe(String(material._id))
    const csv=await api('get','/seller/analytics/export',seller);expect(csv.status).toBe(200);expect(csv.text).toContain('netEarnings')
    await Subscription.updateOne({_id:sub!._id},{expiresAt:new Date(0)})
    expect((await api('get','/materials/featured')).body.items).toHaveLength(0)
    expect((await api('get','/seller/analytics/export',seller)).status).toBe(403)
  })
  it('blocks unresolved tax/fee policies rather than assuming zero and validates explicit config authorization',async()=>{
    await FinancialPolicy.deleteMany({});const m=await note();const r=await newOrder([m]);expect(r.status).toBe(422);expect(await Order.countDocuments()).toBe(0)
    const q=await api('post','/orders/quote').send({});expect(q.status).toBe(422);expect(q.body.totalMinor).toBeNull();expect(q.body.subtotalMinor).toBe(10000)
    expect((await api('put','/admin/financial-policy',admin).send({})).status).toBe(403)
  })
  it('posts every item for each seller exactly once and reconciles the order, ledgers and platform',async()=>{
    await buyPlan(other,'PRO');const a=await note(seller,100),b=await note(seller,50),c=await note(other,100)
    const r=await newOrder([a,b,c]);expect(r.status).toBe(201);const event=await paid(r.body.orderId);expect(event.response.status).toBe(200)
    const rows=await SellerLedger.find({order:r.body.orderId}).lean();expect(rows).toHaveLength(2)
    expect(rows.find(x=>String(x.seller)===String(seller.user._id))!.customerPaymentMinor).toBe(15000)
    expect(rows.find(x=>String(x.seller)===String(seller.user._id))!.commissionMinor).toBe(4500)
    expect(rows.find(x=>String(x.seller)===String(other.user._id))!.commissionMinor).toBe(2000)
    const retry=await request(app).post('/api/v1/payments/webhook').set('Content-Type','application/json').set('X-Signature',event.signature).send(event.raw)
    expect(retry.body.duplicate).toBe(true);expect(await SellerLedger.countDocuments({order:r.body.orderId})).toBe(2)
    expect((await reconcileOrder(r.body.orderId)).balanced).toBe(true)
  })
  it('serializes concurrent signed payment retries without duplicate ledgers or status regressions',async()=>{
    const r=await newOrder([await note(),await note()]),order=await Order.findById(r.body.orderId),id='concurrent-'+order!.internalOrderId
    await Order.updateOne({_id:order!._id},{gatewayOrderId:id})
    const body={event_id:crypto.randomUUID(),event:'order.paid',event_sequence:1,environment:'sandbox',data:{order_id:id,amount:decimal(order!.financial.totalMinor),currency:'INR'}}
    const raw=JSON.stringify(body),stamp=Math.floor(Date.now()/1000),sig='t='+stamp+',v1='+crypto.createHmac('sha256','phase-d-test-secret').update(`${stamp}.${raw}`).digest('hex')
    const responses=await Promise.all(Array.from({length:3},()=>request(app).post('/api/v1/payments/webhook').set('Content-Type','application/json').set('X-Signature',sig).send(raw)))
    expect(responses.every(x=>x.status===200)).toBe(true);expect(await SellerLedger.countDocuments({order:order!._id})).toBe(1)
    expect((await paid(r.body.orderId,{event:'order.failed',event_sequence:2})).response.body.ignored).toBe('final-state')
    expect((await Order.findById(r.body.orderId))!.paymentStatus).toBe('PAID')
  })
  it('applies seller-scoped promotion discounts and rejects client commission/amount overrides',async()=>{
    const a=await note(seller,100),b=await note(other,50)
    await api('post','/seller/promotions',seller).send({code:'STUDY10',discount:10,material:String(a._id)})
    const r=await newOrder([a,b],buyer,{promotionCodes:['STUDY10'],total:1,commissionBps:0});const order=await Order.findById(r.body.orderId)
    expect(order!.financial.discountMinor).toBe(1000);expect(order!.financial.totalMinor).toBe(14000);expect(order!.financial.commissionMinor).toBe(4200)
  })
  it('rejects signed mismatched amounts/currencies/environments and never permits manual PAID status',async()=>{
    const r=await newOrder([await note()]);const order=await Order.findById(r.body.orderId);const id='fixture-'+order!.internalOrderId
    expect((await paid(r.body.orderId,{data:{order_id:id,amount:'1.00',currency:'INR'}})).response.status).toBe(409)
    expect((await paid(r.body.orderId,{environment:'live'})).response.status).toBe(403)
    expect((await paid(r.body.orderId,{data:{order_id:id,amount:'100.00',currency:'USD'}})).response.status).toBe(400)
    expect((await api('patch','/admin/orders/'+r.body.orderId,root).send({paymentStatus:'PAID'})).status).toBe(405)
    expect((await Order.findById(r.body.orderId))!.paymentStatus).toBe('CREATED');expect(await SellerLedger.countDocuments()).toBe(0)
  })
  it('rolls back conflicting legacy ledger posting together with payment and event insertion',async()=>{
    const r=await newOrder([await note()]);await SellerLedger.create({order:r.body.orderId,seller:seller.user._id,originalPrice:1})
    const event=await paid(r.body.orderId);expect(event.response.status).toBe(409)
    expect((await Order.findById(r.body.orderId))!.paymentStatus).toBe('CREATED');expect(await PaymentWebhookEvent.countDocuments({eventId:event.body.event_id})).toBe(0)
  })
  it('keeps refund adjustments traceable, bounded, idempotent and reconciled without initiating transfers',async()=>{
    const r=await newOrder([await note()]);expect((await paid(r.body.orderId)).response.status).toBe(200)
    const order=await Order.findById(r.body.orderId),line=order!.financial.lines[0]
    const input={orderId:r.body.orderId,reference:'TEST-REFUND-1',reason:'Test-only authoritative fixture',providerConfirmed:true,lines:[{lineId:line.id,customerRefundMinor:3333}]}
    await applyConfirmedRefund(input);expect((await applyConfirmedRefund(input)).duplicate).toBe(true)
    await expect(applyConfirmedRefund({...input,reference:'TOO-MUCH',lines:[{lineId:line.id,customerRefundMinor:9000}]})).rejects.toThrow()
    await applyConfirmedRefund({...input,reference:'TEST-REFUND-2',lines:[{lineId:line.id,customerRefundMinor:6667}]})
    expect((await Order.findById(r.body.orderId))!.refundedMinor).toBe(10000);expect(await FinancialAdjustment.countDocuments()).toBe(2)
    const report=await financialReport(String(seller.user._id));expect(report.totals.netSellerEarningsMinor).toBe(0);expect(report.totals.refundMinor).toBe(10000)
    expect((await reconcileOrder(r.body.orderId)).balanced).toBe(true)
    await expect(applyConfirmedRefund({...input,providerConfirmed:false})).rejects.toThrow('Authoritative')
  })
  it('prevents concurrent refunds from exceeding the remaining customer payment',async()=>{
    const r=await newOrder([await note()]);await paid(r.body.orderId);const order=await Order.findById(r.body.orderId)
    const input={orderId:r.body.orderId,reason:'Test-only confirmed refund concurrency',providerConfirmed:true,lines:[{lineId:order!.financial.lines[0].id,customerRefundMinor:7000}]}
    const outcomes=await Promise.allSettled([applyConfirmedRefund({...input,reference:'CONCURRENT-1'}),applyConfirmedRefund({...input,reference:'CONCURRENT-2'})])
    expect(outcomes.filter(x=>x.status==='fulfilled')).toHaveLength(1)
    expect((await Order.findById(r.body.orderId))!.refundedMinor).toBe(7000)
    expect((await reconcileOrder(r.body.orderId)).balanced).toBe(true)
  })
  it('retains entitlement to unrefunded items in a partially refunded multi-item order',async()=>{
    const a=await note(),b=await note(),file=path.join(dir,'retained.pdf');await fs.writeFile(file,testPdf());await Material.updateOne({_id:b._id},{pdfPath:file})
    const r=await newOrder([a,b]);await paid(r.body.orderId);const order=await Order.findById(r.body.orderId),line=order!.financial.lines.find((l:any)=>l.materialId===String(a._id))
    await applyConfirmedRefund({orderId:r.body.orderId,reference:'TEST-ONE-ITEM',reason:'Confirmed test fixture',providerConfirmed:true,lines:[{lineId:line.id,customerRefundMinor:line.customerPaymentMinor}]})
    expect((await api('get',`/orders/${order!._id}/download-token/${a._id}`)).status).toBe(403)
    const token=await api('get',`/orders/${order!._id}/download-token/${b._id}`);expect(token.status).toBe(200)
    expect((await request(app).get(token.body.url).auth(buyer.token,{type:'bearer'})).status).toBe(200)
    const list=await api('get','/orders');const mine=list.body.find((o:any)=>o._id===String(order!._id));expect(mine.items.find((i:any)=>i.material===String(a._id)).canDownload).toBe(false);expect(mine.items.find((i:any)=>i.material===String(b._id)).canDownload).toBe(true)
  })
  it('isolates seller financial records and exposes independent daily/monthly/annual periods and subscription revenue',async()=>{
    await buyPlan(other,'PRO');const r=await newOrder([await note()]);await paid(r.body.orderId)
    const mine=await api('get','/seller/financial-report?seller='+other.user._id,seller);expect(mine.body.totals.customerPaidMinor).toBe(10000)
    const theirs=await api('get','/seller/financial-report',other);expect(theirs.body.totals.customerPaidMinor).toBe(0)
    expect((await api('get','/admin/reports',seller)).status).toBe(403)
    const report=await api('get','/admin/reports',admin);expect(report.body.totals.subscriptionRevenueMinor).toBe(19900)
    const bounds=reportingBoundaries();expect(new Date(report.body.periods.daily.from).toISOString()).toBe(bounds.daily.from.toISOString());expect(report.body.periods.daily.to).not.toBe(report.body.periods.annual.to)
  })
  it('uses separate period cohorts and accounts today for a refund of an older order',async()=>{
    const bounds=reportingBoundaries(),dates=[new Date(),new Date(bounds.daily.from.getTime()-1000),new Date(bounds.monthly.from.getTime()-1000),new Date(bounds.annual.from.getTime()-1000)],ids:string[]=[]
    for(const date of dates){const r=await newOrder([await note()]);await paid(r.body.orderId);ids.push(r.body.orderId);await Order.updateOne({_id:r.body.orderId},{paidAt:date})}
    const oldest=await Order.findById(ids[3]);await applyConfirmedRefund({orderId:ids[3],reference:'TEST-OLD-REFUND',reason:'Test confirmed prior-period refund',providerConfirmed:true,lines:[{lineId:oldest!.financial.lines[0].id,customerRefundMinor:1000}]})
    const report=await financialReport(String(seller.user._id))
    for(const key of ['daily','monthly','annual'] as const){const count=dates.filter(d=>d>=bounds[key].from&&d<bounds[key].to).length;expect(report.periods[key].orderCount).toBe(count);expect(report.periods[key].customerPaidMinor).toBe(count*10000);expect(report.periods[key].refundMinor).toBe(1000)}
  })
  it('blocks publication of a corrupted versioned ledger instead of reporting fabricated totals',async()=>{
    const r=await newOrder([await note()]);await paid(r.body.orderId)
    await SellerLedger.updateOne({order:r.body.orderId},{$set:{commissionMinor:1}})
    expect((await reconcileOrder(r.body.orderId)).balanced).toBe(false)
    expect((await api('get','/seller/financial-report',seller)).status).toBe(409)
  })
  it('audits refund review without allowing manual completion, fractional-paise requests or deletion',async()=>{
    const r=await newOrder([await note()]);await paid(r.body.orderId)
    expect((await api('post','/admin/refunds',admin).send({orderId:r.body.orderId,amount:'1.001',reason:'Invalid precision'})).status).toBe(400)
    const pending=await api('post','/admin/refunds',admin).send({orderId:r.body.orderId,amount:'10.00',reason:'Test request for review only'})
    expect(pending.status).toBe(501);expect(pending.body.providerRefund).toBe(false)
    const row=await Refund.findOne({order:r.body.orderId});expect(row!.get('amountMinor')).toBe(1000)
    expect((await api('patch','/admin/refunds/'+row!._id,root).send({status:'COMPLETED'})).status).toBe(409)
    expect((await api('patch','/admin/refunds/'+row!._id,admin).send({status:'APPROVED'})).status).toBe(200)
    expect(await AdminAudit.countDocuments({action:'REFUND_REVIEW_APPROVED'})).toBe(1)
    expect((await request(app).delete('/api/v1/admin/refunds/'+row!._id).auth(root.token,{type:'bearer'})).status).toBe(405)
    expect(await FinancialAdjustment.countDocuments()).toBe(0);expect((await Order.findById(r.body.orderId))!.paymentStatus).toBe('PAID')
  })
})
