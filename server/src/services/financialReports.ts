import { Order, SellerLedger, FinancialAdjustment, Subscription } from '../models.js'
import { sum } from './money.js'
import { reportingBoundaries } from './reportingPeriods.js'
import { financialHash, type Snapshot } from './financialService.js'
export async function financialSummary(seller?:string,range?:{from:Date;to:Date}){
  const date=range?{$gte:range.from,$lt:range.to}:undefined
  const orders=await Order.find({financialVersion:2,accountedAt:{$exists:true},...(seller?{'financial.lines.sellerId':seller}:{}),...(date?{paidAt:date}:{})}).lean()
  const ledgers=await SellerLedger.find({financialVersion:2,order:{$in:orders.map(o=>o._id)},...(seller?{seller}:{})}).lean()
  const adjustments=await FinancialAdjustment.find({...seller?{seller}:{},...(date?{createdAt:date}:{})}).lean()
  for(const order of orders){if(!order.financial||financialHash(order.financial)!==order.financialHash)throw Object.assign(new Error('Financial snapshot reconciliation required'),{status:409})}
  for(const ledger of ledgers){
    const order=orders.find(o=>String(o._id)===String(ledger.order)),lines=order?.financial.lines.filter((l:any)=>l.sellerId===String(ledger.seller))||[]
    if(!order||ledger.snapshotHash!==order.financialHash||!lines.length||['customerPaymentMinor','commissionMinor','sellerPayableMinor','platformRevenueMinor','taxMinor','gatewayFeeMinor'].some(key=>ledger[key]!==sum(lines.map((l:any)=>l[key]))))throw Object.assign(new Error('Seller ledger reconciliation required'),{status:409})
  }
  for(const order of orders)for(const owner of new Set(order.financial.lines.map((l:any)=>l.sellerId).filter(Boolean))){if((!seller||owner===seller)&&!ledgers.some(l=>String(l.order)===String(order._id)&&String(l.seller)===owner))throw Object.assign(new Error('Missing seller ledger; reconciliation required'),{status:409})}
  const subscriptions=seller?[]:orders.filter(o=>o.purpose==='SUBSCRIPTION')
  const metric=(field:string)=>sum([...ledgers.map(x=>x[field]||0),...subscriptions.map(o=>field==='commissionMinor'?0:(o.financial as any)[field==='customerPaymentMinor'?'totalMinor':field==='originalMinor'?'subtotalMinor':field]||0)])
  const adj=(key:string,materialOnly=false)=>sum(adjustments.filter(x=>!materialOnly||x.seller).map(x=>(x as any)[key]||0))
  const paidOrders=seller?orders.filter(o=>ledgers.some(l=>String(l.order)===String(o._id))):orders
  const states=await Subscription.find(seller?{user:seller}:{}).select('status expiresAt startsAt verifiedPaymentEvent').lean()
  const statuses:Record<string,number>={}
  for(const row of states){const key=!row.verifiedPaymentEvent?'LEGACY_REVIEW_REQUIRED':row.expiresAt&&row.expiresAt<new Date()?'EXPIRED':row.status==='SCHEDULED'&&row.startsAt&&row.startsAt<=new Date()?'ACTIVE':row.status||'LEGACY_REVIEW_REQUIRED';statuses[key]=(statuses[key]||0)+1}
  const result={orderCount:paidOrders.length,grossMinor:metric('originalMinor'),customerPaidMinor:metric('customerPaymentMinor'),discountMinor:metric('discountMinor'),taxMinor:metric('taxMinor'),commissionMinor:metric('commissionMinor'),gatewayFeeMinor:metric('gatewayFeeMinor'),sellerEarningsMinor:metric('sellerPayableMinor'),platformRevenueMinor:metric('platformRevenueMinor'),refundMinor:adj('customerRefundMinor'),taxReversalMinor:adj('taxReversalMinor'),commissionReversalMinor:adj('commissionReversalMinor',true),platformRefundMinor:adj('commissionReversalMinor'),sellerDebitMinor:adj('sellerDebitMinor'),feeRefundMinor:adj('feeRefundMinor'),subscriptionRevenueMinor:sum(subscriptions.map(o=>(o.financial as any).netBaseMinor)),subscriptionRefundMinor:sum(adjustments.filter(a=>!a.seller).map(a=>a.commissionReversalMinor||0)),subscriptionStatuses:statuses,legacyUnaccountedOrders:await Order.countDocuments({financialVersion:{$ne:2},paymentStatus:{$in:['PAID','REFUNDED','PARTIALLY_REFUNDED']},...(seller?{'items.seller':seller}:{}),...(date?{paidAt:date}:{})}),legacyUnaccountedLedgers:await SellerLedger.countDocuments({financialVersion:{$ne:2},...(seller?{seller}:{})})}
  return {...result,netSubscriptionRevenueMinor:sum([result.subscriptionRevenueMinor,-result.subscriptionRefundMinor]),netCustomerMinor:sum([result.customerPaidMinor,-result.refundMinor]),netSellerEarningsMinor:sum([result.sellerEarningsMinor,-result.sellerDebitMinor]),netCommissionMinor:sum([result.commissionMinor,-result.commissionReversalMinor]),netPlatformRevenueMinor:sum([result.platformRevenueMinor,-result.platformRefundMinor,result.feeRefundMinor])}
}
export async function financialReport(seller?:string){const bounds=reportingBoundaries();return {currency:'INR',unit:'paise',timezone:'Asia/Kolkata',totals:await financialSummary(seller),periods:Object.fromEntries(await Promise.all((['daily','monthly','annual'] as const).map(async key=>[key,{...bounds[key],...await financialSummary(seller,bounds[key])}])) )}}
export async function reconcileOrder(id:string){
  const order=await Order.findById(id).lean<any>();if(!order?.financial)throw Object.assign(new Error('Versioned accounting snapshot unavailable; legacy review required'),{status:409})
  const snapshot=order.financial as Snapshot,ledgers=await SellerLedger.find({order:id}).lean(),adjustments=await FinancialAdjustment.find({order:id}).lean(),differences:string[]=[]
  if(!order.accountedAt)return {orderId:id,balanced:null,differences:['UNPAID_AWAITING_VERIFICATION'],totalMinor:snapshot.totalMinor,refundedMinor:0,ledgerCount:ledgers.length,snapshotHash:order.financialHash}
  if(financialHash(snapshot)!==order.financialHash)differences.push('SNAPSHOT_HASH')
  if(snapshot.totalMinor!==sum([snapshot.sellerPayableMinor,snapshot.platformRevenueMinor,snapshot.gatewayFeeMinor,snapshot.taxMinor]))differences.push('ORDER_IDENTITY')
  for(const seller of new Set(snapshot.lines.map(x=>x.sellerId).filter(Boolean))){
    const entries=ledgers.filter(l=>String(l.seller)===seller),lines=snapshot.lines.filter(x=>x.sellerId===seller)
    if(entries.length!==1){differences.push('LEDGER_COUNT:'+seller);continue}
    for(const field of ['customerPaymentMinor','commissionMinor','sellerPayableMinor','platformRevenueMinor','taxMinor','gatewayFeeMinor'])if(entries[0][field]!==sum(lines.map(l=>(l as any)[field])))differences.push(field+':'+seller)
  }
  if(ledgers.some(l=>!snapshot.lines.some(x=>x.sellerId===String(l.seller))))differences.push('EXTRA_SELLER_LEDGER')
  if(sum(adjustments.map(a=>a.customerRefundMinor||0))!==(order.refundedMinor||0))differences.push('REFUND_TOTAL')
  return {orderId:id,balanced:differences.length===0,differences,totalMinor:snapshot.totalMinor,refundedMinor:order.refundedMinor||0,ledgerCount:ledgers.length,snapshotHash:order.financialHash}
}
