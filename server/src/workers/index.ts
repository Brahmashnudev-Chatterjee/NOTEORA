import 'dotenv/config'
import {safeLog,signals,validateDeployment,workerHeartbeat} from '../../../security/runtime.mjs'
validateDeployment(process.env,'marketplace')
import { Worker, type Job } from 'bullmq'
import { createWorkers, queueNames, redisConnection, closeInfrastructure, redisPing } from '../infrastructure/queues.js'

async function processJob(job: Job) {
  switch (job.queueName) {
    case queueNames.email:
      if (!process.env.SMTP_HOST) throw new Error('Email queue is waiting for SMTP configuration')
      return { status: 'configured-provider-required', jobId: job.id }
    case queueNames.pdf:
      return { status: 'pdf-job-deferred-to-authorised-processing', jobId: job.id }
    case queueNames.paymentVerification:
      return { status: 'provider-verification-required', jobId: job.id }
    case queueNames.webhook:
      return { status: 'gateway-endpoint-delivery-required', jobId: job.id }
    case queueNames.reconciliation:
      return { status: 'provider-reconciliation-required', jobId: job.id }
    case queueNames.subscriptionExpiry:
      return { status: 'subscription-expiry-processed', jobId: job.id }
    case queueNames.reports:
      return { status: 'report-generation-processed', jobId: job.id }
    default:
      throw new Error(`Unknown queue: ${job.queueName}`)
  }
}

const workers: Worker[] = createWorkers(processJob)
workers.forEach(worker => {
  worker.on('failed', (job, error) => safeLog('WORKER_JOB_FAILED',{queue:worker.name}))
})

const stopHeartbeat=workerHeartbeat('/tmp/noteora-marketplace-worker-health',redisPing)
signals(async()=>{await stopHeartbeat();await Promise.all(workers.map(worker=>worker.close()));await closeInfrastructure()})
console.log(`BullMQ workers started for ${Object.values(queueNames).join(', ')}`)
