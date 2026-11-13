import 'dotenv/config'
import {PrismaClient} from '@prisma/client'
import {signals,validateDeployment,workerHeartbeat} from '../../security/runtime.mjs'
import {startWebhookWorker} from './worker.js'
validateDeployment(process.env,'gateway')
if(!process.env.GATEWAY_REDIS_URL)throw new Error('GATEWAY_REDIS_URL is required')
const db=new PrismaClient({log:[]}),runtime=startWebhookWorker(db,process.env.GATEWAY_REDIS_URL)
const stopHeartbeat=workerHeartbeat('/tmp/noteora-gateway-worker-health',async()=>{await db.$queryRawUnsafe('SELECT 1');await runtime.queue.getJobCounts('waiting');return true})
signals(async()=>{await stopHeartbeat();await runtime.close();await db.$disconnect()})
