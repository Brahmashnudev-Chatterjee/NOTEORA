import type {Express,Request,RequestHandler} from 'express'
import {z} from 'zod'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import type {PrismaClient,Prisma} from '@prisma/client'
import {hash,secret,encrypt,destination} from './security.js'

const OWNER='MERCHANT_OWNER',ADMIN='MERCHANT_ADMIN',DEV='MERCHANT_DEVELOPER'
const roles=z.enum([OWNER,ADMIN,DEV,'MERCHANT_VIEWER'])
const env=z.enum(['SANDBOX','LIVE'])
const status=z.enum(['PENDING','UNDER_REVIEW','APPROVED','REJECTED','SUSPENDED','DISABLED'])
const memberSelect={id:true,name:true,email:true,role:true,active:true,createdAt:true,lastLoginAt:true}
const keySelect={id:true,environment:true,active:true,createdAt:true,expiresAt:true,revokedAt:true,secretVersion:true}
const endpointSelect={id:true,environment:true,url:true,active:true,eventSubscriptions:true,createdAt:true,updatedAt:true}
const fail=(code:number,message:string):never=>{throw Object.assign(new Error(message),{status:code})}
const principal=(req:Request)=>(req as any).user as {merchantId:string,userId:string,role:string}
const entry=(req:Request,action:string,entity:string,entityId:string,details:any={})=>({merchantId:principal(req).merchantId,actorType:'MERCHANT_USER',actorId:principal(req).userId,action,entity,entityId,details})
export function installManagement(app:Express,db:PrismaClient,m:{authMerchant:RequestHandler;requireAdmin:RequestHandler;requireMerchantPermission:(...roles:any[])=>RequestHandler}){
  const auth=m.authMerchant,admin=m.requireAdmin,permission=m.requireMerchantPermission
  // Serialize merchant mutations, including last-owner decisions and concurrent key rotations.
  async function mutate<T>(req:Request,allowed:string[],work:(tx:Prisma.TransactionClient)=>Promise<T>){
    const p=principal(req)
    return db.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM gateway."Merchant" WHERE id=${p.merchantId}::uuid FOR UPDATE`
      const [actor,merchant]=await Promise.all([tx.merchantUser.findUnique({where:{id:p.userId}}),tx.merchant.findUnique({where:{id:p.merchantId}})])
      if(!actor?.active||actor.merchantId!==p.merchantId||!allowed.includes(actor.role)||!merchant||['SUSPENDED','REJECTED','DISABLED'].includes(merchant.status))fail(403,'Merchant action is not permitted')
      return work(tx)
    })
  }
  app.get('/api/v1/merchant/me',auth,async(req,res)=>res.json({...await db.merchant.findUnique({where:{id:principal(req).merchantId},include:{users:{select:memberSelect}}}),currentRole:principal(req).role}))
  app.patch('/api/v1/merchant/me',auth,permission(OWNER,ADMIN),async(req,res)=>{
    const input=z.object({name:z.string().trim().min(2).max(120).optional(),businessName:z.string().trim().min(2).max(160).optional(),businessType:z.string().trim().min(2).max(80).optional(),contactName:z.string().trim().min(2).max(120).optional(),contactEmail:z.string().email().optional(),contactPhone:z.string().min(8).max(30).optional(),website:z.string().url().max(2000).nullable().optional(),address:z.object({line1:z.string().max(200),city:z.string().max(100),state:z.string().max(100),postalCode:z.string().max(20),country:z.string().max(80)}).optional()}).strict().parse(req.body)
    const merchant=await mutate(req,[OWNER,ADMIN],async tx=>{
      const before=await tx.merchant.findUniqueOrThrow({where:{id:principal(req).merchantId}})
      const businessChanged=['businessName','businessType','contactEmail','address'].some(k=>k in input&&JSON.stringify((input as any)[k])!==JSON.stringify((before as any)[k]))
      const row=await tx.merchant.update({where:{id:before.id},data:{...input,...businessChanged&&before.status==='APPROVED'?{status:'UNDER_REVIEW',reviewedAt:null,reviewedBy:null}:{}}})
      await tx.gatewayAuditLog.create({data:entry(req,'MERCHANT_PROFILE_UPDATED','MERCHANT',row.id,{fields:Object.keys(input),previousStatus:before.status,status:row.status})});return row
    });res.json(merchant)
  })
  app.get('/api/v1/admin/overview',admin,async(_req,res)=>{
    const groups=await db.merchant.groupBy({by:['status'],_count:{_all:true}}),counts=Object.fromEntries(groups.map(x=>[x.status,x._count._all]))
    res.json({total:groups.reduce((s,x)=>s+x._count._all,0),...Object.fromEntries(status.options.map(s=>[s.toLowerCase(),counts[s]||0]))})
  })
  app.get('/api/v1/admin/merchants',admin,async(req,res)=>{
    const input=z.object({status:status.optional(),q:z.string().max(120).optional(),page:z.coerce.number().int().min(1).max(10000).default(1)}).parse(req.query)
    const where:any={...(input.status?{status:input.status}:{}),...(input.q?{OR:['businessName','name','contactEmail'].map(field=>({[field]:{contains:input.q,mode:'insensitive'}}))}:{})}
    const [items,total]=await Promise.all([db.merchant.findMany({where,skip:(input.page-1)*25,take:25,orderBy:[{createdAt:'desc'},{id:'asc'}]}),db.merchant.count({where})]);res.json({items,total,page:input.page,pageSize:25})
  })
  app.get('/api/v1/admin/merchants/:id',admin,async(req,res)=>{
    const id=z.string().uuid().parse(req.params.id),merchant=await db.merchant.findUnique({where:{id},include:{users:{select:memberSelect},credentials:{select:keySelect},webhookEndpoints:{select:endpointSelect},auditLogs:{take:100,orderBy:{createdAt:'desc'}}}})
    if(!merchant)fail(404,'Merchant not found');res.json(merchant)
  })
  app.patch('/api/v1/admin/merchants/:id/status',admin,async(req,res)=>{
    const id=z.string().uuid().parse(req.params.id),input=z.object({status,expectedStatus:status,reason:z.string().trim().min(1).max(500)}).strict().parse(req.body)
    const result=await db.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM gateway."Merchant" WHERE id=${id}::uuid FOR UPDATE`
      const before=await tx.merchant.findUnique({where:{id}});if(!before)fail(404,'Merchant not found')
      if(before!.status!==input.expectedStatus||before!.status===input.status)fail(409,'Merchant status changed; reload before reviewing')
      const row=await tx.merchant.update({where:{id},data:{status:input.status,rejectionReason:input.status==='REJECTED'?input.reason:null,reviewedBy:(req as any).admin.id,reviewedAt:new Date(),onboardingStep:input.status==='APPROVED'?4:before!.onboardingStep}})
      if(['REJECTED','SUSPENDED','DISABLED'].includes(input.status))await tx.merchantUser.updateMany({where:{merchantId:id},data:{authVersion:{increment:1},authFamily:null,authExpiresAt:null}})
      await tx.gatewayAuditLog.create({data:{merchantId:id,actorType:'ADMIN',actorId:(req as any).admin.id,action:'MERCHANT_'+input.status,entity:'MERCHANT',entityId:id,details:{previousStatus:before!.status,status:input.status,reason:input.reason}}});return row
    });res.json(result)
  })
  app.get('/api/v1/merchant/team',auth,async(req,res)=>res.json({members:await db.merchantUser.findMany({where:{merchantId:principal(req).merchantId},select:memberSelect,orderBy:{createdAt:'asc'}}),invitations:await db.merchantInvitation.findMany({where:{merchantId:principal(req).merchantId},select:{id:true,email:true,name:true,role:true,expiresAt:true,acceptedAt:true,revokedAt:true},orderBy:{createdAt:'desc'},take:100})}))
  app.post('/api/v1/merchant/team/invitations',auth,permission(OWNER,ADMIN),async(req,res)=>{
    const input=z.object({name:z.string().trim().min(2).max(120),email:z.string().email().transform(s=>s.toLowerCase()),role:roles}).strict().parse(req.body),token=secret()
    const invitation=await mutate(req,[OWNER,ADMIN],async tx=>{
      const actor=await tx.merchantUser.findUniqueOrThrow({where:{id:principal(req).userId}})
      if(actor.role!==OWNER&&[OWNER,ADMIN].includes(input.role))fail(403,'Only an owner may appoint owners or administrators')
      if(await tx.merchantUser.findUnique({where:{email:input.email}}))fail(409,'An account already uses this email')
      await tx.merchantInvitation.updateMany({where:{merchantId:principal(req).merchantId,email:input.email,acceptedAt:null,revokedAt:null},data:{revokedAt:new Date()}})
      const row=await tx.merchantInvitation.create({data:{...input,merchantId:principal(req).merchantId,tokenHash:hash(token),expiresAt:new Date(Date.now()+48*3600000)}})
      await tx.gatewayAuditLog.create({data:entry(req,'TEAM_INVITED','INVITATION',row.id,{email:input.email,role:input.role})});return row
    });res.status(201).json({id:invitation.id,inviteToken:token,expiresAt:invitation.expiresAt,notice:'Share this single-use invitation securely. Email delivery is not configured.'})
  })
  app.post('/api/v1/team/accept',async(req,res)=>{
    const input=z.object({token:z.string().regex(/^[a-f0-9]{64}$/),password:z.string().min(12).refine(x=>Buffer.byteLength(x,'utf8')<=72)}).strict().parse(req.body)
    const passwordHash=await bcrypt.hash(input.password,12)
    await db.$transaction(async tx=>{
      const invite=await tx.merchantInvitation.findUnique({where:{tokenHash:hash(input.token)}});if(!invite)fail(400,'Invalid invitation')
      await tx.$queryRaw`SELECT id FROM gateway."Merchant" WHERE id=${invite!.merchantId}::uuid FOR UPDATE`
      const merchant=await tx.merchant.findUnique({where:{id:invite!.merchantId}});if(!merchant||['REJECTED','SUSPENDED','DISABLED'].includes(merchant.status))fail(403,'Merchant is inactive')
      const claim=await tx.merchantInvitation.updateMany({where:{id:invite!.id,acceptedAt:null,revokedAt:null,expiresAt:{gt:new Date()}},data:{acceptedAt:new Date()}});if(!claim.count)fail(400,'Invitation is expired or already used')
      const member=await tx.merchantUser.create({data:{merchantId:invite!.merchantId,name:invite!.name,email:invite!.email,role:invite!.role,passwordHash}})
      await tx.gatewayAuditLog.create({data:{merchantId:invite!.merchantId,actorType:'MERCHANT_USER',actorId:member.id,action:'TEAM_INVITATION_ACCEPTED',entity:'MERCHANT_USER',entityId:member.id}})
    });res.status(201).json({accepted:true})
  })
  app.post('/api/v1/merchant/team/invitations/:id/revoke',auth,permission(OWNER,ADMIN),async(req,res)=>{
    const id=z.string().uuid().parse(req.params.id)
    await mutate(req,[OWNER,ADMIN],async tx=>{const row=await tx.merchantInvitation.findFirst({where:{id,merchantId:principal(req).merchantId}});if(!row)fail(404,'Invitation not found');const actor=await tx.merchantUser.findUniqueOrThrow({where:{id:principal(req).userId}});if(actor.role!==OWNER&&[OWNER,ADMIN].includes(row!.role))fail(403,'Owner permission required');await tx.merchantInvitation.update({where:{id},data:{revokedAt:new Date()}});await tx.gatewayAuditLog.create({data:entry(req,'TEAM_INVITATION_REVOKED','INVITATION',id)})});res.json({revoked:true})
  })
  app.patch('/api/v1/merchant/team/:id',auth,permission(OWNER,ADMIN),async(req,res)=>{
    const id=z.string().uuid().parse(req.params.id),input=z.object({role:roles.optional(),active:z.literal(false).optional()}).strict().refine(x=>x.role||x.active===false).parse(req.body)
    await mutate(req,[OWNER,ADMIN],async tx=>{
      const member=await tx.merchantUser.findFirst({where:{id,merchantId:principal(req).merchantId}});if(!member)fail(404,'Member not found')
      const actor=await tx.merchantUser.findUniqueOrThrow({where:{id:principal(req).userId}})
      if(actor.role!==OWNER&&([OWNER,ADMIN].includes(member!.role)||input.role&&[OWNER,ADMIN].includes(input.role)))fail(403,'Owner permission required')
      if(member!.role===OWNER&&(input.role&&input.role!==OWNER||input.active===false)&&await tx.merchantUser.count({where:{merchantId:member!.merchantId,role:OWNER,active:true}})<=1)fail(409,'The last active owner cannot be removed')
      await tx.merchantUser.update({where:{id},data:{...input,authVersion:{increment:1},authFamily:null,authExpiresAt:null}})
      await tx.gatewayAuditLog.create({data:entry(req,'TEAM_MEMBER_CHANGED','MERCHANT_USER',id,{previousRole:member!.role,...input})})
    });res.json({updated:true})
  })
  app.get('/api/v1/merchant/api-keys',auth,async(req,res)=>res.json(await db.merchantCredential.findMany({where:{merchantId:principal(req).merchantId},select:keySelect,orderBy:{createdAt:'desc'}})))
  app.post('/api/v1/merchant/api-keys',auth,permission(OWNER,ADMIN,DEV),async(req,res)=>{
    const input=z.object({environment:env,expiresAt:z.string().datetime().optional()}).strict().parse(req.body)
    if(input.expiresAt&&new Date(input.expiresAt)<=new Date())fail(400,'Key expiration must be in the future')
    const apiKey=(input.environment==='LIVE'?'nk_live_':'nk_test_')+secret(),apiSecret=secret()
    const row=await mutate(req,[OWNER,ADMIN,DEV],async tx=>{
      const merchant=await tx.merchant.findUniqueOrThrow({where:{id:principal(req).merchantId}});if(merchant.status!=='APPROVED')fail(409,'Merchant approval required')
      const revoked=await tx.merchantCredential.findMany({where:{merchantId:merchant.id,environment:input.environment,active:true},select:{id:true}})
      await tx.merchantCredential.updateMany({where:{merchantId:merchant.id,environment:input.environment,active:true},data:{active:false,revokedAt:new Date()}})
      for(const old of revoked)await tx.gatewayAuditLog.create({data:entry(req,'API_KEY_REVOKED','MERCHANT_CREDENTIAL',old.id,{reason:'rotation',environment:input.environment})})
      const row=await tx.merchantCredential.create({data:{merchantId:merchant.id,environment:input.environment,apiKey:hash(apiKey),apiSecretHash:hash(apiSecret),expiresAt:input.expiresAt?new Date(input.expiresAt):null}})
      await tx.gatewayAuditLog.create({data:entry(req,'API_KEY_CREATED','MERCHANT_CREDENTIAL',row.id,{environment:input.environment})});return row
    });res.status(201).json({id:row.id,environment:row.environment,apiKey,apiSecret,liveProcessingEnabled:false,notice:'Save these secrets now. They cannot be retrieved again.'})
  })
  app.post('/api/v1/merchant/api-keys/:id/revoke',auth,permission(OWNER,ADMIN),async(req,res)=>{
    const id=z.string().uuid().parse(req.params.id)
    await mutate(req,[OWNER,ADMIN],async tx=>{const row=await tx.merchantCredential.findFirst({where:{id,merchantId:principal(req).merchantId}});if(!row)fail(404,'Credential not found');await tx.merchantCredential.update({where:{id},data:{active:false,revokedAt:new Date()}});await tx.gatewayAuditLog.create({data:entry(req,'API_KEY_REVOKED','MERCHANT_CREDENTIAL',id)})});res.json({revoked:true})
  })
  const keyAuth:RequestHandler=async(req,res,next)=>{
    const environment=z.enum(['SANDBOX','LIVE']).safeParse(req.headers['x-noteora-environment'])
    const apiKey=String(req.headers['x-api-key']||''),apiSecret=String(req.headers['x-api-secret']||'')
    if(!environment.success||apiKey.length>200||apiSecret.length>200||!apiKey||!apiSecret)return res.status(401).json({error:'Valid API credentials and environment required'})
    const row=await db.merchantCredential.findUnique({where:{apiKey:hash(apiKey)}})
    if(!row||row.environment!==environment.data||!row.active||row.expiresAt&&row.expiresAt<=new Date()||!crypto.timingSafeEqual(Buffer.from(row.apiSecretHash),Buffer.from(hash(apiSecret))))return res.status(401).json({error:'Invalid or expired API credentials'})
    const merchant=await db.merchant.findUnique({where:{id:row.merchantId}});if(merchant?.status!=='APPROVED')return res.status(403).json({error:'Merchant approval required'})
    if(row.environment==='LIVE')return res.status(403).json({error:'Live resource access is disabled; keys are provisioning only'})
    ;(req as any).credential={merchantId:row.merchantId,environment:row.environment};next()
  }
  app.get('/api/v1/integration/context',keyAuth,(req,res)=>res.json({...((req as any).credential),paymentsEnabled:false}))
  app.post('/api/v1/credentials/verify',async(req,res,next)=>{z.object({apiKey:z.string().min(10).max(200),apiSecret:z.string().min(10).max(200),environment:env}).strict().parse(req.body);req.headers['x-api-key']=req.body.apiKey;req.headers['x-api-secret']=req.body.apiSecret;req.headers['x-noteora-environment']=req.body.environment;await keyAuth(req,res,()=>res.json({valid:true,...(req as any).credential,paymentsEnabled:false}))})
  app.get('/api/v1/merchant/webhooks',auth,async(req,res)=>res.json(await db.webhookEndpoint.findMany({where:{merchantId:principal(req).merchantId},select:endpointSelect,orderBy:{createdAt:'desc'}})))
  app.put('/api/v1/merchant/webhooks',auth,permission(OWNER,ADMIN,DEV),async(req,res)=>{
    const input=z.object({id:z.string().uuid().optional(),environment:env,url:z.string().url().max(2000),active:z.boolean(),eventSubscriptions:z.array(z.literal('gateway.test')).max(1)}).strict().parse(req.body)
    await destination(input.url);const signingSecret=secret()
    const row=await mutate(req,[OWNER,ADMIN,DEV],async tx=>{
      const merchant=await tx.merchant.findUniqueOrThrow({where:{id:principal(req).merchantId}});if(merchant.status!=='APPROVED')fail(409,'Merchant approval required')
      const existing=input.id?await tx.webhookEndpoint.findFirst({where:{id:input.id,merchantId:merchant.id}}):await tx.webhookEndpoint.findFirst({where:{merchantId:merchant.id,environment:input.environment,url:input.url}})
      if(input.id&&!existing)fail(404,'Endpoint not found')
      const data={merchantId:merchant.id,environment:input.environment,url:input.url,active:input.active,eventSubscriptions:input.eventSubscriptions,signingSecretHash:hash(signingSecret),signingSecretEncrypted:encrypt(signingSecret)}
      const row=existing?await tx.webhookEndpoint.update({where:{id:existing.id},data}):await tx.webhookEndpoint.create({data})
      await tx.gatewayAuditLog.create({data:entry(req,'WEBHOOK_CONFIGURED','WEBHOOK_ENDPOINT',row.id,{environment:input.environment,active:input.active})});return row
    });res.status(201).json({id:row.id,signingSecret,notice:'Save this signing secret now. Saving configuration rotates it.'})
  })
  app.post('/api/v1/merchant/webhooks/:id/test',auth,permission(OWNER,ADMIN,DEV),async(req,res)=>{
    const id=z.string().uuid().parse(req.params.id),input=z.object({idempotencyKey:z.string().regex(/^[a-zA-Z0-9_-]{8,100}$/)}).strict().parse(req.body)
    const event=await mutate(req,[OWNER,ADMIN,DEV],async tx=>{
      const merchant=await tx.merchant.findUniqueOrThrow({where:{id:principal(req).merchantId}});if(merchant.status!=='APPROVED')fail(409,'Merchant approval required')
      const endpoint=await tx.webhookEndpoint.findFirst({where:{id,merchantId:merchant.id,environment:'SANDBOX',active:true}})
      if(!endpoint||!endpoint.eventSubscriptions.includes('gateway.test'))fail(409,'Active sandbox endpoint subscribed to gateway.test required')
      const eventId='test_'+hash(merchant.id+':'+id+':'+input.idempotencyKey)
      const existing=await tx.webhookEvent.findUnique({where:{eventId}});if(existing)return existing
      const row=await tx.webhookEvent.create({data:{merchantId:merchant.id,eventId,eventType:'gateway.test',sequence:1,payload:{eventId,event:'gateway.test',environment:'SANDBOX',test:true,merchantId:merchant.id,message:'Connectivity test only. No transaction or payment exists.'}}})
      await tx.webhookDelivery.create({data:{endpointId:id,eventId:row.id}})
      await tx.webhookOutbox.create({data:{eventId:row.id,eventType:'gateway.test',payload:{merchantId:merchant.id}}})
      await tx.gatewayAuditLog.create({data:entry(req,'WEBHOOK_TEST_ENQUEUED','WEBHOOK_EVENT',row.id)});return row
    });res.status(202).json({eventId:event.eventId,test:true,message:'Queued connectivity test; delivery is asynchronous.'})
  })
  app.get('/api/v1/merchant/webhook-deliveries',auth,async(req,res)=>res.json(await db.webhookDelivery.findMany({where:{endpoint:{merchantId:principal(req).merchantId}},include:{attemptLogs:{orderBy:{number:'asc'}},event:{select:{eventId:true,eventType:true}}},orderBy:{createdAt:'desc'},take:100})))
  app.get('/api/v1/merchant/activity',auth,async(req,res)=>res.json(await db.gatewayAuditLog.findMany({where:{merchantId:principal(req).merchantId},orderBy:{createdAt:'desc'},take:100})))
}
