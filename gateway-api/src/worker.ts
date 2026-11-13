import {redisOptions} from '../../security/runtime.mjs'
import {PrismaClient} from '@prisma/client'
import {Queue,Worker} from 'bullmq'
import {deliver} from './webhookDelivery.js'

export function startWebhookWorker(db:PrismaClient,redisUrl:string){
const connection=redisOptions(redisUrl)
const queue=new Queue('noteora-gateway-webhooks',{connection})
const worker=new Worker('noteora-gateway-webhooks',async job=>{
  const outcome=await deliver(db,job.data.deliveryId)
  if(outcome.status==='RETRY')throw new Error('Delivery will retry')
},{connection,concurrency:4})
worker.on('error',()=>console.error('Gateway webhook worker unavailable'))
let polling=false
async function dispatch(){
  if(polling)return;polling=true
  try{
    const rows=await db.webhookDelivery.findMany({where:{status:{in:['PENDING','RETRY','SENDING']},nextAttemptAt:{lte:new Date()},OR:[{leaseUntil:null},{leaseUntil:{lte:new Date()}}]},take:100})
    for(const row of rows)await queue.add('deliver',{deliveryId:row.id},{jobId:row.id+'_'+row.attempts,attempts:5,backoff:{type:'exponential',delay:1000},removeOnComplete:true,removeOnFail:1000})
  }catch{console.error('Gateway webhook dispatch unavailable')}finally{polling=false}
}
const timer=setInterval(()=>void dispatch(),1000);void dispatch()
return {queue,worker,dispatch,async close(){clearInterval(timer);await worker.close();await queue.close()}}
}
