import { Router, type Response } from 'express'
import mongoose from 'mongoose'
import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import { z } from 'zod'
import { auth, allow, type AuthRequest } from './auth.js'
import { Material, Category, User, Review, Order, Cart, Subscription, AdminAudit, Notification, ActivityLog } from './models.js'

export const marketplaceRoutes=Router()
const id=z.string().regex(/^[a-f\d]{24}$/i)
const objectId=(value:string)=>new mongoose.Types.ObjectId(value)
const escaped=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
const storageRoot=()=>path.resolve(process.env.PRIVATE_UPLOAD_DIR||'uploads')
const filePath=(value:string)=>{const resolved=path.resolve(value);const rel=path.relative(storageRoot(),resolved);if(rel.startsWith('..')||path.isAbsolute(rel))throw new Error('Invalid private file location');return resolved}
const pageQuery=z.object({page:z.coerce.number().int().min(1).max(10000).default(1),pageSize:z.coerce.number().int().min(1).max(48).default(12)})
const browseQuery=pageQuery.extend({search:z.string().trim().max(100).optional(),subject:z.string().max(100).optional(),category:id.optional(),academicLevel:z.string().max(100).optional(),course:z.string().max(100).optional(),instructor:z.string().max(100).optional(),minPrice:z.coerce.number().min(0).max(150).optional(),maxPrice:z.coerce.number().min(0).max(150).optional(),sort:z.enum(['newest','oldest','popular','rating','price_asc','price_desc']).default('newest')}).refine(v=>v.minPrice===undefined||v.maxPrice===undefined||v.minPrice<=v.maxPrice)
const safeMaterial=(m:any)=>{const {pdfPath,coverImage,previewPath,...safe}=m.toObject?m.toObject():m;return {...safe,previewAvailable:!!previewPath,thumbnailUrl:coverImage?`/api/v1/materials/${m._id}/thumbnail`:null}}
const publicFields='-pdfPath -coverImage -previewPath'
const statsStages:any[]=[
  {$lookup:{from:'reviews',let:{mid:'$_id'},pipeline:[{$match:{$expr:{$eq:['$material','$$mid']}}},{$group:{_id:null,rating:{$avg:'$rating'},reviewCount:{$sum:1}}}],as:'reviewStats'}},
  {$lookup:{from:'orders',let:{mid:'$_id'},pipeline:[{$match:{paymentStatus:'PAID'}},{$unwind:'$items'},{$match:{$expr:{$eq:['$items.material','$$mid']}}},{$count:'count'}],as:'paidSales'}},
  {$set:{rating:{$ifNull:[{$arrayElemAt:['$reviewStats.rating',0]},0]},reviewCount:{$ifNull:[{$arrayElemAt:['$reviewStats.reviewCount',0]},0]},sales:{$ifNull:[{$arrayElemAt:['$paidSales.count',0]},0]}}},
  {$unset:['reviewStats','paidSales']}
]
marketplaceRoutes.get('/materials/facets',async(_req,res)=>{
  const [subjects,levels,courses,instructors,categories]=await Promise.all([Material.distinct('subject',{status:'APPROVED'}),Material.distinct('academicLevel',{status:'APPROVED'}),Material.distinct('course',{status:'APPROVED'}),Material.distinct('instructor',{status:'APPROVED'}),Category.find().sort({name:1}).lean()])
  res.json({subjects:subjects.filter(Boolean).sort(),academicLevels:levels.filter(Boolean).sort(),courses:courses.filter(Boolean).sort(),instructors:instructors.filter(Boolean).sort(),categories})
})
marketplaceRoutes.get('/materials',async(req,res)=>{
  const parsed=browseQuery.safeParse(req.query);if(!parsed.success)return res.status(400).json({message:'Invalid search, filters or pagination'})
  const q=parsed.data;const match:any={status:'APPROVED'}
  if(q.search)match.$or=['title','description','tags','course','instructor'].map(field=>({[field]:new RegExp(escaped(q.search!),'i')}))
  for(const field of ['subject','academicLevel','course','instructor'] as const)if(q[field])match[field]=new RegExp('^'+escaped(q[field]!)+'$','i')
  if(q.category)match.category=objectId(q.category)
  if(q.minPrice!==undefined||q.maxPrice!==undefined)match.price={...(q.minPrice!==undefined?{$gte:q.minPrice}:{}),...(q.maxPrice!==undefined?{$lte:q.maxPrice}:{})}
  const sorts:Record<string,any>={newest:{createdAt:-1,_id:-1},oldest:{createdAt:1,_id:1},popular:{sales:-1,_id:-1},rating:{rating:-1,reviewCount:-1,_id:-1},price_asc:{price:1,_id:1},price_desc:{price:-1,_id:-1}}
  const [result]=await Material.aggregate([{$match:match},...statsStages,{$sort:sorts[q.sort]},{$facet:{items:[{$skip:(q.page-1)*q.pageSize},{$limit:q.pageSize}],count:[{$count:'total'}]}}])
  await Material.populate(result.items,{path:'seller',select:'name bio university sellerVerified'})
  const total=result.count[0]?.total||0
  res.json({items:result.items.map(safeMaterial),total,page:q.page,pageSize:q.pageSize,pages:Math.ceil(total/q.pageSize)})
})
marketplaceRoutes.get('/materials/:id',async(req,res)=>{
  if(!id.safeParse(req.params.id).success)return res.status(404).json({message:'Material not found'})
  const [m]=await Material.aggregate([{$match:{_id:objectId(String(req.params.id)),status:'APPROVED'}},...statsStages])
  if(!m)return res.status(404).json({message:'Material not found'})
  await Material.populate(m,[{path:'seller',select:'name bio university sellerVerified'},{path:'category',select:'name slug'}])
  await Material.updateOne({_id:m._id},{$inc:{views:1}})
  res.json(safeMaterial(m))
})
async function serveFile(res:Response,stored:string|null|undefined,type:string,inline=true,name='document.pdf'){
  if(!stored)return res.status(404).json({message:'File unavailable'})
  try{const resolved=filePath(stored);await fs.access(resolved);res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');res.type(type);if(inline){res.setHeader('Content-Disposition',`inline; filename="${name.replace(/[^\w.-]/g,'-')}"`);return res.sendFile(resolved)}return res.download(resolved,name)}catch{return res.status(404).json({message:'File unavailable'})}
}
marketplaceRoutes.get('/materials/:id/thumbnail',async(req,res)=>{
  const m=id.safeParse(req.params.id).success?await Material.findOne({_id:req.params.id,status:'APPROVED'}):null
  if(!m?.coverImage)return res.status(404).json({message:'Thumbnail unavailable'})
  const type=m.coverImage.endsWith('.png')?'image/png':m.coverImage.endsWith('.webp')?'image/webp':'image/jpeg'
  return serveFile(res,m.coverImage,type)
})
marketplaceRoutes.get('/materials/:id/preview',async(req,res)=>{
  const m=id.safeParse(req.params.id).success?await Material.findOne({_id:req.params.id,status:'APPROVED'}):null
  return serveFile(res,m?.previewPath,'application/pdf')
})
marketplaceRoutes.get('/materials/:id/source',auth,async(req:AuthRequest,res)=>{
  const m=id.safeParse(req.params.id).success?await Material.findById(req.params.id):null
  if(!m||!(String(m.seller)===req.user!.id||['ADMIN','SUPER_ADMIN','MODERATOR'].includes(req.user!.role)))return res.status(404).json({message:'Material unavailable'})
  return serveFile(res,m.pdfPath,'application/pdf')
})
const upload=multer({storage:multer.diskStorage({destination:async(_req,_file,cb)=>{try{const root=storageRoot();await fs.mkdir(root,{recursive:true});cb(null,root)}catch(e){cb(e as Error,'')}},filename:(_req,file,cb)=>{const ext=file.fieldname==='cover'?({'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp'}[file.mimetype]||'.invalid'):'.pdf';cb(null,crypto.randomBytes(24).toString('hex')+ext)}}),limits:{fileSize:20*1024*1024,files:3,fields:20},fileFilter:(_req,file,cb)=>{if(file.fieldname==='cover'?!['image/png','image/jpeg','image/webp'].includes(file.mimetype):file.mimetype!=='application/pdf')return cb(new Error('Only PDFs and PNG/JPEG/WebP thumbnails are accepted'));cb(null,true)}})
const text=z.string().trim().max(4000)
const fields=z.object({title:z.string().trim().min(1).max(180),description:text.default(''),subject:z.string().trim().max(100).default(''),academicLevel:z.string().trim().max(100).default(''),course:z.string().trim().max(100).default(''),instructor:z.string().trim().max(100).default(''),category:z.preprocess(v=>v===''?undefined:v,id.optional()),tags:z.union([z.string().max(500),z.array(z.string().max(60)).max(20)]).transform(v=>typeof v==='string'?v.split(',').map(x=>x.trim()).filter(Boolean):v).default([]),price:z.coerce.number().min(0).max(150)})
async function cleanup(files:Express.Multer.File[]){await Promise.all(files.map(f=>fs.rm(f.path,{force:true})))}
marketplaceRoutes.post('/materials',auth,(req,res,next)=>upload.fields([{name:'pdf',maxCount:1},{name:'cover',maxCount:1},{name:'preview',maxCount:1}])(req,res,async err=>{if(err){const all=Object.values((req.files||{}) as Record<string,Express.Multer.File[]>).flat();await cleanup(all);return res.status(400).json({message:'Upload rejected. Use PDFs up to 20 MB and PNG/JPEG/WebP thumbnails.'})}next()}),async(req:AuthRequest,res)=>{
  const files=(req.files||{}) as Record<string,Express.Multer.File[]>,all=Object.values(files).flat()
  try{
    const parsed=fields.safeParse(req.body);const status=req.body.status||'PENDING'
    if(!parsed.success||!['DRAFT','PENDING'].includes(status)||!files.pdf?.[0]){await cleanup(all);return res.status(400).json({message:'Valid material fields and a PDF are required'})}
    if(parsed.data.category&&!await Category.exists({_id:parsed.data.category})){await cleanup(all);return res.status(400).json({message:'Unknown category'})}
    for(const file of [files.pdf?.[0],files.preview?.[0]].filter(Boolean)){
      const handle=await fs.open(file.path,'r');const magic=Buffer.alloc(5);try{await handle.read(magic,0,5,0)}finally{await handle.close()}
      if(magic.toString()!=='%PDF-'||(file.fieldname==='preview'&&file.size>3*1024*1024)){await cleanup(all);return res.status(400).json({message:'Invalid PDF or preview exceeds 3 MB'})}
    }
    if(files.cover?.[0]){
      const f=files.cover[0];const bytes=await fs.readFile(f.path)
      const valid=f.mimetype==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):f.mimetype==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'
      if(!valid||f.size>5*1024*1024){await cleanup(all);return res.status(400).json({message:'Invalid thumbnail or thumbnail exceeds 5 MB'})}
    }
    // Preserve current subscription rules unchanged; authoritative plan redesign is Phase D.
    const plan=await Subscription.findOne({user:req.user!.id,active:true}).sort({expiresAt:-1});const name=plan?.plan||'FREE';const limits:Record<string,number>={FREE:5,PRO:25,ULTRA:100}
    const count=await Material.countDocuments({seller:req.user!.id,...(name==='FREE'?{}:{status:'APPROVED'})})
    if(count>=(limits[name]||5)){await cleanup(all);return res.status(403).json({message:`${name} listing limit reached`})}
    const material=await Material.create({...parsed.data,status,seller:req.user!.id,pdfPath:files.pdf[0].path,coverImage:files.cover?.[0]?.path,previewPath:files.preview?.[0]?.path})
    return res.status(201).json(safeMaterial(material))
  }catch(error){await cleanup(all);throw error}
})
marketplaceRoutes.patch('/materials/:id',auth,async(req:AuthRequest,res)=>{
  const parsed=fields.partial().safeParse(req.body);if(!parsed.success)return res.status(400).json({message:'Invalid material fields'})
  const m=await Material.findOne({_id:req.params.id,seller:req.user!.id})
  if(!m)return res.status(404).json({message:'Material not found'})
  if(!['DRAFT','REJECTED'].includes(m.status))return res.status(409).json({message:'Move this material to a draft before editing; it must be reviewed again before publication'})
  if(parsed.data.category&&!await Category.exists({_id:parsed.data.category}))return res.status(400).json({message:'Unknown category'})
  const updated=await Material.findOneAndUpdate({_id:m._id,status:m.status},{$set:parsed.data},{new:true,runValidators:true})
  if(!updated)return res.status(409).json({message:'Material changed; refresh and retry'})
  res.json(safeMaterial(updated))
})
marketplaceRoutes.patch('/materials/:id/state',auth,async(req:AuthRequest,res)=>{
  const next=z.enum(['DRAFT','PENDING','ARCHIVED']).safeParse(req.body.status);if(!next.success)return res.status(400).json({message:'Invalid material state'})
  const m=await Material.findOne({_id:req.params.id,seller:req.user!.id});if(!m)return res.status(404).json({message:'Material not found'})
  const allowed:Record<string,string[]>={DRAFT:['PENDING','ARCHIVED'],PENDING:['DRAFT','ARCHIVED'],APPROVED:['ARCHIVED'],REJECTED:['DRAFT','PENDING','ARCHIVED'],ARCHIVED:['DRAFT','PENDING']}
  if(!allowed[m.status]?.includes(next.data))return res.status(409).json({message:'Invalid state transition'})
  const updated=await Material.findOneAndUpdate({_id:m._id,status:m.status},{$set:{status:next.data,archivedAt:next.data==='ARCHIVED'?new Date():null,moderationNote:''}},{new:true})
  if(!updated)return res.status(409).json({message:'Material changed; refresh and retry'})
  res.json(safeMaterial(updated))
})
marketplaceRoutes.delete('/materials/:id',auth,async(req:AuthRequest,res)=>{
  const m=await Material.findOne({_id:req.params.id,seller:req.user!.id,status:{$in:['DRAFT','REJECTED','ARCHIVED']}})
  if(!m)return res.status(409).json({message:'Only unpublished drafts, rejected or archived materials can be deleted'})
  if(await Order.exists({'items.material':m._id,paymentStatus:'PAID'}))return res.status(409).json({message:'Purchased materials must be retained for buyer access. Archive instead.'})
  await m.deleteOne();for(const file of [m.pdfPath,m.coverImage,m.previewPath].filter(Boolean))await fs.rm(filePath(file!),{force:true})
  res.json({deleted:true})
})
marketplaceRoutes.get('/cart',auth,async(req:AuthRequest,res)=>{
  const cart=await Cart.findOne({user:req.user!.id}).populate({path:'items.material',select:publicFields}).lean()
  res.json(cart||{items:[]})
})
marketplaceRoutes.post('/cart/items/:id',auth,async(req:AuthRequest,res)=>{
  if(!id.safeParse(req.params.id).success||!await Material.exists({_id:req.params.id,status:'APPROVED'}))return res.status(409).json({message:'Material unavailable'})
  try{await Cart.updateOne({user:req.user!.id},{$setOnInsert:{user:req.user!.id,items:[]}},{upsert:true})}catch(e:any){if(e.code!==11000)throw e}
  await Cart.updateOne({user:req.user!.id,'items.material':{$ne:req.params.id}},{$push:{items:{material:req.params.id,quantity:1}}})
  const cart=await Cart.findOne({user:req.user!.id})
  res.json({items:cart!.items})
})
marketplaceRoutes.put('/cart',auth,async(req:AuthRequest,res)=>{
  const parsed=z.object({materialIds:z.array(id).max(100)}).safeParse(req.body)
  if(!parsed.success)return res.status(400).json({message:'Invalid cart'})
  const ids=[...new Set(parsed.data.materialIds)];const materials=await Material.find({_id:{$in:ids},status:'APPROVED'}).select('_id')
  if(materials.length!==ids.length)return res.status(409).json({message:'Some materials are unavailable'})
  const cart=await Cart.findOneAndUpdate({user:req.user!.id},{$set:{items:ids.map(material=>({material,quantity:1}))}},{upsert:true,new:true}).populate({path:'items.material',select:publicFields})
  res.json(cart)
})
marketplaceRoutes.post('/reviews',auth,async(req:AuthRequest,res)=>{
  const parsed=z.object({material:id,order:id,rating:z.number().int().min(1).max(5),comment:z.string().trim().max(2000).default('')}).safeParse(req.body)
  if(!parsed.success)return res.status(400).json({message:'A valid purchase, integer rating 1–5 and comment up to 2000 characters are required'})
  const input=parsed.data
  if(!await Order.exists({_id:input.order,user:req.user!.id,paymentStatus:'PAID','items.material':input.material}))return res.status(403).json({message:'Verified purchase required'})
  try{res.status(201).json(await Review.create({...input,user:req.user!.id}))}catch(e:any){if(e.code===11000)return res.status(409).json({message:'Review already submitted'});throw e}
})
marketplaceRoutes.get('/reviews',auth,async(req:AuthRequest,res)=>res.json(await Review.find({user:req.user!.id}).populate('material','title').sort({createdAt:-1})))
marketplaceRoutes.get('/reviews/:material',async(req,res)=>{
  if(!id.safeParse(req.params.material).success)return res.status(400).json({message:'Invalid material'})
  if(!await Material.exists({_id:req.params.material,status:'APPROVED'}))return res.status(404).json({message:'Material not found'})
  res.json(await Review.find({material:req.params.material}).populate('user','name').sort({createdAt:-1}).limit(100))
})
marketplaceRoutes.get('/admin/materials',auth,allow('ADMIN','SUPER_ADMIN','MODERATOR'),async(_req,res)=>res.json((await Material.find().populate('seller','name email').sort({createdAt:-1}).limit(500)).map(safeMaterial)))
marketplaceRoutes.delete('/admin/materials/:id',auth,allow('ADMIN','SUPER_ADMIN','MODERATOR'),async(req:AuthRequest,res)=>{
  const m=await Material.findById(req.params.id);if(!m)return res.status(404).json({message:'Material not found'})
  if(await Order.exists({'items.material':m._id,paymentStatus:'PAID'}))return res.status(409).json({message:'Purchased materials must be retained. Archive instead.'})
  await m.deleteOne()
  for(const file of [m.pdfPath,m.coverImage,m.previewPath].filter(Boolean))await fs.rm(filePath(file!),{force:true})
  await AdminAudit.create({actor:req.user!.id,action:'DELETE_MATERIAL',entity:'Material',entityId:String(m._id),ip:req.ip})
  res.json({deleted:true})
})
marketplaceRoutes.patch('/admin/materials/:id/status',auth,allow('ADMIN','SUPER_ADMIN','MODERATOR'),async(req:AuthRequest,res)=>{
  const parsed=z.object({status:z.enum(['APPROVED','REJECTED','ARCHIVED']),moderationNote:z.string().trim().max(2000).default('')}).safeParse(req.body)
  if(!parsed.success||(parsed.data.status==='REJECTED'&&!parsed.data.moderationNote))return res.status(400).json({message:'Valid status and rejection feedback required'})
  const {status,moderationNote}=parsed.data
  const m=await Material.findOneAndUpdate({_id:req.params.id,status:status==='ARCHIVED'?'APPROVED':'PENDING'},{$set:{status,moderationNote}},{new:true})
  if(!m)return res.status(409).json({message:'Only pending materials may be approved/rejected; only approved materials may be archived'})
  await AdminAudit.create({actor:req.user!.id,action:'MODERATE_MATERIAL',entity:'Material',entityId:String(m._id),details:parsed.data,ip:req.ip})
  await Notification.create({user:m.seller,type:'MODERATION',title:`Material ${status.toLowerCase()}`,message:`${m.title}: ${moderationNote||status}`})
  res.json(safeMaterial(m))
})
marketplaceRoutes.get('/orders/:orderId/download-token/:materialId',auth,async(req:AuthRequest,res)=>{
  const order=await Order.findOne({_id:req.params.orderId,user:req.user!.id,paymentStatus:'PAID','items.material':req.params.materialId})
  if(!order)return res.status(403).json({message:'Paid purchase required'})
  const expires=Math.floor(Date.now()/1000)+900
  const payload=Buffer.from(JSON.stringify({uid:req.user!.id,oid:String(order._id),mid:req.params.materialId,exp:expires})).toString('base64url')
  const secret=process.env.JWT_ACCESS_SECRET||(process.env.NODE_ENV==='test'?'ci-test-only-access-secret':'')
  if(!secret)return res.status(503).json({message:'Download signing unavailable'})
  const signature=crypto.createHmac('sha256',secret).update(payload).digest('base64url')
  res.json({url:`/api/v1/orders/${order._id}/download/${req.params.materialId}?token=${payload}.${signature}`,expiresAt:new Date(expires*1000)})
})
marketplaceRoutes.get('/orders/:orderId/download/:materialId',auth,async(req:AuthRequest,res)=>{
  const order=await Order.findOne({_id:req.params.orderId,user:req.user!.id,paymentStatus:'PAID','items.material':req.params.materialId})
  if(!order)return res.status(403).json({message:'Paid purchase required'})
  const [payload,signature,...extra]=String(req.query.token||'').split('.')
  const secret=process.env.JWT_ACCESS_SECRET||(process.env.NODE_ENV==='test'?'ci-test-only-access-secret':'')
  if(!secret||!payload||!signature||extra.length)return res.status(403).json({message:'Signed download token required'})
  const expected=crypto.createHmac('sha256',secret).update(payload).digest('base64url')
  if(signature.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(signature)))return res.status(403).json({message:'Invalid download token'})
  let claims:any;try{claims=JSON.parse(Buffer.from(payload,'base64url').toString())}catch{return res.status(403).json({message:'Invalid download token'})}
  if(claims.uid!==req.user!.id||claims.oid!==String(order._id)||claims.mid!==req.params.materialId||!Number.isFinite(claims.exp)||claims.exp<=Math.floor(Date.now()/1000))return res.status(403).json({message:'Download token expired or invalid'})
  const material=await Material.findById(req.params.materialId)
  return serveFile(res,material?.pdfPath,'application/pdf',false,`${material?.title||'notes'}.pdf`)
})
