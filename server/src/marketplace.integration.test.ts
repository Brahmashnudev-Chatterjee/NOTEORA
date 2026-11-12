import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import request from 'supertest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { app } from './index.js'
import { Material, Category, Order, Cart, Review, Promotion, User, AuthSession, SupportTicket, SellerLedger, Notification } from './models.js'
import { testActor, testPdf, testPng } from './testFixtures.js'
import { reportingBoundaries } from './sellerRoutes.js'

let mongo:MongoMemoryServer,directory:string,seller:Awaited<ReturnType<typeof testActor>>,buyer:typeof seller,admin:typeof seller,other:typeof seller
const get=(url:string,actor=buyer)=>request(app).get('/api/v1'+url).auth(actor.token,{type:'bearer'})
const post=(url:string,actor=buyer)=>request(app).post('/api/v1'+url).auth(actor.token,{type:'bearer'})
const patch=(url:string,actor=seller)=>request(app).patch('/api/v1'+url).auth(actor.token,{type:'bearer'})
async function material(overrides:any={}){
  const pdfPath=path.join(directory,crypto.randomUUID()+'.pdf');await fs.writeFile(pdfPath,testPdf())
  return Material.create({title:'Algebra notes',description:'Linear algebra revision',subject:'Math',academicLevel:'Undergraduate',course:'MATH101',instructor:'Professor A',price:100,status:'APPROVED',seller:seller.user._id,pdfPath,...overrides})
}
async function purchase(m:any,overrides:any={}){
  const unique=crypto.randomUUID()
  return Order.create({internalOrderId:unique,clientOrderId:unique,user:buyer.user._id,items:[{material:m._id,title:m.title,unitPrice:m.price,seller:m.seller}],subtotal:m.price,total:m.price,environment:'sandbox',paymentStatus:'PAID',paidAt:new Date(),...overrides})
}
beforeAll(async()=>{mongo=await MongoMemoryServer.create();await mongoose.connect(mongo.getUri());directory=await fs.mkdtemp(path.join(os.tmpdir(),'noteora-marketplace-test-'));process.env.PRIVATE_UPLOAD_DIR=directory;await Promise.all([Review.init(),Promotion.init(),Cart.init()])},120000)
beforeEach(async()=>{
  await Promise.all([Material,Category,Order,Cart,Review,Promotion,User,AuthSession,SupportTicket,SellerLedger,Notification].map((m:any)=>m.deleteMany({})))
  for(const name of await fs.readdir(directory))await fs.rm(path.join(directory,name),{force:true})
  ;[seller,buyer,admin,other]=await Promise.all([testActor(),testActor(),testActor('ADMIN'),testActor()])
})
afterAll(async()=>{await mongoose.disconnect();await mongo?.stop();if(directory){for(const name of await fs.readdir(directory))await fs.rm(path.join(directory,name),{force:true});await fs.rmdir(directory)}})
describe('Phase C real MongoDB marketplace integration',()=>{
  it('combines actual database search, category, subject, level, price, course and instructor filters',async()=>{
    const c=await Category.create({name:'Mathematics',slug:'math'});await material({category:c._id});await material({title:'Biology',subject:'Science',price:10});await material({status:'PENDING'})
    const r=await get(`/materials?search=algebra&category=${c._id}&subject=Math&academicLevel=Undergraduate&minPrice=50&maxPrice=120&course=MATH101&instructor=Professor%20A`)
    expect(r.status).toBe(200);expect(r.body.total).toBe(1);expect(r.body.items[0].title).toBe('Algebra notes')
    const facets=await get('/materials/facets');expect(facets.body.categories[0].name).toBe('Mathematics')
  })
  it('sorts and paginates deterministically while excluding unpublished notes',async()=>{
    await material({price:20});await material({price:80});await material({price:50});await material({status:'DRAFT',price:1})
    const r=await get('/materials?sort=price_asc&pageSize=2&page=2');expect(r.body.total).toBe(3);expect(r.body.pages).toBe(2);expect(r.body.items.map((m:any)=>m.price)).toEqual([80])
  })
  it('sorts popularity and ratings using stored paid orders and verified review records',async()=>{
    const a=await material({title:'Popular note'}),b=await material({title:'Highest rated note'})
    const first=await purchase(a);await purchase(a);const second=await purchase(b)
    await Review.create({material:a._id,user:buyer.user._id,order:first._id,rating:3})
    await Review.create({material:b._id,user:buyer.user._id,order:second._id,rating:5})
    expect((await get('/materials?sort=popular')).body.items[0].title).toBe('Popular note')
    expect((await get('/materials?sort=rating')).body.items[0].title).toBe('Highest rated note')
  })
  it('escapes regex input and rejects invalid price ranges, IDs and oversized pagination',async()=>{
    await material({title:'Notes (advanced)'})
    expect((await get('/materials?search=%28')).body.total).toBe(1)
    for(const query of ['minPrice=100&maxPrice=1','pageSize=9999','category=bad','sort=arbitrary','page=0'])expect((await get('/materials?'+query)).status).toBe(400)
  })
  it('returns public seller information and verified ratings without private paths or contact data',async()=>{
    await User.updateOne({_id:seller.user._id},{bio:'Math teacher',phone:'private',sellerVerified:true})
    const m=await material(),o=await purchase(m);await Review.create({material:m._id,user:buyer.user._id,order:o._id,rating:4,comment:'Useful'})
    const r=await get('/materials/'+m._id)
    expect(r.body.rating).toBe(4);expect(r.body.sales).toBe(1);expect(r.body.seller.bio).toBe('Math teacher');expect(r.body.seller.sellerVerified).toBe(true)
    for(const key of ['pdfPath','previewPath','coverImage'])expect(r.body[key]).toBeUndefined()
    expect(r.body.seller.email).toBeUndefined();expect(r.body.seller.phone).toBeUndefined()
  })
  it('uploads PDF, validated thumbnail and a separate preview; cleans up invalid uploads',async()=>{
    const r=await post('/materials',seller).field('title','New notes').field('price','90').field('category','').attach('pdf',testPdf(),{filename:'notes.pdf',contentType:'application/pdf'}).attach('cover',testPng,{filename:'cover.png',contentType:'image/png'}).attach('preview',testPdf('Excerpt'),{filename:'excerpt.pdf',contentType:'application/pdf'})
    expect(r.status).toBe(201);expect(r.body.status).toBe('PENDING');expect(r.body.previewAvailable).toBe(true)
    const before=(await fs.readdir(directory)).length
    const invalid=await post('/materials',seller).field('title','Bad').field('price','151').attach('pdf',testPdf(),{filename:'notes.pdf',contentType:'application/pdf'})
    expect(invalid.status).toBe(400);expect((await fs.readdir(directory)).length).toBe(before)
    const fake=await post('/materials',seller).field('title','Bad').field('price','10').attach('pdf',Buffer.from('not pdf'),{filename:'notes.pdf',contentType:'application/pdf'})
    expect(fake.status).toBe(400);expect((await fs.readdir(directory)).length).toBe(before)
  })
  it('serves only explicitly published preview/thumbnail and protects full source files',async()=>{
    const preview=path.join(directory,'preview.pdf'),cover=path.join(directory,'cover.png');await fs.writeFile(preview,testPdf('Preview'));await fs.writeFile(cover,testPng)
    const m=await material({previewPath:preview,coverImage:cover})
    expect((await get(`/materials/${m._id}/preview`)).status).toBe(200);expect((await get(`/materials/${m._id}/thumbnail`)).status).toBe(200)
    expect((await get(`/materials/${m._id}/source`)).status).toBe(404)
    expect((await get(`/materials/${m._id}/source`,seller)).status).toBe(200);expect((await get(`/materials/${m._id}/source`,admin)).status).toBe(200)
    await Material.updateOne({_id:m._id},{status:'DRAFT'});expect((await get(`/materials/${m._id}/preview`)).status).toBe(404)
  })
  it('rejects disguised thumbnails and excessive preview size without leaving private files',async()=>{
    const invalid=await post('/materials',seller).field('title','Bad image').field('price','10').attach('pdf',testPdf(),{filename:'notes.pdf',contentType:'application/pdf'}).attach('cover',Buffer.from('<svg/>'),{filename:'image.png',contentType:'image/png'})
    expect(invalid.status).toBe(400);expect(await fs.readdir(directory)).toEqual([])
    const huge=Buffer.alloc(3*1024*1024+1);huge.write('%PDF-')
    const large=await post('/materials',seller).field('title','Large preview').field('price','10').attach('pdf',testPdf(),{filename:'notes.pdf',contentType:'application/pdf'}).attach('preview',huge,{filename:'preview.pdf',contentType:'application/pdf'})
    expect(large.status).toBe(400);expect(await fs.readdir(directory)).toEqual([])
  })
  it('enforces draft, pending, approved, rejected and archived transitions and owner permissions',async()=>{
    const m=await material({status:'DRAFT'})
    expect((await patch(`/materials/${m._id}/state`,other).send({status:'PENDING'})).status).toBe(404)
    expect((await patch(`/materials/${m._id}/state`).send({status:'APPROVED'})).status).toBe(400)
    expect((await patch(`/materials/${m._id}`).send({title:'Edited draft'})).status).toBe(200)
    expect((await patch(`/materials/${m._id}/state`).send({status:'PENDING'})).status).toBe(200)
    expect((await patch(`/admin/materials/${m._id}/status`,admin).send({status:'REJECTED'})).status).toBe(400)
    expect((await patch(`/admin/materials/${m._id}/status`,admin).send({status:'REJECTED',moderationNote:'Improve formatting'})).status).toBe(200)
    expect((await patch(`/materials/${m._id}/state`).send({status:'PENDING'})).status).toBe(200)
    expect((await patch(`/admin/materials/${m._id}/status`,admin).send({status:'APPROVED'})).status).toBe(200)
    expect((await patch(`/materials/${m._id}`).send({title:'Unreviewed'})).status).toBe(409)
    expect((await patch(`/materials/${m._id}/state`).send({status:'ARCHIVED'})).status).toBe(200)
    expect((await patch(`/materials/${m._id}/state`).send({status:'DRAFT'})).status).toBe(200)
    expect(await Notification.countDocuments({user:seller.user._id})).toBe(2)
  })
  it('retains purchased archived PDFs and rejects deleting purchased material',async()=>{
    const m=await material(),o=await purchase(m)
    await patch(`/materials/${m._id}/state`).send({status:'ARCHIVED'})
    expect((await get('/materials/'+m._id)).status).toBe(404)
    expect((await request(app).delete(`/api/v1/materials/${m._id}`).auth(seller.token,{type:'bearer'})).status).toBe(409)
    const signed=await get(`/orders/${o._id}/download-token/${m._id}`)
    expect(signed.status).toBe(200);expect((await request(app).get(signed.body.url).auth(buyer.token,{type:'bearer'})).status).toBe(200)
  })
  it('deletes unpublished material with its PDF, preview and thumbnail',async()=>{
    const preview=path.join(directory,'preview.pdf'),cover=path.join(directory,'cover.png');await fs.writeFile(preview,testPdf());await fs.writeFile(cover,testPng)
    const m=await material({status:'DRAFT',previewPath:preview,coverImage:cover})
    expect((await request(app).delete(`/api/v1/materials/${m._id}`).auth(seller.token,{type:'bearer'})).status).toBe(200)
    expect(await fs.readdir(directory)).toEqual([])
  })
  it('preserves multiple cart items, prevents duplicates under concurrency and supports removal',async()=>{
    const a=await material(),b=await material({title:'Second notes'})
    await Promise.all([post('/cart/items/'+a._id),post('/cart/items/'+a._id)])
    await post('/cart/items/'+b._id)
    const cart=await get('/cart');expect(cart.body.items).toHaveLength(2);expect(JSON.stringify(cart.body)).not.toContain(directory)
    expect((await request(app).put('/api/v1/cart').auth(buyer.token,{type:'bearer'}).send({materialIds:[String(b._id)]})).status).toBe(200)
    expect((await get('/cart')).body.items).toHaveLength(1)
  })
  it('rejects unavailable cart additions, unpaid download access, wrong buyer and tampered tokens',async()=>{
    const m=await material({status:'PENDING'})
    expect((await post('/cart/items/'+m._id)).status).toBe(409)
    await Material.updateOne({_id:m._id},{status:'APPROVED'})
    const unpaid=await purchase(m,{paymentStatus:'PENDING'}),paid=await purchase(m)
    expect((await get(`/orders/${unpaid._id}/download-token/${m._id}`)).status).toBe(403)
    expect((await get(`/orders/${paid._id}/download-token/${m._id}`,other)).status).toBe(403)
    const signed=await get(`/orders/${paid._id}/download-token/${m._id}`)
    expect((await request(app).get(signed.body.url.slice(0,-5)+'x').auth(buyer.token,{type:'bearer'})).status).toBe(403)
    const payload=Buffer.from(JSON.stringify({uid:String(buyer.user._id),oid:String(paid._id),mid:String(m._id),exp:1})).toString('base64url')
    const signature=crypto.createHmac('sha256',process.env.JWT_ACCESS_SECRET||'ci-test-only-access-secret').update(payload).digest('base64url')
    expect((await get(`/orders/${paid._id}/download/${m._id}?token=${payload}.${signature}`)).status).toBe(403)
  })
  it('accepts only paid verified reviews and prevents duplicate reviews under concurrency',async()=>{
    const m=await material(),o=await purchase(m)
    expect((await post('/reviews',other).send({material:String(m._id),order:String(o._id),rating:5})).status).toBe(403)
    expect((await post('/reviews').send({material:String(m._id),order:String(o._id),rating:4.5})).status).toBe(400)
    const results=await Promise.all([post('/reviews').send({material:String(m._id),order:String(o._id),rating:5}),post('/reviews').send({material:String(m._id),order:String(o._id),rating:5})])
    expect(results.map(x=>x.status).sort()).toEqual([201,409]);expect((await get('/reviews')).body).toHaveLength(1)
    expect((await get('/reviews/'+m._id)).body[0].user.name).toBe('Test Student')
  })
  it('derives independent day/month/year analytics and popular notes from paid orders only',async()=>{
    const a=await material(),b=await material({seller:other.user._id}),bounds=reportingBoundaries()
    await purchase(a);await purchase(a,{paidAt:new Date(bounds.daily.from.getTime()-1000)});await purchase(a,{paidAt:new Date(bounds.monthly.from.getTime()-1000)});await purchase(a,{paymentStatus:'FAILED'});await purchase(b)
    const r=await get('/seller/analytics',seller)
    expect(r.status).toBe(200);expect(r.body.sales).toBe(3);expect(r.body.popular[0].sales).toBe(3);expect(r.body.months).toHaveLength(12);expect(r.body.periods.daily.sales).toBe(1)
    expect(new Date(r.body.periods.monthly.to).getTime()-new Date(r.body.periods.monthly.from).getTime()).toBeLessThan(new Date(r.body.periods.annual.to).getTime()-new Date(r.body.periods.annual.from).getTime())
    expect(r.body.months.every((x:any)=>/^\d{4}-\d{2}$/.test(x.month))).toBe(true)
    expect((await get('/seller/sales',seller)).body.every((x:any)=>x.items.every((i:any)=>i.seller===String(seller.user._id)))).toBe(true)
  })
  it('defines correct IST date boundaries across year changes',()=>{
    const b=reportingBoundaries(new Date('2026-01-01T00:00:00+05:30'))
    expect(b.daily.from.toISOString()).toBe('2025-12-31T18:30:00.000Z');expect(b.annual.to.toISOString()).toBe('2026-12-31T18:30:00.000Z')
  })
  it('scopes promotion CRUD to sellers and validates duplicate code/material ownership',async()=>{
    const m=await material({seller:other.user._id})
    expect((await post('/seller/promotions',seller).send({code:'STUDY10',discount:10,material:String(m._id)})).status).toBe(403)
    const r=await post('/seller/promotions',seller).send({code:'STUDY10',discount:10})
    expect(r.status).toBe(201);expect((await post('/seller/promotions',seller).send({code:'STUDY10',discount:20})).status).toBe(409)
    expect((await patch('/seller/promotions/'+r.body._id,other).send({active:false})).status).toBe(404)
    expect((await patch('/seller/promotions/'+r.body._id,seller).send({active:false,discount:15})).status).toBe(200)
  })
  it('persists profile and notification preferences without allowing role/verification changes',async()=>{
    const r=await patch('/users/me').send({name:'Seller',bio:'Teaching math',university:'Test University',phone:'123',notificationPreferences:{email:false,inApp:true},role:'SUPER_ADMIN',verified:true})
    expect(r.status).toBe(200);expect(r.body.role).toBe('USER');expect(r.body.verified).toBe(false);expect(r.body.bio).toBe('Teaching math')
    expect((await get('/users/me',seller)).body.notificationPreferences.email).toBe(false)
  })
  it('stores and scopes support tickets and rejects empty messages',async()=>{
    expect((await post('/support',seller).send({subject:'  ',message:'Empty'})).status).toBe(400)
    const r=await post('/support',seller).send({subject:'Upload help',message:'Need assistance',status:'RESOLVED',user:other.user._id})
    expect(r.status).toBe(201);expect(r.body.status).toBe('OPEN');expect((await get('/support',other)).body).toHaveLength(0)
  })
  it('authorizes material moderation and separates seller verification from email verification',async()=>{
    await material({status:'PENDING'})
    expect((await get('/admin/materials',seller)).status).toBe(403)
    const list=await get('/admin/sellers',admin);expect(list.body).toHaveLength(1)
    expect((await patch('/admin/sellers/'+seller.user._id,admin).send({sellerVerified:true})).status).toBe(200)
    const user=await User.findById(seller.user._id);expect(user!.sellerVerified).toBe(true);expect(user!.verified).toBe(false)
    expect((await patch('/admin/sellers/'+seller.user._id,buyer).send({sellerVerified:true})).status).toBe(403)
    const overview=await get('/admin/dashboard',admin);expect(overview.body.activeSellers).toBe(1);expect(overview.body.approved).toBe(0)
  })
})
