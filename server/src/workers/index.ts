import 'dotenv/config'
import { Worker, type Job } from 'bullmq'
import { createWorkers, queueNames, redisConnection, closeInfrastructure } from '../infrastructure/queues.js'

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
  worker.on('failed', (job, error) => console.error(JSON.stringify({ queue: worker.name, jobId: job?.id, error: error.message })))
})

async function shutdown(signal: string) {
  console.log(`Worker shutdown requested: ${signal}`)
  await Promise.all(workers.map(worker => worker.close()))
  await closeInfrastructure()
  process.exit(0)
}
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
console.log(`BullMQ workers started for ${Object.values(queueNames).join(', ')}`)
