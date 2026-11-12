import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const db = vi.hoisted(() => ({
  merchantUser: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  merchant: { findUnique: vi.fn(), findMany: vi.fn() },
  gatewayAuditLog: { create: vi.fn() }
}))
vi.mock('@prisma/client', () => ({ PrismaClient: class { merchantUser = db.merchantUser; merchant = db.merchant; gatewayAuditLog = db.gatewayAuditLog } }))
import { app } from '../src/index.js'

let user: any, merchant: any, hash: string
const secret = process.env.GATEWAY_JWT_SECRET || 'ci-test-only-gateway-secret'
const origin = 'http://localhost:5174'
const post = (path: string) => request(app).post(path).set('Origin', origin).set('X-Noteora-CSRF', '1')
const login = () => post('/api/v1/auth/login').send({ email: 'owner@example.com', password: 'MerchantPassword1!' })
const cookie = (r: any) => r.headers['set-cookie'][0].split(';')[0]
function matches(where: any) {
  return Object.entries(where).every(([key, value]: any) => value?.gt ? user[key] > value.gt : user[key] === value)
}
function mutate(data: any) {
  for (const [key, value] of Object.entries(data) as any) user[key] = value?.increment ? user[key] + value.increment : value
  return { ...user }
}
beforeAll(async () => { hash = await bcrypt.hash('MerchantPassword1!', 12) })
beforeEach(() => {
  vi.clearAllMocks()
  user = { id: 'user-id', merchantId: 'merchant-id', email: 'owner@example.com', passwordHash: hash, active: true, role: 'MERCHANT_OWNER', authVersion: 0, authFamily: null, authExpiresAt: null }
  merchant = { id: 'merchant-id', status: 'APPROVED', users: [] }
  db.merchantUser.findUnique.mockImplementation(async ({ where }) => user.email === where.email ? { ...user } : null)
  db.merchantUser.findFirst.mockImplementation(async ({ where }) => matches(where) ? { ...user } : null)
  db.merchantUser.update.mockImplementation(async ({ data }) => mutate(data))
  db.merchantUser.updateMany.mockImplementation(async ({ where, data }) => { if (!matches(where)) return { count: 0 }; mutate(data); return { count: 1 } })
  db.merchant.findUnique.mockImplementation(async () => merchant)
  db.merchant.findMany.mockResolvedValue([])
  db.gatewayAuditLog.create.mockResolvedValue({})
  process.env.MARKETPLACE_AUTH_URL = 'http://marketplace.test'
})
afterEach(() => vi.unstubAllGlobals())

describe('Gateway authentication behavior with mocked persistence', () => {
  it('logs in with a purpose-bound token and an HttpOnly refresh cookie', async () => {
    const r = await login(); expect(r.status).toBe(200)
    const claims = jwt.verify(r.body.token, secret, { audience: 'noteora-gateway-merchant', issuer: 'noteora-gateway' }) as jwt.JwtPayload
    expect(claims.exp! - claims.iat!).toBe(900)
    expect(r.headers['set-cookie'][0]).toContain('HttpOnly')
    expect(JSON.stringify(r.body)).not.toContain(hash)
    expect((await request(app).get('/api/v1/merchant/me').auth(r.body.token, { type: 'bearer' })).status).toBe(200)
  })
  it('rejects disabled users, suspended and rejected merchants at login', async () => {
    user.active = false; expect((await login()).status).toBe(401); user.active = true
    for (const status of ['SUSPENDED', 'REJECTED']) { merchant.status = status; expect((await login()).status).toBe(403) }
  })
  it('rechecks merchant status and current database role on protected requests', async () => {
    const r = await login(); user.role = 'MERCHANT_VIEWER'
    expect((await post('/api/v1/merchant/api-keys').auth(r.body.token, { type: 'bearer' }).send({ environment: 'SANDBOX' })).status).toBe(403)
    merchant.status = 'SUSPENDED'
    expect((await request(app).get('/api/v1/merchant/me').auth(r.body.token, { type: 'bearer' })).status).toBe(403)
    merchant.status = 'APPROVED'; user.active = false
    expect((await request(app).get('/api/v1/merchant/me').auth(r.body.token, { type: 'bearer' })).status).toBe(401)
  })
  it('rotates refresh tokens and revokes the family on replay', async () => {
    const first = await login(); const next = await post('/api/v1/auth/refresh').set('Cookie', cookie(first))
    expect(next.status).toBe(200); expect(cookie(next)).not.toBe(cookie(first))
    expect((await post('/api/v1/auth/refresh').set('Cookie', cookie(first))).status).toBe(401)
    expect((await request(app).get('/api/v1/merchant/me').auth(next.body.token, { type: 'bearer' })).status).toBe(401)
    expect((await post('/api/v1/auth/refresh').set('Cookie', cookie(next))).status).toBe(401)
  })
  it('logs out and immediately revokes merchant access and refresh', async () => {
    const r = await login()
    expect((await post('/api/v1/auth/logout').auth(r.body.token, { type: 'bearer' })).status).toBe(200)
    expect((await request(app).get('/api/v1/merchant/me').auth(r.body.token, { type: 'bearer' })).status).toBe(401)
    expect((await post('/api/v1/auth/refresh').set('Cookie', cookie(r))).status).toBe(401)
  })
  it('rejects expired access and refresh tokens and cross-purpose refresh tokens', async () => {
    const r = await login(); const decoded = jwt.decode(r.body.token) as jwt.JwtPayload
    const claims = { userId: decoded.userId, merchantId: decoded.merchantId, version: decoded.version, family: decoded.family }
    const expired = jwt.sign(claims, secret, { issuer: 'noteora-gateway', audience: 'noteora-gateway-merchant', expiresIn: -1 })
    expect((await request(app).get('/api/v1/merchant/me').auth(expired, { type: 'bearer' })).status).toBe(401)
    const refresh = jwt.sign(claims, secret, { issuer: 'noteora-gateway', audience: 'noteora-gateway-refresh', expiresIn: -1 })
    expect((await post('/api/v1/auth/refresh').set('Cookie', `noteora_gateway_refresh=${refresh}`)).status).toBe(401)
    expect((await request(app).get('/api/v1/merchant/me').auth(cookie(r).split('=')[1], { type: 'bearer' })).status).toBe(401)
  })
  it('requires trusted origin and CSRF header for merchant cookie actions', async () => {
    expect((await request(app).post('/api/v1/auth/login').send({ email: user.email, password: 'MerchantPassword1!' })).status).toBe(403)
    expect((await post('/api/v1/auth/refresh').set('Origin', 'https://evil.example')).status).toBe(403)
  })
  it('never accepts a merchant token or a legacy shared token as administrator authentication', async () => {
    const r = await login(); const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock)
    for (const token of [r.body.token, 'legacy-admin-token']) expect((await request(app).get('/api/v1/admin/merchants').auth(token, { type: 'bearer' })).status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('requires successful marketplace administrator introspection and fails closed', async () => {
    const token = jwt.sign({ id: 'admin' }, 'different-marketplace-key', { issuer: 'noteora-marketplace', audience: 'noteora-marketplace-api' })
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'admin', role: 'USER' }) }); vi.stubGlobal('fetch', fetchMock)
    expect((await request(app).get('/api/v1/admin/merchants').auth(token, { type: 'bearer' })).status).toBe(403)
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: 'admin', role: 'ADMIN' }) })
    expect((await request(app).get('/api/v1/admin/merchants').auth(token, { type: 'bearer' })).status).toBe(200)
    fetchMock.mockRejectedValue(new Error('unavailable'))
    expect((await request(app).get('/api/v1/admin/merchants').auth(token, { type: 'bearer' })).status).toBe(503)
    expect((await request(app).get('/api/v1/merchant/me').auth(token, { type: 'bearer' })).status).toBe(401)
  })
})
