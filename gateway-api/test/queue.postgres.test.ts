import {afterAll,beforeAll,describe,it,expect} from 'vitest'
import {PrismaClient} from '@prisma/client'
import http from 'node:http'
import crypto from 'node:crypto'
import {startWebhookWorker} from '../src/worker.js'
import {encrypt,hash,verifySignature} from '../src/security.js'
const url=process.env.TEST_GATEWAY_DATABASE_URL,redis=process.env.TEST_GATEWAY_REDIS_URL
let workerDB:PrismaClient,db:PrismaClient,runtime:ReturnType<typeof startWebhookWorker>,receiver:http.Server,merchantId:string,origin:string,calls=0,last:any
const signingSecret=crypto.randomBytes(32).toString('hex')
describe.skipIf(!url||!redis).sequential('Real Redis BullMQ and PostgreSQL delivery',()=>{
  beforeAll(async()=>{
    if(!new URL(url!).pathname.endsWith('_test')||new URL(url!).hostname!=='127.0.0.1'||new URL(redis!).hostname!=='127.0.0.1')throw new Error('Isolated loopback test services required')
    db=new PrismaClient({datasources:{db:{url}}});const merchant=await db.merchant.create({data:{name:'Queue test',slug:crypto.randomUUID(),status:'APPROVED'}});merchantId=merchant.id
    receiver=http.createServer(async(req,res)=>{let raw='';for await(const chunk of req)raw+=chunk;calls++;last={raw,headers:req.headers};res.writeHead(calls===1?503:200);res.end()});await new Promise<void>(r=>receiver.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+(receiver.address() as any).port;process.env.GATEWAY_WEBHOOK_DEV_ORIGINS=origin
  })
  afterAll(async()=>{await runtime?.close();await workerDB?.$disconnect();await new Promise<void>(r=>receiver?.close(()=>r()));if(db){await db.merchant.deleteMany({where:{id:merchantId}});await db.$disconnect()}})
  it('recovers a durable pending delivery, retries a 503 and logs signed test delivery exactly once on success',async()=>{
    const endpoint=await db.webhookEndpoint.create({data:{merchantId,environment:'SANDBOX',url:origin+'/hook',signingSecretHash:hash(signingSecret),signingSecretEncrypted:encrypt(signingSecret),eventSubscriptions:['gateway.test']}})
    const event=await db.webhookEvent.create({data:{merchantId,eventId:'queue_'+crypto.randomUUID(),eventType:'gateway.test',sequence:1,payload:{event:'gateway.test',environment:'SANDBOX',test:true}}})
    const delivery=await db.webhookDelivery.create({data:{endpointId:endpoint.id,eventId:event.id}})
    await db.webhookOutbox.create({data:{eventId:event.id,eventType:'gateway.test',payload:{test:true}}})
    workerDB=new PrismaClient({datasources:{db:{url:process.env.TEST_GATEWAY_WORKER_URL||url}}});runtime=startWebhookWorker(workerDB,redis!)
    const deadline=Date.now()+20000
    let actual=delivery
    while(Date.now()<deadline){actual=await db.webhookDelivery.findUniqueOrThrow({where:{id:delivery.id}});if(actual.status==='DELIVERED')break;await new Promise(r=>setTimeout(r,100))}
    expect(actual.status).toBe('DELIVERED');expect(actual.attempts).toBe(2);expect(calls).toBe(2)
    expect(verifySignature(signingSecret,last.headers['x-noteora-timestamp'],last.raw,last.headers['x-noteora-signature'])).toBe(true)
    expect((await db.webhookAttempt.findMany({where:{deliveryId:delivery.id},orderBy:{number:'asc'}})).map(x=>x.status)).toEqual(['RETRY','DELIVERED'])
    expect((await db.webhookOutbox.findUniqueOrThrow({where:{eventId:event.id}})).completedAt).toBeTruthy()
  },25000)
})
