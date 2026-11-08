import { Queue, QueueEvents, Worker, type ConnectionOptions, type Job } from 'bullmq'
import { Redis } from 'ioredis'

export const queueNames = {
  email: 'noteora-email',
  pdf: 'noteora-pdf-processing',
  paymentVerification: 'noteora-payment-verification',
  webhook: 'noteora-webhook-delivery',
  reconciliation: 'noteora-payment-reconciliation',
  subscriptionExpiry: 'noteora-subscription-expiry',
  reports: 'noteora-scheduled-reports'
} as const

export function redisConnection(): ConnectionOptions {
  return { host: process.env.REDIS_HOST || '127.0.0.1', port: Number(process.env.REDIS_PORT || 6379), password: process.env.REDIS_PASSWORD || undefined, maxRetriesPerRequest: null } as ConnectionOptions
}

const queues = new Map<string, Queue>()
export function getQueue(name: string) {
  if (!queues.has(name)) queues.set(name, new Queue(name, { connection: redisConnection(), defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 1000, removeOnFail: 2000 } }))
  return queues.get(name)!
}

export async function addIdempotentJob(queueName: string, data: unknown, idempotencyKey: string) {
  return getQueue(queueName).add(queueName, data, { jobId: idempotencyKey })
}

export function createWorkers(processor: (job: Job) => Promise<unknown>) {
  return Object.values(queueNames).map(name => new Worker(name, processor, { connection: redisConnection(), concurrency: 5, lockDuration: 30000 }))
}

export async function closeInfrastructure() {
  await Promise.all([...queues.values()].map(queue => queue.close()))
}

export async function redisPing(): Promise<boolean> {
  const client = new Redis(process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || '127.0.0.1'}:${process.env.REDIS_PORT || 6379}`, { maxRetriesPerRequest: 1, lazyConnect: true })
  try { await client.connect(); return await client.ping() === 'PONG' } catch { return false } finally { await client.quit().catch(() => client.disconnect()) }
}

export function queueEvents(name: string) {
  return new QueueEvents(name, { connection: redisConnection() })
}
