import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'
import request from 'supertest'

// Never fall back to the configured development or production database.
const url = process.env.TEST_GATEWAY_DATABASE_URL
let prisma: PrismaClient
let app: any
let merchantId: string
let userId: string
let token: string
let refresh: string
const email = `phase-b-${Date.now()}@example.com`
const post = (path: string) => request(app).post(path).set('Origin','http://localhost:5174').set('X-Noteora-CSRF','1')

describe.skipIf(!url).sequential('Gateway authentication on isolated PostgreSQL', () => {
  beforeAll(async () => {
    const parsed = new URL(url!)
    if (!['127.0.0.1','localhost','[::1]'].includes(parsed.hostname) || !parsed.pathname.endsWith('_test')) throw new Error('TEST_GATEWAY_DATABASE_URL must name a loopback database ending in _test')
    process.env.DATABASE_URL = url
    prisma = new PrismaClient({datasources:{db:{url}}})
    await prisma.$queryRaw`SELECT 1`
    app = (await import('../src/index.js')).app
  })
  afterAll(async () => {
    if(prisma){
      if(merchantId)await prisma.merchant.deleteMany({where:{id:merchantId}})
      await prisma.$disconnect()
    }
  })
  it('registers a merchant with an owner and initialized auth version', async () => {
    const r=await post('/api/v1/merchants/register').send({name:'Phase B Test',businessName:'Phase B Test',contactName:'Owner',contactEmail:email,contactPhone:'9999999999',businessType:'Education',password:'MerchantPassword1!'})
    expect(r.status).toBe(201);merchantId=r.body.id
    const user=await prisma.merchantUser.findUniqueOrThrow({where:{email}});userId=user.id
    expect(user.authVersion).toBe(0);expect(user.role).toBe('MERCHANT_OWNER')
    await prisma.merchant.update({where:{id:merchantId},data:{status:'APPROVED'}})
  })
  it('persists login and rotated refresh state', async () => {
    const login=await post('/api/v1/auth/login').send({email,password:'MerchantPassword1!'})
    expect(login.status).toBe(200);token=login.body.token;refresh=login.headers['set-cookie'][0].split(';')[0]
    const r=await post('/api/v1/auth/refresh').set('Cookie',refresh)
    expect(r.status).toBe(200);token=r.body.token
    expect((await prisma.merchantUser.findUniqueOrThrow({where:{id:userId}})).authVersion).toBe(2)
    expect((await request(app).get('/api/v1/merchant/me').auth(token,{type:'bearer'})).status).toBe(200)
  })
  it('detects refresh reuse and revokes persisted access', async () => {
    expect((await post('/api/v1/auth/refresh').set('Cookie',refresh)).status).toBe(401)
    expect((await request(app).get('/api/v1/merchant/me').auth(token,{type:'bearer'})).status).toBe(401)
    expect((await prisma.merchantUser.findUniqueOrThrow({where:{id:userId}})).authFamily).toBeNull()
  })
  it('refuses suspended merchants and records security audit history', async () => {
    await prisma.merchant.update({where:{id:merchantId},data:{status:'SUSPENDED'}})
    expect((await post('/api/v1/auth/login').send({email,password:'MerchantPassword1!'})).status).toBe(403)
    expect(await prisma.gatewayAuditLog.count({where:{merchantId,action:'REFRESH_REUSE_DETECTED'}})).toBe(1)
  })
})
