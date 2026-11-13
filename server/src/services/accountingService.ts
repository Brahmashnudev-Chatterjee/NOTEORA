import type { ClientSession } from 'mongoose'
import { Order, SellerLedger, FinancialPolicy, PaymentWebhookEvent, FinancialAdjustment, AdminAudit, Cart, Subscription } from '../models.js'
import { type Snapshot, type FinancialRules, financialHash, refundCumulative } from './financialService.js'
import { sum, integer } from './money.js'
import { atomic } from './transaction.js'
import { activateVerifiedSubscription } from './subscriptionService.js'

export async function financialRules(session?:ClientSession):Promise<FinancialRules>{const row=await FinancialPolicy.findOne().sort({version:-1}).session(session||null).lean();return row?{version:row.version!,tax:row.tax,gatewayFee:row.gatewayFee}:{version:1,tax:{status:'UNRESOLVED'},gatewayFee:{status:'UNRESOLVED'}}}
export async function changeFinancialRules(expected:number,rules:Omit<FinancialRules,'version'>,actor:string,reason:string){return atomic(async session=>{
  const current=await financialRules(session);if(current.version!==expected)throw Object.assign(new Error('Financial policy changed'),{status:409})
  const [created]=await FinancialPolicy.create([{version:expected+1,...rules,actor,reason}],{session})
  await AdminAudit.create([{actor,action:'FINANCIAL_POLICY_VERSION_CREATED',entity:'FinancialPolicy',entityId:String(created._id),details:{version:created.version,reason}}],{session})
  return created
})}
export async function postOrderLedger(order:any,session:ClientSession){
  const snapshot=order.financial as Snapshot
  if(!snapshot||snapshot.version!==2||financialHash(snapshot)!==order.financialHash)throw Object.assign(new Error('Order snapshot requires reconciliation'),{status:409})
  const sellerIds=[...new Set(snapshot.lines.map(x=>x.sellerId).filter(Boolean))]
  for(const seller of sellerIds){
    const lines=snapshot.lines.filter(x=>x.sellerId===seller)
    const fields=Object.fromEntries(['discountMinor','taxMinor','commissionMinor','gatewayFeeMinor','sellerPayableMinor','platformRevenueMinor','customerPaymentMinor'].map(key=>[key,sum(lines.map(x=>(x as any)[key]))]))
    const existing=await SellerLedger.findOne({order:order._id,seller}).session(session)
    if(existing){if(existing.financialVersion!==2||existing.snapshotHash!==order.financialHash||Object.entries(fields).some(([key,value])=>existing.get(key)!==value))throw Object.assign(new Error('Conflicting legacy ledger requires review'),{status:409});continue}
    await SellerLedger.create([{seller,order:order._id,financialVersion:2,snapshotHash:order.financialHash,lines,originalMinor:sum(lines.map(x=>x.unitPriceMinor)),...fields,settlementStatus:'PENDING'}],{session})
  }
  return snapshot
}
export type PaymentEvidence={eventId:string;event:string;gatewayOrderId:string;amountMinor:number;currency:string;environment:string;sequence:number;payloadHash:string}
// Called only after the existing raw-body signature verifier has authenticated the event.
export async function acceptSignedPayment(input:PaymentEvidence){
  return atomic(async session=>{
    const prior=await PaymentWebhookEvent.findOne({eventId:input.eventId}).session(session)
    if(prior){if(prior.get('payloadHash')!==input.payloadHash)throw Object.assign(new Error('Conflicting event replay'),{status:409});return {duplicate:true}}
    const order=await Order.findOne({gatewayOrderId:input.gatewayOrderId}).session(session)
    if(!order)throw Object.assign(new Error('Unknown order'),{status:404})
    const snapshot=order.financial as Snapshot
    if(order.environment!==input.environment||input.environment!=='sandbox'||input.currency!=='INR'||!snapshot||snapshot.version!==2||financialHash(snapshot)!==order.financialHash||input.amountMinor!==snapshot.totalMinor)throw Object.assign(new Error('Payment evidence does not match the immutable order snapshot'),{status:409})
    if(input.sequence<=order.gatewayEventSequence)return {ignored:'stale-sequence'}
    const final=['PAID','REFUNDED','PARTIALLY_REFUNDED'].includes(order.paymentStatus)
    if(final&&input.event!=='order.paid')return {ignored:'final-state'}
    const next:Record<string,string>={'order.paid':'PAID','order.pending':'PENDING','order.failed':'FAILED','order.expired':'EXPIRED','order.under_review':'UNDER_REVIEW'}
    if(!next[input.event])throw Object.assign(new Error('Unsupported event'),{status:400})
    const [event]=await PaymentWebhookEvent.create([{eventId:input.eventId,event:input.event,eventSequence:input.sequence,gatewayOrderId:input.gatewayOrderId,environment:input.environment,payloadHash:input.payloadHash,processedAt:new Date()}],{session})
    order.gatewayEventSequence=input.sequence
    if(!final){order.paymentStatus=next[input.event] as any;if(input.event==='order.paid'){order.paidAt=new Date();order.verifiedPaymentEvent=input.eventId}}
    if(input.event==='order.paid'&&!order.accountedAt){
      await postOrderLedger(order,session)
      if(order.purpose==='SUBSCRIPTION')await activateVerifiedSubscription(order,input.eventId,session)
      order.accountedAt=new Date()
      if(order.purpose==='MATERIAL')await Cart.updateOne({user:order.user},{$set:{items:[]}},{session})
    }
    await order.save({session})
    await AdminAudit.create([{action:'SIGNED_PAYMENT_ACCOUNTED',entity:'Order',entityId:String(order._id),details:{eventId:input.eventId,hash:order.financialHash}}],{session})
    return {received:true,eventId:String(event._id)}
  })
}
export type RefundEvidence={reference:string;orderId:string;reason:string;providerConfirmed:boolean;lines:{lineId:string;customerRefundMinor:number;feeRefundMinor?:number}[]}
// No public/admin route calls this. Provider-confirmed refund integration remains Phase G.
export async function applyConfirmedRefund(input:RefundEvidence){
  if(!input.providerConfirmed||!input.reference.trim()||!input.reason.trim())throw new Error('Authoritative refund evidence is required')
  return atomic(async session=>{
    const order=await Order.findById(input.orderId).session(session)
    if(!order?.accountedAt||!order.verifiedPaymentEvent)throw new Error('Accounted payment required')
    const existing=await FinancialAdjustment.find({order:order._id,reference:input.reference}).session(session)
    if(existing.length){const actual=existing.map(x=>({lineId:x.lineId,customerRefundMinor:x.customerRefundMinor,feeRefundMinor:x.feeRefundMinor})).sort((a,b)=>a.lineId.localeCompare(b.lineId));const requested=input.lines.map(x=>({...x,feeRefundMinor:x.feeRefundMinor||0})).sort((a,b)=>a.lineId.localeCompare(b.lineId));if(actual.length!==requested.length||actual.some((x,i)=>x.lineId!==requested[i].lineId||x.customerRefundMinor!==requested[i].customerRefundMinor||x.feeRefundMinor!==requested[i].feeRefundMinor))throw new Error('Conflicting refund replay');return {duplicate:true}}
    const snapshot=order.financial as Snapshot
    if(financialHash(snapshot)!==order.financialHash||new Set(input.lines.map(x=>x.lineId)).size!==input.lines.length||!input.lines.length)throw new Error('Invalid refund lines')
    const history=await FinancialAdjustment.find({order:order._id}).session(session)
    for(const requested of input.lines){
      integer(requested.customerRefundMinor);if(!requested.customerRefundMinor)throw new Error('Positive refund required')
      const line=snapshot.lines.find(x=>x.id===requested.lineId);if(!line)throw new Error('Unknown refund line')
      const before=history.filter(x=>x.lineId===line.id),prior=sum(before.map(x=>x.customerRefundMinor||0)),priorFee=sum(before.map(x=>x.feeRefundMinor||0))
      const old=refundCumulative(line,prior,priorFee),next=refundCumulative(line,prior+requested.customerRefundMinor,priorFee+(requested.feeRefundMinor||0))
      const delta=Object.fromEntries(Object.keys(next).map(k=>[k,(next as any)[k]-(old as any)[k]]))
      const ledger=line.sellerId?await SellerLedger.findOne({seller:line.sellerId,order:order._id}).session(session):null
      if(line.sellerId&&(!ledger||ledger.snapshotHash!==order.financialHash))throw new Error('Seller ledger requires reconciliation before adjustments')
      await FinancialAdjustment.create([{order:order._id,seller:line.sellerId||undefined,ledger:ledger?._id,reference:input.reference,kind:'REFUND',lineId:line.id,...delta,reason:input.reason,evidence:{providerConfirmed:true,reference:input.reference}}],{session})
    }
    order.refundedMinor=sum([order.refundedMinor||0,...input.lines.map(x=>x.customerRefundMinor)])
    order.paymentStatus=order.refundedMinor===snapshot.totalMinor?'REFUNDED':'PARTIALLY_REFUNDED'
    await order.save({session})
    if(order.purpose==='SUBSCRIPTION')await Subscription.updateMany({paymentOrder:order._id},{$set:{status:'SUSPENDED',autoRenew:false}},{session})
    await AdminAudit.create([{action:'CONFIRMED_REFUND_ACCOUNTED',entity:'Order',entityId:String(order._id),details:{reference:input.reference,reason:input.reason}}],{session})
    return {refundedMinor:order.refundedMinor}
  })
}
