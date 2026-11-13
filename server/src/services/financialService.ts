import crypto from 'node:crypto'
import { integer, bps, ratio, allocate, sum, toMinor, decimal } from './money.js'
export type TaxPolicy={status:'UNRESOLVED'|'APPROVED';mode?:'NONE'|'EXCLUSIVE'|'INCLUSIVE';rateBps?:number;approvalReference?:string}
export type FeePolicy={status:'UNRESOLVED'|'APPROVED';rateBps?:number;fixedMinor?:number;approvalReference?:string}
export type FinancialRules={version:number;tax:TaxPolicy;gatewayFee:FeePolicy}
export type LineInput={id:string;materialId?:string;sellerId:string|null;title:string;unitPriceMinor:number;commissionBps:number;discountBps?:number;planVersion:number}
export type FinancialLine=LineInput&{discountMinor:number;netBaseMinor:number;taxMinor:number;customerPaymentMinor:number;commissionMinor:number;gatewayFeeMinor:number;sellerPayableMinor:number;platformRevenueMinor:number}
export type Snapshot={entitlementTerms?:Record<string,any>;version:2;currency:'INR';policy:FinancialRules;lines:FinancialLine[];subtotalMinor:number;discountMinor:number;netBaseMinor:number;taxMinor:number;totalMinor:number;commissionMinor:number;gatewayFeeMinor:number;sellerPayableMinor:number;platformRevenueMinor:number}
export function validateRules(rules:FinancialRules){
  if(rules.tax.status!=='APPROVED'||!rules.tax.approvalReference?.trim()||!['NONE','EXCLUSIVE','INCLUSIVE'].includes(rules.tax.mode||''))throw Object.assign(new Error('An approved, explicit tax policy is required; checkout is blocked'),{status:422})
  if(rules.gatewayFee.status!=='APPROVED'||!rules.gatewayFee.approvalReference?.trim())throw Object.assign(new Error('An approved gateway fee accounting policy is required'),{status:422})
  bps(rules.tax.rateBps??-1);bps(rules.gatewayFee.rateBps??-1);integer(rules.gatewayFee.fixedMinor??-1)
  if(rules.tax.mode==='NONE'&&rules.tax.rateBps!==0)throw new Error('Explicit no-tax policy must have a zero rate')
}
function canonical(value:any):any {if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));return value}
export function financialHash(snapshot:Snapshot){return crypto.createHash('sha256').update(JSON.stringify(canonical(snapshot))).digest('hex')}
export function calculateOrder(inputs:LineInput[],rules:FinancialRules,kind:'MATERIAL'|'SUBSCRIPTION'='MATERIAL'):Snapshot{
  validateRules(rules)
  if(!inputs.length||inputs.length>100||new Set(inputs.map(x=>x.id)).size!==inputs.length)throw new Error('Invalid financial line set')
  const lines:FinancialLine[]=inputs.map(input=>{
    integer(input.unitPriceMinor);bps(input.commissionBps);bps(input.discountBps||0)
    if(kind==='MATERIAL'&&(!input.sellerId||input.unitPriceMinor>15000))throw new Error('Invalid base price')
    const discountMinor=ratio(input.unitPriceMinor,input.discountBps||0,10000),afterDiscount=input.unitPriceMinor-discountMinor
    const taxMinor=rules.tax.mode==='NONE'?0:rules.tax.mode==='INCLUSIVE'?ratio(afterDiscount,rules.tax.rateBps!,10000+rules.tax.rateBps!):ratio(afterDiscount,rules.tax.rateBps!,10000)
    const netBaseMinor=rules.tax.mode==='INCLUSIVE'?afterDiscount-taxMinor:afterDiscount
    const customerPaymentMinor=netBaseMinor+taxMinor,commissionMinor=ratio(netBaseMinor,input.commissionBps,10000)
    return {...input,discountMinor,netBaseMinor,taxMinor,customerPaymentMinor,commissionMinor,gatewayFeeMinor:0,sellerPayableMinor:netBaseMinor-commissionMinor,platformRevenueMinor:commissionMinor}
  })
  const totalMinor=sum(lines.map(x=>x.customerPaymentMinor)),fee=totalMinor?sum([ratio(totalMinor,rules.gatewayFee.rateBps!,10000),rules.gatewayFee.fixedMinor!]):0
  const fees=allocate(fee,lines.map(x=>x.customerPaymentMinor))
  lines.forEach((line,i)=>{line.gatewayFeeMinor=fees[i];line.platformRevenueMinor=line.commissionMinor-fees[i]})
  const amounts=Object.fromEntries(['discountMinor','netBaseMinor','taxMinor','commissionMinor','gatewayFeeMinor','sellerPayableMinor','platformRevenueMinor'].map(key=>[key,sum(lines.map(x=>(x as any)[key]))])) as any
  return {version:2,currency:'INR',policy:structuredClone(rules),lines,subtotalMinor:sum(inputs.map(x=>x.unitPriceMinor)),totalMinor,...amounts}
}
export function refundCumulative(line:FinancialLine,customerRefundMinor:number,feeRefundMinor=0){
  integer(customerRefundMinor);integer(feeRefundMinor)
  if(customerRefundMinor>line.customerPaymentMinor||feeRefundMinor>line.gatewayFeeMinor)throw new Error('Refund exceeds the original amount')
  const taxReversalMinor=line.customerPaymentMinor?ratio(line.taxMinor,customerRefundMinor,line.customerPaymentMinor):0
  const base=customerRefundMinor-taxReversalMinor
  const commissionReversalMinor=line.netBaseMinor?ratio(line.commissionMinor,base,line.netBaseMinor):0
  return {customerRefundMinor,taxReversalMinor,commissionReversalMinor,sellerDebitMinor:base-commissionReversalMinor,feeRefundMinor}
}
// Compatibility adapter. No route uses this legacy rupee-shaped interface.
export type FinancialInput={basePrice:number;commissionRate:number;gstRate?:number;gatewayFee?:number}
export function calculateFinancials(input:FinancialInput){
  if(input.gstRate===undefined)throw new Error('Explicit tax configuration required')
  const rules:FinancialRules={version:1,tax:{status:'APPROVED',mode:input.gstRate?'EXCLUSIVE':'NONE',rateBps:toMinor(String(input.gstRate)),approvalReference:'explicit-caller-policy'},gatewayFee:{status:'APPROVED',rateBps:0,fixedMinor:toMinor(input.gatewayFee||0),approvalReference:'explicit-caller-policy'}}
  const result=calculateOrder([{id:'legacy',sellerId:'seller',title:'Material',unitPriceMinor:toMinor(input.basePrice),commissionBps:toMinor(String(input.commissionRate)),planVersion:1}],rules)
  const n=(v:number)=>Number(decimal(v)) // presentation compatibility only, no arithmetic
  return {basePrice:n(result.subtotalMinor),discount:n(result.discountMinor),gst:n(result.taxMinor),customerPayment:n(result.totalMinor),commission:n(result.commissionMinor),gatewayFee:n(result.gatewayFeeMinor),sellerPayable:n(result.sellerPayableMinor),refundAmount:0,platformRevenue:n(result.platformRevenueMinor)}
}
