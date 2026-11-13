import {decimal,sum,toMinor} from './services/money.js'
import {financialSummary} from './services/financialReports.js'
import {presentAccount} from './services/subscriptionService.js'
import { Router } from 'express'
import mongoose from 'mongoose'
import { z } from 'zod'
import { auth, allow, type AuthRequest } from './auth.js'
import { User, Material, Order, SellerLedger, Review, Promotion, SupportTicket, ActivityLog } from './models.js'

export const sellerRoutes=Router()
const oid=z.string().regex(/^[a-f\d]{24}$/i)
import { reportingBoundaries } from './services/reportingPeriods.js'
export { reportingBoundaries } from './services/reportingPeriods.js'
const profile=z.object({name:z.string().trim().min(1).max(120).optional(),bio:z.string().trim().max(1000).optional(),university:z.string().trim().max(180).optional(),phone:z.string().trim().max(30).optional(),notificationPreferences:z.object({email:z.boolean(),inApp:z.boolean()}).optional()})
sellerRoutes.patch('/users/me',auth,async(req:AuthRequest,res)=>{
  const parsed=profile.safeParse(req.body);if(!parsed.success)return res.status(400).json({message:'Invalid profile or notification preferences'})
  const user=await User.findByIdAndUpdate(req.user!.id,{$set:parsed.data},{new:true,runValidators:true}).lean()
  await ActivityLog.create({user:req.user!.id,action:'PROFILE_UPDATED',entity:'User',entityId:req.user!.id,details:Object.keys(parsed.data),ip:req.ip})
  res.json(await presentAccount(user))
})
sellerRoutes.get('/seller/materials',auth,async(req:AuthRequest,res)=>{
  const query=z.object({status:z.enum(['DRAFT','PENDING','APPROVED','REJECTED','ARCHIVED']).optional(),search:z.string().max(100).optional(),page:z.coerce.number().int().min(1).max(10000).default(1),pageSize:z.coerce.number().int().min(1).max(100).default(24)}).safeParse(req.query)
  if(!query.success)return res.status(400).json({message:'Invalid material filters'})
  const q=query.data,match:any={seller:req.user!.id}
  if(q.status)match.status=q.status
  if(q.search)match.title=new RegExp(q.search.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i')
  const [items,total]=await Promise.all([Material.find(match).select('-pdfPath -coverImage -previewPath').sort({createdAt:-1,_id:-1}).skip((q.page-1)*q.pageSize).limit(q.pageSize),Material.countDocuments(match)])
  const sold=await Order.aggregate([{$match:{paymentStatus:'PAID','items.material':{$in:items.map(m=>m._id)}}},{$unwind:'$items'},{$match:{'items.material':{$in:items.map(m=>m._id)},'items.seller':new mongoose.Types.ObjectId(req.user!.id)}},{$group:{_id:'$items.material',sales:{$sum:1}}}])
  const sales=new Map(sold.map(x=>[String(x._id),x.sales]))
  res.json({items:items.map(m=>({...m.toObject(),sales:sales.get(String(m._id))||0})),total,page:q.page,pageSize:q.pageSize,pages:Math.ceil(total/q.pageSize)})
})
async function analytics(seller:string){
  const bounds=reportingBoundaries()
  const [orders,materials,finance]=await Promise.all([Order.find({'items.seller':seller,$or:[{paymentStatus:'PAID'},{accountedAt:{$exists:true}}]}).lean(),Material.find({seller}).lean(),financialSummary(seller)])
  const records:any[]=[];let invalidLegacyLines=0
  for(const order of orders)for(const item of order.items){if(String(item.seller)!==seller)continue;try{const line=order.financial?.lines?.find((x:any)=>x.materialId===String(item.material));records.push({id:String(item.material),title:item.title,minor:line?line.netBaseMinor:toMinor(item.unitPrice),date:order.paidAt||order.createdAt})}catch{invalidLegacyLines++}}
  const aggregate=(rows:any[])=>({sales:rows.length,revenue:Number(decimal(sum(rows.map(x=>x.minor))))})
  const byStatus:Record<string,number>={};for(const material of materials)byStatus[material.status]=(byStatus[material.status]||0)+1
  const months=[];for(let i=0;i<12;i++){const start=new Date(bounds.seriesFrom.getTime()+19800000);start.setUTCMonth(start.getUTCMonth()+i);const month=start.toISOString().slice(0,7);months.push({month,...aggregate(records.filter(x=>new Date(x.date.getTime()+19800000).toISOString().slice(0,7)===month))})}
  const ids=[...new Set(records.map(x=>x.id))],popular=ids.map(id=>({_id:id,title:records.find(x=>x.id===id).title,...aggregate(records.filter(x=>x.id===id))})).sort((a,b)=>b.sales-a.sales||a._id.localeCompare(b._id)).slice(0,5)
  return {uploaded:materials.length,approved:byStatus.APPROVED||0,pending:byStatus.PENDING||0,byStatus,views:materials.reduce((n,x)=>n+(x.views||0),0),...aggregate(records),earnings:Number(decimal(finance.netSellerEarningsMinor)),financial:finance,invalidLegacyLines,months,popular,periods:Object.fromEntries((['daily','monthly','annual'] as const).map(key=>[key,{...bounds[key],...aggregate(records.filter(x=>x.date>=bounds[key].from&&x.date<bounds[key].to))}])),timezone:'Asia/Kolkata'}
}
sellerRoutes.get('/seller/dashboard',auth,async(req:AuthRequest,res)=>res.json(await analytics(req.user!.id)))
sellerRoutes.get('/seller/analytics',auth,async(req:AuthRequest,res)=>res.json(await analytics(req.user!.id)))
sellerRoutes.get('/seller/sales',auth,async(req:AuthRequest,res)=>{
  const orders=await Order.find({paymentStatus:'PAID','items.seller':req.user!.id}).populate('user','name').sort({createdAt:-1}).limit(500).lean()
  res.json(orders.map((o:any)=>({_id:o._id,internalOrderId:o.internalOrderId,paymentStatus:o.paymentStatus,createdAt:o.createdAt,paidAt:o.paidAt,buyer:o.user,items:o.items.filter((i:any)=>String(i.seller)===req.user!.id)})))
})
sellerRoutes.get('/seller/reviews',auth,async(req:AuthRequest,res)=>{
  const materials=await Material.find({seller:req.user!.id}).select('_id')
  res.json(await Review.find({material:{$in:materials.map(x=>x._id)}}).populate('material','title').populate('user','name').sort({createdAt:-1}).limit(500))
})
const promo=z.object({code:z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,30}$/),discount:z.coerce.number().min(1).max(100).refine(v=>{try{toMinor(v);return true}catch{return false}}),material:oid.nullable().optional(),expiresAt:z.string().datetime().nullable().optional(),active:z.boolean().optional()})
sellerRoutes.get('/seller/promotions',auth,async(req:AuthRequest,res)=>res.json(await Promotion.find({seller:req.user!.id}).populate('material','title').sort({createdAt:-1})))
sellerRoutes.post('/seller/promotions',auth,async(req:AuthRequest,res)=>{
  const p=promo.safeParse(req.body);if(!p.success)return res.status(400).json({message:'Valid code, discount, material and expiry required'})
  if(p.data.material&&!await Material.exists({_id:p.data.material,seller:req.user!.id}))return res.status(403).json({message:'Choose your own material'})
  if(p.data.expiresAt&&new Date(p.data.expiresAt)<=new Date())return res.status(400).json({message:'Expiry must be in the future'})
  try{res.status(201).json(await Promotion.create({...p.data,seller:req.user!.id}))}catch(e:any){if(e.code===11000)return res.status(409).json({message:'Promotion code already exists'});throw e}
})
sellerRoutes.patch('/seller/promotions/:id',auth,async(req:AuthRequest,res)=>{
  const p=promo.partial().safeParse(req.body);if(!p.success)return res.status(400).json({message:'Invalid promotion'})
  if(p.data.material&&!await Material.exists({_id:p.data.material,seller:req.user!.id}))return res.status(403).json({message:'Choose your own material'})
  if(p.data.expiresAt&&new Date(p.data.expiresAt)<=new Date())return res.status(400).json({message:'Expiry must be in the future'})
  try{const result=await Promotion.findOneAndUpdate({_id:req.params.id,seller:req.user!.id},{$set:p.data},{new:true,runValidators:true});if(!result)return res.status(404).json({message:'Promotion not found'});res.json(result)}catch(e:any){if(e.code===11000)return res.status(409).json({message:'Promotion code already exists'});throw e}
})
sellerRoutes.delete('/seller/promotions/:id',auth,async(req:AuthRequest,res)=>{const p=await Promotion.findOneAndDelete({_id:req.params.id,seller:req.user!.id});if(!p)return res.status(404).json({message:'Promotion not found'});res.json({deleted:true})})
sellerRoutes.get('/support',auth,async(req:AuthRequest,res)=>res.json(await SupportTicket.find({user:req.user!.id}).sort({createdAt:-1}).limit(200)))
sellerRoutes.post('/support',auth,async(req:AuthRequest,res)=>{
  const parsed=z.object({subject:z.string().trim().min(1).max(180),message:z.string().trim().min(1).max(4000)}).safeParse(req.body)
  if(!parsed.success)return res.status(400).json({message:'A subject and message are required (180/4000 character limits)'})
  res.status(201).json(await SupportTicket.create({...parsed.data,user:req.user!.id,status:'OPEN'}))
})
sellerRoutes.get('/admin/sellers',auth,allow('ADMIN','SUPER_ADMIN'),async(_req,res)=>{
  const owners=await Material.distinct('seller')
  res.json(await User.find({_id:{$in:owners}}).select('name email sellerVerified sellerVerificationNote active suspended university bio').sort({createdAt:-1}))
})
sellerRoutes.patch('/admin/sellers/:id',auth,allow('ADMIN','SUPER_ADMIN'),async(req:AuthRequest,res)=>{
  const parsed=z.object({sellerVerified:z.boolean(),sellerVerificationNote:z.string().trim().max(1000).default('')}).safeParse(req.body)
  if(!parsed.success)return res.status(400).json({message:'Valid seller verification status and note required'})
  const seller=await User.findById(req.params.id)
  if(!seller||!await Material.exists({seller:seller._id}))return res.status(404).json({message:'Seller not found'})
  if(req.user!.role!=='SUPER_ADMIN'&&seller.role!=='USER')return res.status(403).json({message:'Only super administrators may manage privileged accounts'})
  seller.set(parsed.data);await seller.save()
  await ActivityLog.create({user:req.user!.id,action:'SELLER_VERIFICATION_UPDATED',entity:'User',entityId:String(seller._id),details:parsed.data,ip:req.ip})
  res.json({id:seller._id,sellerVerified:seller.sellerVerified})
})
