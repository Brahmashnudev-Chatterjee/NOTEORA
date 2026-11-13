import {financialHash} from './financialService.js'
import type {ClientSession} from 'mongoose'
import { PlanPolicy, Subscription, Material, UploadQuota, User, AdminAudit, Order } from '../models.js'
import { atomic } from './transaction.js'
import { integer, bps } from './money.js'

export type PlanName='FREE'|'PRO'|'ULTRA'
export type Plan={name:PlanName;priceMinor:number;uploadLimit:number|null;quotaBasis:'LIFETIME'|'BILLING_PERIOD';commissionBps:number;featured:boolean;analytics:boolean}
export const DEFAULT_PLANS:Plan[]=[
  {name:'FREE',priceMinor:0,uploadLimit:5,quotaBasis:'LIFETIME',commissionBps:3000,featured:false,analytics:false},
  {name:'PRO',priceMinor:19900,uploadLimit:15,quotaBasis:'BILLING_PERIOD',commissionBps:2000,featured:true,analytics:true},
  {name:'ULTRA',priceMinor:49900,uploadLimit:null,quotaBasis:'BILLING_PERIOD',commissionBps:1000,featured:true,analytics:true}
]
export async function catalog(session?:ClientSession){
  const row=await PlanPolicy.findOne().sort({version:-1}).session(session||null).lean()
  return {version:row?.version||1,plans:structuredClone((row?.plans||DEFAULT_PLANS) as Plan[])}
}
export async function entitlement(userId:string,now=new Date(),session?:ClientSession){
  const policy=await catalog(session),free=policy.plans.find(p=>p.name==='FREE')!
  const rows=await Subscription.find({user:userId}).sort({startsAt:-1,createdAt:-1}).session(session||null).lean()
  const payments=await Order.find({_id:{$in:rows.map(r=>r.paymentOrder).filter(Boolean)},user:userId,purpose:'SUBSCRIPTION',paymentStatus:'PAID',accountedAt:{$exists:true},financialVersion:2}).session(session||null).lean()
  const verified=(r:any)=>payments.some(o=>String(o._id)===String(r.paymentOrder)&&o.verifiedPaymentEvent===r.verifiedPaymentEvent&&o.financial&&financialHash({...o.financial,entitlementTerms:r.terms})===o.financialHash)
  const paid=rows.find(r=>r.terms&&verified(r)&&r.startsAt&&r.startsAt<=now&&r.expiresAt&&r.expiresAt>now&&['ACTIVE','CANCELLED','SCHEDULED'].includes(r.status||''))
  // Legacy User.plan/active booleans cannot manufacture a verified entitlement.
  const relevant=paid||rows.find(r=>r.status==='SUSPENDED'&&r.expiresAt&&r.expiresAt>now)||rows[0]
  const status=paid?(paid.status==='CANCELLED'?'CANCELLED':'ACTIVE'):relevant?.status==='SUSPENDED'?'SUSPENDED':relevant?.expiresAt&&relevant.expiresAt<=now?'EXPIRED':relevant?.status==='SCHEDULED'?'SCHEDULED':'FREE'
  return {plan:paid?paid.terms as Plan:free,catalogVersion:paid?(paid.terms as any).catalogVersion:policy.version,subscription:paid||null,status,startsAt:paid?.startsAt||null,expiresAt:paid?.expiresAt||null,renewalEligible:!!paid&&paid.status!=='CANCELLED'&&paid.expiresAt!.getTime()-now.getTime()<=7*86400000,legacyReviewRequired:rows.some(r=>r.plan!=='FREE'&&!verified(r))}
}
export async function presentAccount(user:any){const context=await entitlement(String(user._id));const safe=user.toObject?user.toObject():user;delete safe.password;delete safe.verificationToken;delete safe.resetPasswordToken;return {...safe,plan:context.plan.name,subscriptionStatus:context.status,subscriptionExpiresAt:context.expiresAt}}
export async function changeCatalog(expectedVersion:number,plans:Plan[],actor:string,reason:string){
  if(!reason.trim()||reason.length>1000)throw Object.assign(new Error('A change reason is required'),{status:400})
  if(plans.length!==3||new Set(plans.map(p=>p.name)).size!==3)throw Object.assign(new Error('Exactly Free, Pro and Ultra plans are required'),{status:400})
  for(const p of plans){integer(p.priceMinor);bps(p.commissionBps);if(p.uploadLimit!==null)integer(p.uploadLimit,'upload limit');if(!['FREE','PRO','ULTRA'].includes(p.name)||p.quotaBasis!==(p.name==='FREE'?'LIFETIME':'BILLING_PERIOD')||(p.name==='FREE'&&p.priceMinor!==0)||(p.name!=='FREE'&&p.priceMinor===0))throw Object.assign(new Error('Invalid plan policy'),{status:400})}
  return atomic(async session=>{
    const current=await catalog(session)
    if(current.version!==expectedVersion)throw Object.assign(new Error('Catalog changed; reload before saving'),{status:409})
    const [saved]=await PlanPolicy.create([{version:current.version+1,plans,reason,actor}],{session})
    await AdminAudit.create([{actor,action:'PLAN_CATALOG_VERSION_CREATED',entity:'PlanPolicy',entityId:String(saved._id),details:{version:saved.version,reason}}],{session})
    return {version:saved.version,plans}
  })
}
export async function reserveUpload(userId:string,session:ClientSession,now=new Date()){
  const context=await entitlement(userId,now,session)
  let lifetime=await UploadQuota.findOne({user:userId,periodKey:'LIFETIME'}).session(session)
  if(!lifetime){const baseline=await Material.countDocuments({seller:userId}).session(session);[lifetime]=await UploadQuota.create([{user:userId,periodKey:'LIFETIME',used:baseline}],{session})}
  let quota:any=lifetime
  if(context.plan.quotaBasis==='BILLING_PERIOD'){
    const key='SUB:'+context.subscription!._id
    quota=await UploadQuota.findOne({user:userId,periodKey:key}).session(session)
    if(!quota){const baseline=await Material.countDocuments({seller:userId,createdAt:{$gte:context.startsAt,$lt:context.expiresAt}}).session(session);[quota]=await UploadQuota.create([{user:userId,periodKey:key,used:baseline}],{session})}
  }
  if(context.plan.uploadLimit!==null&&quota!.used>=context.plan.uploadLimit)throw Object.assign(new Error(`${context.plan.name} upload limit reached`),{status:403})
  await UploadQuota.updateOne({_id:lifetime!._id},{$inc:{used:1}},{session})
  if(quota!._id.toString()!==lifetime!._id.toString())await UploadQuota.updateOne({_id:quota!._id},{$inc:{used:1}},{session})
  return context
}
export function addBillingMonth(start:Date){const result=new Date(start);const day=result.getUTCDate();result.setUTCDate(1);result.setUTCMonth(result.getUTCMonth()+1);const last=new Date(Date.UTC(result.getUTCFullYear(),result.getUTCMonth()+1,0)).getUTCDate();result.setUTCDate(Math.min(day,last));return result}
export async function activateVerifiedSubscription(order:any,eventId:string,session:ClientSession){
  if(order.purpose!=='SUBSCRIPTION'||order.paymentStatus!=='PAID'||order.verifiedPaymentEvent!==eventId||!order.financial?.entitlementTerms)throw new Error('Verified subscription payment required')
  const existing=await Subscription.findOne({paymentOrder:order._id}).session(session);if(existing)return existing
  const current=await entitlement(String(order.user),new Date(),session)
  let startsAt=current.expiresAt&&current.expiresAt>new Date()?current.expiresAt:new Date()
  const scheduled=await Subscription.find({user:order.user,expiresAt:{$gt:startsAt},status:{$in:['ACTIVE','CANCELLED','SCHEDULED']}}).sort({expiresAt:-1}).session(session)
  for(const term of scheduled){
    const proof=await Order.findOne({_id:term.paymentOrder,user:order.user,purpose:'SUBSCRIPTION',paymentStatus:'PAID',verifiedPaymentEvent:term.verifiedPaymentEvent,accountedAt:{$exists:true}}).session(session)
    if(proof?.financial&&financialHash({...proof.financial,entitlementTerms:term.terms})===proof.financialHash){startsAt=term.expiresAt;break}
  }
  const expiresAt=addBillingMonth(startsAt)
  const [subscription]=await Subscription.create([{user:order.user,plan:order.financial.entitlementTerms.name,terms:order.financial.entitlementTerms,paymentOrder:order._id,verifiedPaymentEvent:eventId,startsAt,expiresAt,active:true,status:startsAt>new Date()?'SCHEDULED':'ACTIVE'}],{session})
  return subscription
}
export async function subscriptionHistory(user:string){const context=await entitlement(user);const rows=await Subscription.find({user}).sort({createdAt:-1}).lean();return {...context,history:rows.map(r=>({...r,status:r.expiresAt&&r.expiresAt<new Date()?'EXPIRED':r.status==='SCHEDULED'&&r.startsAt&&r.startsAt<=new Date()?'ACTIVE':r.status||'LEGACY_REVIEW_REQUIRED'}))}}
export async function cancelSubscription(user:string){return atomic(async session=>{
  const current=await entitlement(user,new Date(),session)
  if(current.subscription){await Subscription.updateOne({_id:current.subscription._id},{$set:{status:'CANCELLED',cancelledAt:new Date(),autoRenew:false}},{session});await AdminAudit.create([{actor:user,action:'SUBSCRIPTION_CANCELLED_AT_PERIOD_END',entity:'Subscription',entityId:String(current.subscription._id)}],{session})}
  return {message:current.subscription?'Cancellation recorded. Paid benefits end at the recorded expiry.':'Free plan remains active',expiresAt:current.expiresAt}
})}
