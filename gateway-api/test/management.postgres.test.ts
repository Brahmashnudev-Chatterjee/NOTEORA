import {afterAll,beforeAll,describe,it,expect,vi} from 'vitest'
import {PrismaClient} from '@prisma/client'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import http from 'node:http'
import crypto from 'node:crypto'
import {deliver} from '../src/webhookDelivery.js'
import {hash,verifySignature} from '../src/security.js'
const url=process.env.TEST_GATEWAY_DATABASE_URL
let db:PrismaClient,app:any,apiDB:PrismaClient,a:any,b:any,viewer:any,developer:any,manager:any,endpoint:any,key:any,receiver:http.Server,origin:string,received:any[]=[]
const password='OnlyDevelopmentPassword1!'
const adminToken=jwt.sign({iss:'noteora-marketplace',aud:'noteora-marketplace-api'},'test-only-introspection-fixture')
function post(path:string,token?:string){const r=request(app).post('/api/v1'+path).set('Origin','http://localhost:5174').set('X-Noteora-CSRF','1');return token?r.auth(token,{type:'bearer'}):r}
const get=(path:string,token:string)=>request(app).get('/api/v1'+path).auth(token,{type:'bearer'})
const patch=(path:string,token:string)=>request(app).patch('/api/v1'+path).auth(token,{type:'bearer'})
async function login(email:string){const r=await post('/auth/login').send({email,password});expect(r.status).toBe(200);return r.body.token}
async function approve(merchant:any,status='APPROVED'){
  const before=await db.merchant.findUniqueOrThrow({where:{id:merchant.id}})
  return patch('/admin/merchants/'+merchant.id+'/status',adminToken).send({status,expectedStatus:before.status,reason:'Isolated development review fixture'})
}
async function invite(role:string){
  const email=crypto.randomUUID()+'@example.com',r=await post('/merchant/team/invitations',a.token).send({name:'Team Fixture',email,role});expect(r.status).toBe(201)
  const accept=await post('/team/accept').send({token:r.body.inviteToken,password});expect(accept.status).toBe(201)
  return {email,id:(await db.merchantUser.findUniqueOrThrow({where:{email}})).id,token:await login(email),inviteToken:r.body.inviteToken}
}
async function enqueue(id=endpoint.id,idempotencyKey=crypto.randomUUID()){
  const r=await post('/merchant/webhooks/'+id+'/test',a.token).send({idempotencyKey});expect(r.status).toBe(202)
  return db.webhookDelivery.findFirstOrThrow({where:{event:{eventId:r.body.eventId}}})
}
describe.skipIf(!url).sequential('Phase E real PostgreSQL merchant management',()=>{
  beforeAll(async()=>{
    const parsed=new URL(url!);if(!['127.0.0.1','localhost'].includes(parsed.hostname)||!parsed.pathname.endsWith('_test'))throw new Error('Isolated loopback _test database required')
    process.env.DATABASE_URL=process.env.TEST_GATEWAY_RUNTIME_URL||url;process.env.MARKETPLACE_AUTH_URL='http://introspection.test'
    vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({id:'test-admin',role:'ADMIN'})})))
    db=new PrismaClient({datasources:{db:{url}}});const module=await import('../src/index.js');app=module.app;apiDB=module.prisma
    for(const label of ['A','B']){
      const email=crypto.randomUUID()+'@example.com',r=await post('/merchants/register').send({name:'Merchant '+label,businessName:'Business '+label,contactName:'Owner '+label,contactEmail:email,contactPhone:'9999999999',businessType:'Education',password})
      expect(r.status).toBe(201);const actor={id:r.body.id,email,token:await login(email)};if(label==='A')a=actor;else b=actor
    }
    receiver=http.createServer(async(req,res)=>{let raw='';for await(const chunk of req)raw+=chunk;received.push({raw,headers:req.headers});res.writeHead(req.url==='/fail'?503:200);res.end('Receiver deliberately does not echo any secrets')})
    await new Promise<void>(resolve=>receiver.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+(receiver.address() as any).port;process.env.GATEWAY_WEBHOOK_DEV_ORIGINS=origin
  },30000)
  afterAll(async()=>{vi.unstubAllGlobals();await new Promise<void>(r=>receiver?.close(()=>r()));if(db){await db.merchant.deleteMany({where:{id:{in:[a?.id,b?.id].filter(Boolean)}}});await db.$disconnect()}await apiDB?.$disconnect()})
  it('keeps registration pending and denies credential provisioning before review',async()=>{
    expect((await get('/merchant/me',a.token)).body.status).toBe('PENDING')
    expect((await post('/merchant/api-keys',a.token).send({environment:'SANDBOX'})).status).toBe(409)
  })
  it('requires real administrator identity and recorded reasons; rejects stale review',async()=>{
    const path='/admin/merchants/'+a.id+'/status'
    expect((await patch(path,a.token).send({status:'APPROVED',expectedStatus:'PENDING',reason:'No'})).status).toBe(403)
    expect((await patch(path,adminToken).send({status:'REJECTED',expectedStatus:'PENDING'})).status).toBe(400)
    expect((await approve(a,'REJECTED')).status).toBe(200);expect((await get('/merchant/me',a.token)).status).toBe(401)
    expect((await approve(a)).status).toBe(200);a.token=await login(a.email)
    expect((await patch(path,adminToken).send({status:'SUSPENDED',expectedStatus:'PENDING',reason:'Stale'})).status).toBe(409)
    expect((await approve(b)).status).toBe(200)
  })
  it('supports search, accurate partial-status counts and secret-free administrator detail',async()=>{
    const list=await get('/admin/merchants?q=Business%20A&status=APPROVED',adminToken);expect(list.body.items.some((x:any)=>x.id===a.id)).toBe(true)
    const counts=await get('/admin/overview',adminToken);expect(counts.body.total).toBeGreaterThanOrEqual(2)
    const detail=await get('/admin/merchants/'+a.id,adminToken);expect(detail.status).toBe(200);expect(JSON.stringify(detail.body)).not.toContain('passwordHash')
  })
  it('creates expiring hashed invitations; acceptance is single-use',async()=>{
    viewer=await invite('MERCHANT_VIEWER');developer=await invite('MERCHANT_DEVELOPER');manager=await invite('MERCHANT_ADMIN')
    expect((await post('/team/accept').send({token:viewer.inviteToken,password})).status).toBe(400)
    const row=await db.merchantInvitation.findUniqueOrThrow({where:{tokenHash:hash(viewer.inviteToken)}});expect(row.tokenHash).not.toBe(viewer.inviteToken);expect(row.acceptedAt).toBeTruthy()
    expect(JSON.stringify((await get('/merchant/team',a.token)).body)).not.toContain(viewer.inviteToken)
  },20000)
  it('rejects expired and revoked invitations',async()=>{
    for(const expired of [true,false]){
      const r=await post('/merchant/team/invitations',a.token).send({name:'Unused Invite',email:crypto.randomUUID()+'@example.com',role:'MERCHANT_VIEWER'});expect(r.status).toBe(201)
      if(expired)await db.merchantInvitation.update({where:{id:r.body.id},data:{expiresAt:new Date(0)}})
      else expect((await post('/merchant/team/invitations/'+r.body.id+'/revoke',a.token).send({})).status).toBe(200)
      expect((await post('/team/accept').send({token:r.body.inviteToken,password})).status).toBe(400)
    }
  })
  it('enforces role permissions and prevents administrator privilege escalation',async()=>{
    expect((await post('/merchant/team/invitations',viewer.token).send({})).status).toBe(403)
    expect((await post('/merchant/team/invitations',developer.token).send({})).status).toBe(403)
    expect((await post('/merchant/team/invitations',manager.token).send({name:'Escalate',email:crypto.randomUUID()+'@example.com',role:'MERCHANT_OWNER'})).status).toBe(403)
    expect((await patch('/merchant/team/'+manager.id,manager.token).send({role:'MERCHANT_OWNER'})).status).toBe(403)
    expect((await post('/merchant/api-keys',viewer.token).send({environment:'SANDBOX'})).status).toBe(403)
    const ownerInvite=await post('/merchant/team/invitations',a.token).send({name:'Owner Invite',email:crypto.randomUUID()+'@example.com',role:'MERCHANT_OWNER'});expect(ownerInvite.status).toBe(201)
    expect((await post('/merchant/team/invitations/'+ownerInvite.body.id+'/revoke',manager.token).send({})).status).toBe(403)
  })
  it('protects the final owner and enforces cross-merchant member isolation',async()=>{
    const owner=await db.merchantUser.findUniqueOrThrow({where:{email:a.email}})
    expect((await patch('/merchant/team/'+owner.id,a.token).send({role:'MERCHANT_VIEWER'})).status).toBe(409)
    expect((await patch('/merchant/team/'+viewer.id,b.token).send({active:false})).status).toBe(404)
    expect((await get('/merchant/team',b.token)).body.members.some((m:any)=>m.id===viewer.id)).toBe(false)
  })
  it('revokes sessions immediately after member role changes and access removal',async()=>{
    expect((await patch('/merchant/team/'+viewer.id,a.token).send({role:'MERCHANT_DEVELOPER'})).status).toBe(200)
    expect((await get('/merchant/me',viewer.token)).status).toBe(401)
    viewer.token=await login(viewer.email)
    expect((await patch('/merchant/team/'+viewer.id,a.token).send({active:false})).status).toBe(200)
    expect((await get('/merchant/me',viewer.token)).status).toBe(401)
  })
  it('generates cryptographic credentials, stores hashes only and authenticates a scoped resource',async()=>{
    const r=await post('/merchant/api-keys',developer.token).send({environment:'SANDBOX'});expect(r.status).toBe(201);key=r.body
    const stored=await db.merchantCredential.findUniqueOrThrow({where:{id:key.id}});expect(stored.apiKey).toBe(hash(key.apiKey));expect(stored.apiSecretHash).toBe(hash(key.apiSecret))
    const context=await request(app).get('/api/v1/integration/context').set('X-API-Key',key.apiKey).set('X-API-Secret',key.apiSecret).set('X-Noteora-Environment','SANDBOX');expect(context.status).toBe(200);expect(context.body).toMatchObject({merchantId:a.id,paymentsEnabled:false})
    expect(JSON.stringify((await get('/merchant/api-keys',a.token)).body)).not.toContain(key.apiKey)
    expect(JSON.stringify((await get('/admin/merchants/'+a.id,adminToken)).body)).not.toContain(stored.apiSecretHash)
  })
  it('denies wrong secrets, expired keys and live environment access',async()=>{
    const check=(k:any,environment='SANDBOX')=>post('/credentials/verify').send({apiKey:k.apiKey,apiSecret:k.apiSecret,environment})
    expect((await check({...key,apiSecret:'a'.repeat(64)})).status).toBe(401);expect((await check(key,'LIVE')).status).toBe(401)
    await db.merchantCredential.update({where:{id:key.id},data:{expiresAt:new Date(0)}});expect((await check(key)).status).toBe(401)
    const live=await post('/merchant/api-keys',a.token).send({environment:'LIVE'});expect(live.status).toBe(201);expect((await check(live.body,'LIVE')).status).toBe(403)
    expect((await post('/merchant/api-keys',a.token).send({environment:'SANDBOX',expiresAt:new Date(0).toISOString()})).status).toBe(400)
  })
  it('serializes simultaneous rotations and supports scoped revocation',async()=>{
    const results=await Promise.all([post('/merchant/api-keys',a.token).send({environment:'SANDBOX'}),post('/merchant/api-keys',a.token).send({environment:'SANDBOX'})]);expect(results.map(r=>r.status)).toEqual([201,201])
    expect(await db.merchantCredential.count({where:{merchantId:a.id,environment:'SANDBOX',active:true}})).toBe(1)
    const active=await db.merchantCredential.findFirstOrThrow({where:{merchantId:a.id,environment:'SANDBOX',active:true}})
    expect((await post('/merchant/api-keys/'+active.id+'/revoke',b.token).send({})).status).toBe(404)
    expect((await post('/merchant/api-keys/'+active.id+'/revoke',a.token).send({})).status).toBe(200)
    const r=results.find(x=>x.body.id===active.id)!;expect((await post('/credentials/verify').send({...r.body,environment:'SANDBOX',id:undefined,notice:undefined,liveProcessingEnabled:undefined})).status).toBe(401)
  })
  it('rejects unsafe destinations and fabricated payment event subscriptions',async()=>{
    for(const bad of ['http://example.com','https://127.0.0.1/hook','https://169.254.169.254/','https://user:pass@example.com/hook']){
      expect((await request(app).put('/api/v1/merchant/webhooks').auth(a.token,{type:'bearer'}).send({environment:'SANDBOX',url:bad,active:true,eventSubscriptions:['gateway.test']})).status).toBe(400)
    }
    expect((await request(app).put('/api/v1/merchant/webhooks').auth(a.token,{type:'bearer'}).send({environment:'SANDBOX',url:origin+'/ok',active:true,eventSubscriptions:['order.paid']})).status).toBe(400)
  })
  it('stores encrypted webhook secrets and prevents cross-merchant endpoint changes',async()=>{
    const r=await request(app).put('/api/v1/merchant/webhooks').auth(a.token,{type:'bearer'}).send({environment:'SANDBOX',url:origin+'/ok',active:true,eventSubscriptions:['gateway.test']});expect(r.status).toBe(201);endpoint=r.body
    const stored=await db.webhookEndpoint.findUniqueOrThrow({where:{id:endpoint.id}});expect(stored.signingSecretEncrypted).not.toContain(endpoint.signingSecret);expect(stored.signingSecretHash).toBe(hash(endpoint.signingSecret))
    expect(JSON.stringify((await get('/merchant/webhooks',a.token)).body)).not.toContain(stored.signingSecretEncrypted)
    expect((await request(app).put('/api/v1/merchant/webhooks').auth(b.token,{type:'bearer'}).send({id:endpoint.id,environment:'SANDBOX',url:origin+'/ok',active:true,eventSubscriptions:['gateway.test']})).status).toBe(404)
  })
  it('deduplicates concurrent test events and delivery claims; verifies real HTTP signatures',async()=>{
    const idempotencyKey=crypto.randomUUID(),events=await Promise.all([enqueue(endpoint.id,idempotencyKey),enqueue(endpoint.id,idempotencyKey)])
    expect(events[0].id).toBe(events[1].id);const before=received.length
    await Promise.all([deliver(db,events[0].id),deliver(db,events[0].id)])
    expect(received.length-before).toBe(1);const last=received.at(-1)
    expect(verifySignature(endpoint.signingSecret,last.headers['x-noteora-timestamp'],last.raw,last.headers['x-noteora-signature'])).toBe(true)
    expect(JSON.parse(last.raw)).toMatchObject({event:'gateway.test',test:true,environment:'SANDBOX'})
    expect((await db.webhookDelivery.findUniqueOrThrow({where:{id:events[0].id}})).status).toBe('DELIVERED')
    expect((await get('/merchant/webhook-deliveries',b.token)).body).toEqual([])
  })
  it('records failed attempts, exponential backoff and terminal failure without leaking receiver bodies',async()=>{
    const r=await request(app).put('/api/v1/merchant/webhooks').auth(a.token,{type:'bearer'}).send({environment:'SANDBOX',url:origin+'/fail',active:true,eventSubscriptions:['gateway.test']});expect(r.status).toBe(201)
    const row=await enqueue(r.body.id)
    for(let i=1;i<=5;i++){
      const before=Date.now();await deliver(db,row.id);const actual=await db.webhookDelivery.findUniqueOrThrow({where:{id:row.id}})
      expect(actual.attempts).toBe(i);expect(actual.nextAttemptAt.getTime()-before).toBeGreaterThanOrEqual(1000*2**(i-1)-50)
      expect(actual.status).toBe(i===5?'FAILED':'RETRY');expect(actual.responseBody).toBeNull()
      await db.webhookDelivery.update({where:{id:row.id},data:{nextAttemptAt:new Date(0)}})
    }
    expect(await db.webhookAttempt.count({where:{deliveryId:row.id}})).toBe(5);const before=received.length;await deliver(db,row.id);expect(received.length).toBe(before)
  })
  it('cancels delivery when configuration is disabled and disallows live test events',async()=>{
    const row=await enqueue();await db.webhookEndpoint.update({where:{id:endpoint.id},data:{active:false}});expect((await deliver(db,row.id)).status).toBe('CANCELLED')
    const live=await request(app).put('/api/v1/merchant/webhooks').auth(a.token,{type:'bearer'}).send({environment:'LIVE',url:origin+'/live',active:true,eventSubscriptions:['gateway.test']});expect(live.status).toBe(201)
    expect((await post('/merchant/webhooks/'+live.body.id+'/test',a.token).send({idempotencyKey:crypto.randomUUID()})).status).toBe(409)
  })
  it('rechecks merchant status for sessions and keys and records auditable transitions',async()=>{
    const k=await post('/merchant/api-keys',a.token).send({environment:'SANDBOX'});expect(k.status).toBe(201)
    expect((await approve(a,'SUSPENDED')).status).toBe(200);expect((await get('/merchant/me',a.token)).status).toBe(401)
    expect((await post('/credentials/verify').send({apiKey:k.body.apiKey,apiSecret:k.body.apiSecret,environment:'SANDBOX'})).status).toBe(403)
    expect((await post('/auth/login').send({email:a.email,password})).status).toBe(403)
    expect((await approve(a,'DISABLED')).status).toBe(200);expect((await post('/auth/login').send({email:a.email,password})).status).toBe(403)
    expect((await approve(a)).status).toBe(200);a.token=await login(a.email)
    const logs=await db.gatewayAuditLog.findMany({where:{merchantId:a.id}});expect(logs.some(x=>x.action==='MERCHANT_REJECTED'&&(x.details as any).reason)).toBe(true)
    expect(JSON.stringify(logs)).not.toContain(k.body.apiSecret);expect(JSON.stringify(logs)).not.toContain(endpoint.signingSecret)
  })
  it('requires renewed review for business identity changes and has no audit mutation endpoint',async()=>{
    expect((await patch('/merchant/me',a.token).send({businessName:'Updated Business A'})).body.status).toBe('UNDER_REVIEW')
    expect((await post('/merchant/api-keys',a.token).send({environment:'SANDBOX'})).status).toBe(409)
    expect((await patch('/merchant/me',a.token).send({status:'APPROVED'})).status).toBe(400)
    expect((await request(app).delete('/api/v1/merchant/activity').auth(a.token,{type:'bearer'})).status).toBe(404)
    const audit=await db.gatewayAuditLog.findFirstOrThrow({where:{merchantId:a.id}})
    await expect(db.gatewayAuditLog.update({where:{id:audit.id},data:{action:'FORGED_HISTORY'}})).rejects.toThrow()
    await expect(db.gatewayAuditLog.delete({where:{id:audit.id}})).rejects.toThrow()
    expect((await db.gatewayAuditLog.findUniqueOrThrow({where:{id:audit.id}})).action).toBe(audit.action)
  })
})
