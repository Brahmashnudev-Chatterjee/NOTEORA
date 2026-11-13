import type {PrismaClient} from '@prisma/client'
import {decrypt,sendWebhook,signature} from './security.js'

export async function deliver(db:PrismaClient,id:string){
  const claimed=await db.$transaction(async tx=>{
    const row=await tx.webhookDelivery.findUnique({where:{id},include:{endpoint:true,event:true}})
    if(!row||['DELIVERED','FAILED','CANCELLED'].includes(row.status)||row.nextAttemptAt>new Date()||row.leaseUntil&&row.leaseUntil>new Date())return null
    if(row.attempts>=5){
      await tx.webhookDelivery.update({where:{id},data:{status:'FAILED',leaseUntil:null}})
      await tx.webhookAttempt.updateMany({where:{deliveryId:id,status:'SENDING'},data:{status:'UNKNOWN_AFTER_WORKER_INTERRUPTION',completedAt:new Date()}})
      await tx.webhookOutbox.updateMany({where:{eventId:row.eventId},data:{completedAt:new Date(),attempts:row.attempts,lastError:'ATTEMPT_LIMIT'}})
      await tx.gatewayAuditLog.create({data:{merchantId:row.endpoint.merchantId,actorType:'SYSTEM',action:'WEBHOOK_FAILED',entity:'WEBHOOK_DELIVERY',entityId:id,details:{reason:'ATTEMPT_LIMIT'}}})
      return null
    }
    const updated=await tx.webhookDelivery.updateMany({where:{id,attempts:row.attempts,OR:[{leaseUntil:null},{leaseUntil:{lte:new Date()}}]},data:{status:'SENDING',attempts:{increment:1},leaseUntil:new Date(Date.now()+60000)}})
    if(!updated.count)return null
    // A worker crash has unknown network outcome. Preserve it as a distinct attempt and retry at least once.
    await tx.webhookAttempt.updateMany({where:{deliveryId:id,status:'SENDING'},data:{status:'UNKNOWN_AFTER_WORKER_INTERRUPTION',completedAt:new Date()}})
    await tx.webhookAttempt.create({data:{deliveryId:id,number:row.attempts+1,status:'SENDING'}})
    return {...row,number:row.attempts+1}
  })
  if(!claimed)return {ignored:true}
  let statusCode:number|null=null,result='RETRY'
  const merchant=await db.merchant.findUnique({where:{id:claimed.endpoint.merchantId}})
  if(merchant?.status!=='APPROVED'||!claimed.endpoint.active||claimed.endpoint.environment!=='SANDBOX'||claimed.event.eventType!=='gateway.test'||!claimed.endpoint.eventSubscriptions.includes('gateway.test'))result='CANCELLED'
  else try{
    const body=JSON.stringify(claimed.event.payload),timestamp=String(Math.floor(Date.now()/1000))
    statusCode=await sendWebhook(claimed.endpoint.url,body,{'X-Noteora-Timestamp':timestamp,'X-Noteora-Signature':signature(decrypt(claimed.endpoint.signingSecretEncrypted!),timestamp,body),'X-Noteora-Event-Id':claimed.event.eventId})
    if(statusCode>=200&&statusCode<300)result='DELIVERED'
  }catch{ /* Sanitized outcome only; URLs, signatures, secrets and response bodies are never logged. */ }
  if(result==='RETRY'&&claimed.number>=5)result='FAILED'
  const nextAttemptAt=new Date(Date.now()+1000*2**(claimed.number-1))
  await db.$transaction(async tx=>{
    const updated=await tx.webhookDelivery.updateMany({where:{id,attempts:claimed.number,status:'SENDING'},data:{status:result,responseStatus:statusCode,responseBody:null,leaseUntil:null,nextAttemptAt,deliveredAt:result==='DELIVERED'?new Date():null}})
    if(!updated.count)return
    await tx.webhookAttempt.update({where:{deliveryId_number:{deliveryId:id,number:claimed.number}},data:{status:result,responseStatus:statusCode,completedAt:new Date()}})
    await tx.gatewayAuditLog.create({data:{merchantId:claimed.endpoint.merchantId,actorType:'SYSTEM',action:'WEBHOOK_'+result,entity:'WEBHOOK_DELIVERY',entityId:id,details:{attempt:claimed.number,responseStatus:statusCode}}})
    if(['DELIVERED','FAILED','CANCELLED'].includes(result))await tx.webhookOutbox.updateMany({where:{eventId:claimed.eventId},data:{completedAt:new Date(),attempts:claimed.number,lastError:result==='DELIVERED'?null:result}})
  })
  return {status:result}
}
