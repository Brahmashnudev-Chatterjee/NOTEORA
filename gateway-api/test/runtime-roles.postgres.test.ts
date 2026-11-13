import {afterAll,beforeAll,describe,it,expect} from 'vitest'
import {PrismaClient} from '@prisma/client'
let api:PrismaClient,worker:PrismaClient
describe.skipIf(!process.env.TEST_GATEWAY_RUNTIME_URL||!process.env.TEST_GATEWAY_WORKER_URL)('Dedicated runtime database roles',()=>{
 beforeAll(()=>{for(const raw of [process.env.TEST_GATEWAY_RUNTIME_URL!,process.env.TEST_GATEWAY_WORKER_URL!]){const u=new URL(raw);if(u.hostname!=='127.0.0.1'||!u.pathname.endsWith('_test'))throw new Error('Disposable loopback database required')}api=new PrismaClient({datasources:{db:{url:process.env.TEST_GATEWAY_RUNTIME_URL}}});worker=new PrismaClient({datasources:{db:{url:process.env.TEST_GATEWAY_WORKER_URL}}})})
 afterAll(async()=>{await api?.$disconnect();await worker?.$disconnect()})
 it('denies financial and marketplace data to the gateway API role',async()=>{
  await expect(api.$queryRawUnsafe('SELECT * FROM gateway."PaymentOrder" LIMIT 1')).rejects.toThrow()
  await expect(api.$queryRawUnsafe('SELECT * FROM marketplace."User" LIMIT 1')).rejects.toThrow()
  await expect(api.$executeRawUnsafe('CREATE TABLE gateway.forbidden_runtime_table(id int)')).rejects.toThrow()
 })
 it('denies team and credential data to the webhook worker role',async()=>{
  await expect(worker.merchantUser.findMany()).rejects.toThrow()
  await expect(worker.merchantCredential.findMany()).rejects.toThrow()
  expect(await worker.$queryRawUnsafe('SELECT 1 AS ready')).toEqual([{ready:1}])
 })
 it('has no administrative role attributes and cannot alter audit history',async()=>{
  for(const db of [api,worker]){const rows=await db.$queryRawUnsafe<any[]>('SELECT rolsuper,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user');expect(rows[0]).toEqual({rolsuper:false,rolcreatedb:false,rolcreaterole:false})}
  const row=await api.gatewayAuditLog.create({data:{actorType:'SYSTEM',action:'RUNTIME_PERMISSION_TEST'}})
  await expect(api.gatewayAuditLog.update({where:{id:row.id},data:{action:'FORGED'}})).rejects.toThrow()
  await expect(worker.gatewayAuditLog.delete({where:{id:row.id}})).rejects.toThrow()
 })
})
