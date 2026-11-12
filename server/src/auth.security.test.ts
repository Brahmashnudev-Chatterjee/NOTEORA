import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { app } from './index.js'
import { User, AuthSession, ActivityLog } from './models.js'
import { getJwtSecret, hashToken, signToken } from './auth.js'
import { readTestMailbox } from './services/emailService.js'

let mongo: MongoMemoryServer
let passwordHash: string
let caseId = 0
const password = 'StrongPass1!'
const origin = 'http://localhost:5173'
const post = (url: string) => request(app).post(url).set('Origin', origin).set('X-Noteora-CSRF', '1').set('X-Forwarded-For', `10.1.0.${caseId}`)
const cookie = (r: any) => r.headers['set-cookie'][0].split(';')[0]
const emailToken = () => readTestMailbox().at(-1)!.text.split('#token=')[1]
async function account(role = 'USER', email = `user-${caseId}@example.com`) {
  const user = await User.create({ name: 'Test', email, password: passwordHash, role })
  const session = await AuthSession.create({ user: user._id, refreshTokenHash: hashToken('seed'), securityVersion: 0, expiresAt: new Date(Date.now() + 86400000) })
  return { user, session, token: signToken(user, String(session._id)) }
}
async function login(email = `user-${caseId}@example.com`) { return post('/api/v1/auth/login').send({ email, password }) }
beforeAll(async () => {
  process.env.EMAIL_TRANSPORT = 'development'
  mongo = await MongoMemoryServer.create()
  await mongoose.connect(mongo.getUri())
  await Promise.all([User.init(), AuthSession.init()])
  passwordHash = await bcrypt.hash(password, 12)
  app.set('trust proxy', 1) // Unique test addresses isolate real limiter buckets.
}, 120000)
beforeEach(async () => { caseId++; readTestMailbox(); await Promise.all([User.deleteMany({}), AuthSession.deleteMany({}), ActivityLog.deleteMany({})]) })
afterAll(async () => { await mongoose.disconnect(); await mongo?.stop() })

describe('Phase B marketplace security', () => {
  it('registers only a USER, hashes secrets, and exposes no recovery or refresh secrets', async () => {
    const r = await post('/api/v1/auth/register').send({ name: 'Buyer', email: ' Buyer@Example.com ', password, acceptedTerms: true, role: 'SUPER_ADMIN', verified: true })
    expect(r.status).toBe(201); expect(r.body.user.role).toBe('USER'); expect(r.body.user.verified).toBe(false)
    const raw = emailToken(); const user = await User.findOne({ email: 'buyer@example.com' }).select('+password +verificationToken +verificationExpires')
    expect(user!.verificationToken).toBe(hashToken(raw)); expect(await bcrypt.compare(password, user!.password)).toBe(true)
    expect(JSON.stringify(r.body)).not.toContain(raw); expect(r.body.password).toBeUndefined(); expect(r.body.refreshToken).toBeUndefined()
    expect(r.headers['set-cookie'][0]).toContain('HttpOnly'); expect(r.headers['set-cookie'][0]).toContain('SameSite=Strict')
    const me = await request(app).get('/api/v1/users/me').auth(r.body.accessToken, { type: 'bearer' })
    expect(me.body.password).toBeUndefined(); expect(me.body.verificationToken).toBeUndefined()
  })
  it('rejects invalid registration, password byte overflow and missing consent', async () => {
    for (const fields of [{ email: { $ne: null } }, { password: 'é'.repeat(40) }, { acceptedTerms: false }]) {
      expect((await post('/api/v1/auth/register').send({ name: 'Buyer', email: 'valid@example.com', password, acceptedTerms: true, ...fields })).status).toBe(400)
    }
  })
  it('eliminates authenticated verification bypass and rejects fabricated tokens', async () => {
    const a = await account()
    for (const body of [{}, { token: '0'.repeat(64) }]) expect((await post('/api/v1/auth/verify').auth(a.token, { type: 'bearer' }).send(body)).status).toBe(400)
    expect((await User.findById(a.user._id))!.verified).toBe(false)
  })
  it('consumes a valid verification token exactly once even under concurrency', async () => {
    await post('/api/v1/auth/register').send({ name: 'Buyer', email: 'verify@example.com', password, acceptedTerms: true })
    const token = emailToken()
    const results = await Promise.all([post('/api/v1/auth/verify').send({ token }), post('/api/v1/auth/verify').send({ token })])
    expect(results.map(x => x.status).sort()).toEqual([200, 400])
    expect((await User.findOne({ email: 'verify@example.com' }))!.verified).toBe(true)
  })
  it('rejects expired verification and invalidates old tokens on resend', async () => {
    const r = await post('/api/v1/auth/register').send({ name: 'Buyer', email: 'expiry@example.com', password, acceptedTerms: true })
    const token = emailToken()
    await User.updateOne({ email: 'expiry@example.com' }, { verificationExpires: new Date(0) })
    expect((await post('/api/v1/auth/verify').send({ token })).status).toBe(400)
    expect((await post('/api/v1/auth/resend-verification').auth(r.body.accessToken, { type: 'bearer' })).status).toBe(200)
    const replacement = emailToken()
    expect((await post('/api/v1/auth/verify').send({ token })).status).toBe(400)
    expect((await post('/api/v1/auth/verify').send({ token: replacement })).status).toBe(200)
  })
  it('recovers and atomically resets passwords once, revoking all existing sessions', async () => {
    const a = await account(); const session = await login()
    const recovery = await post('/api/v1/auth/forgot-password').send({ email: a.user.email })
    expect(recovery.status).toBe(200)
    const token = emailToken()
    expect(JSON.stringify(recovery.body)).not.toContain(token)
    const results = await Promise.all([post('/api/v1/auth/reset-password').send({ token, password: 'NewPassword123!' }), post('/api/v1/auth/reset-password').send({ token, password: 'NewPassword123!' })])
    expect(results.map(x => x.status).sort()).toEqual([200, 400])
    expect((await request(app).get('/api/v1/users/me').auth(a.token, { type: 'bearer' })).status).toBe(401)
    expect((await post('/api/v1/auth/refresh').set('Cookie', cookie(session))).status).toBe(401)
    expect((await login()).status).toBe(401)
    expect((await post('/api/v1/auth/login').send({ email: a.user.email, password: 'NewPassword123!' })).status).toBe(200)
  })
  it('rejects expired, invalid and replaced reset tokens; recovery is non-disclosing', async () => {
    const a = await account()
    const missing = await post('/api/v1/auth/forgot-password').send({ email: 'unknown@example.com' })
    const known = await post('/api/v1/auth/forgot-password').send({ email: a.user.email })
    expect(missing.body).toEqual(known.body)
    const first = emailToken()
    await post('/api/v1/auth/forgot-password').send({ email: a.user.email }); const second = emailToken()
    expect((await post('/api/v1/auth/reset-password').send({ token: first, password })).status).toBe(400)
    await User.updateOne({ _id: a.user._id }, { resetPasswordExpires: new Date(0) })
    for (const token of [second, '0'.repeat(64), 'bad']) expect((await post('/api/v1/auth/reset-password').send({ token, password })).status).toBe(400)
  })
  it('logs in using normalized email and rejects NoSQL payloads and wrong credentials', async () => {
    await account()
    expect((await login(` USER-${caseId}@EXAMPLE.COM `)).status).toBe(200)
    expect((await post('/api/v1/auth/login').send({ email: { $ne: null }, password })).status).toBe(400)
    expect((await post('/api/v1/auth/login').send({ email: `user-${caseId}@example.com`, password: 'wrong' })).status).toBe(401)
    expect(await ActivityLog.countDocuments({ action: 'LOGIN_FAILED' })).toBe(1)
  })
  it('rejects expired access tokens, wrong issuer/audience/algorithm and legacy cookie access', async () => {
    const a = await account()
    const claims = { id: String(a.user._id), sid: String(a.session._id) }
    for (const options of [{ expiresIn: -1 }, { audience: 'gateway' }, { issuer: 'evil' }, { algorithm: 'HS384' }]) {
      const token = jwt.sign(claims, getJwtSecret(), { algorithm: 'HS256', issuer: 'noteora-marketplace', audience: 'noteora-marketplace-api', ...options } as jwt.SignOptions)
      expect((await request(app).get('/api/v1/users/me').auth(token, { type: 'bearer' })).status).toBe(401)
    }
    expect((await request(app).get('/api/v1/users/me').set('Cookie', `accessToken=${a.token}`)).status).toBe(401)
  })
  it('rotates refresh cookies and detects replay, revoking the session family', async () => {
    await account(); const first = await login(); const rotated = await post('/api/v1/auth/refresh').set('Cookie', cookie(first))
    expect(rotated.status).toBe(200); expect(cookie(rotated)).not.toBe(cookie(first))
    expect((await post('/api/v1/auth/refresh').set('Cookie', cookie(first))).status).toBe(401)
    expect((await post('/api/v1/auth/refresh').set('Cookie', cookie(rotated))).status).toBe(401)
    expect((await request(app).get('/api/v1/users/me').auth(rotated.body.accessToken, { type: 'bearer' })).status).toBe(401)
    expect(await ActivityLog.countDocuments({ action: 'REFRESH_REUSE_DETECTED' })).toBe(1)
  })
  it('rejects expired refresh sessions and forged secrets without revoking a valid session', async () => {
    const a = await account(); const r = await login()
    const raw = cookie(r); const id = raw.split('=')[1].split('.')[0]
    expect((await post('/api/v1/auth/refresh').set('Cookie', `noteora_refresh=${id}.${'f'.repeat(64)}`)).status).toBe(401)
    expect((await post('/api/v1/auth/refresh').set('Cookie', raw)).status).toBe(200)
    await AuthSession.updateMany({ user: a.user._id }, { expiresAt: new Date(0) })
    expect((await post('/api/v1/auth/refresh').set('Cookie', raw)).status).toBe(401)
  })
  it('logs out and revokes access and refresh credentials', async () => {
    await account(); const r = await login()
    expect((await post('/api/v1/auth/logout').auth(r.body.accessToken, { type: 'bearer' })).status).toBe(200)
    expect((await request(app).get('/api/v1/users/me').auth(r.body.accessToken, { type: 'bearer' })).status).toBe(401)
    expect((await post('/api/v1/auth/refresh').set('Cookie', cookie(r))).status).toBe(401)
  })
  it('revokes all sessions and prevents cross-user session revocation', async () => {
    const a = await account(); const b = await account('USER', 'other@example.com')
    expect((await request(app).delete(`/api/v1/auth/sessions/${a.session._id}`).auth(b.token, { type: 'bearer' })).status).toBe(404)
    const list = await request(app).get('/api/v1/auth/sessions').auth(a.token, { type: 'bearer' })
    expect(JSON.stringify(list.body)).not.toContain('refreshTokenHash')
    expect((await post('/api/v1/auth/logout-all').auth(a.token, { type: 'bearer' })).status).toBe(200)
    expect((await request(app).get('/api/v1/users/me').auth(a.token, { type: 'bearer' })).status).toBe(401)
  })
  it.each(['active','suspended'])('enforces %s status on login, access, verification and refresh', async field => {
    const a = await account(); const r = await login()
    await User.updateOne({ _id: a.user._id }, { [field]: field === 'active' ? false : true, verificationToken:hashToken('a'.repeat(64)), verificationExpires:new Date(Date.now()+60000) })
    expect((await login()).status).toBe(403)
    expect((await request(app).get('/api/v1/users/me').auth(a.token, { type: 'bearer' })).status).toBe(401)
    expect((await post('/api/v1/auth/refresh').set('Cookie', cookie(r))).status).toBe(401)
    expect((await post('/api/v1/auth/verify').send({token:'a'.repeat(64)})).status).toBe(400)
  })
  it('atomically rejects concurrent refresh reuse and leaves the family revoked', async () => {
    await account(); const first=await login()
    const results=await Promise.all([post('/api/v1/auth/refresh').set('Cookie',cookie(first)),post('/api/v1/auth/refresh').set('Cookie',cookie(first))])
    expect(results.map(r=>r.status).sort()).toEqual([200,401])
    const winner=results.find(r=>r.status===200)!
    expect((await request(app).get('/api/v1/users/me').auth(winner.body.accessToken,{type:'bearer'})).status).toBe(401)
  })
  it('ignores self-assigned privileges and preserves password changes for legacy users', async () => {
    const a=await account()
    await request(app).patch('/api/v1/users/me').auth(a.token,{type:'bearer'}).send({role:'SUPER_ADMIN',verified:true,name:'Updated'})
    const user=await User.findById(a.user._id)
    expect(user!.role).toBe('USER');expect(user!.verified).toBe(false)
    await User.collection.updateOne({_id:a.user._id},{$unset:{securityVersion:1}})
    expect((await request(app).patch('/api/v1/users/password').auth(a.token,{type:'bearer'}).send({currentPassword:password,password:'LegacyPassword1!'})).status).toBe(200)
  })
  it('allows buyers and sellers shared USER access, denies admin operations, and rechecks demotion', async () => {
    const a = await account()
    expect((await request(app).get('/api/v1/seller/dashboard').auth(a.token, { type: 'bearer' })).status).toBe(200)
    expect((await request(app).get('/api/v1/admin/users').auth(a.token, { type: 'bearer' })).status).toBe(403)
    await User.updateOne({ _id: a.user._id }, { role: 'ADMIN' })
    expect((await request(app).get('/api/v1/admin/users').auth(a.token, { type: 'bearer' })).status).toBe(200)
    await User.updateOne({ _id: a.user._id }, { role: 'USER' })
    expect((await request(app).get('/api/v1/admin/users').auth(a.token, { type: 'bearer' })).status).toBe(403)
  })
  it('prevents admin privilege escalation, privileged-target edits and manual email verification', async () => {
    const admin = await account('ADMIN'); const root = await account('SUPER_ADMIN', 'root@example.com')
    const target = await account('USER', 'target@example.com')
    for (const [id, body] of [[root.user._id, { name: 'Hacked' }], [target.user._id, { role: 'ADMIN' }], [target.user._id, { verified: true }]] as const) {
      expect([400,403]).toContain((await request(app).patch(`/api/v1/admin/users/${id}`).auth(admin.token, { type: 'bearer' }).send(body)).status)
    }
    const created = await post('/api/v1/admin/users').auth(root.token, { type: 'bearer' }).send({ name: 'Managed', email: 'managed@example.com', password })
    expect(created.status).toBe(201); expect(JSON.stringify(created.body)).not.toContain(passwordHash); expect(created.body.password).toBeUndefined()
    expect((await post('/api/v1/admin/users').auth(admin.token, { type: 'bearer' }).send({ name: 'Escalated', email: 'escape@example.com', password, role: 'ADMIN' })).status).toBe(403)
  })
  it('revokes all sessions on password change and rejects wrong current password', async () => {
    const a = await account()
    expect((await request(app).patch('/api/v1/users/password').auth(a.token, { type: 'bearer' }).send({ currentPassword: 'wrong', password })).status).toBe(400)
    expect((await request(app).patch('/api/v1/users/password').auth(a.token, { type: 'bearer' }).send({ currentPassword: password, password: 'ChangedPassword1!' })).status).toBe(200)
    expect((await request(app).get('/api/v1/users/me').auth(a.token, { type: 'bearer' })).status).toBe(401)
  })
  it('separates gateway administrator introspection from buyers and merchant JWTs', async () => {
    const buyer = await account(); const admin = await account('ADMIN', 'admin@example.com')
    expect((await request(app).get('/api/v1/auth/gateway-admin').auth(buyer.token, { type: 'bearer' })).status).toBe(403)
    expect((await request(app).get('/api/v1/auth/gateway-admin').auth(admin.token, { type: 'bearer' })).status).toBe(200)
    const merchant = jwt.sign({ userId: 'merchant', role: 'SUPER_ADMIN' }, 'merchant-secret', { issuer: 'noteora-gateway', audience: 'noteora-gateway-merchant' })
    expect((await request(app).get('/api/v1/auth/gateway-admin').auth(merchant, { type: 'bearer' })).status).toBe(401)
  })
  it('rejects cross-site and missing-CSRF session mutations', async () => {
    await account(); const r = await login()
    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie(r))).status).toBe(403)
    expect((await post('/api/v1/auth/refresh').set('Origin', 'https://evil.example').set('Cookie', cookie(r))).status).toBe(403)
    expect((await request(app).post('/api/v1/auth/login').set('Origin', origin).send({ email: 'x@example.com', password })).status).toBe(403)
  })
  it('rate limits failed login attempts', async () => {
    let status = 0
    for (let i = 0; i < 21; i++) status = (await login('unknown@example.com')).status
    expect(status).toBe(429)
  })
})
