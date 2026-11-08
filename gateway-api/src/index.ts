import 'dotenv/config'
import express, { Request, Response, NextFunction } from 'express'
import helmet from 'helmet'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { z } from 'zod'
import { PrismaClient, MerchantStatus, MerchantRole, PaymentEnvironment } from '@prisma/client'
import type { Prisma } from '@prisma/client'

const prisma = new PrismaClient({ log: ['error'] })
export const app = express()
app.set('trust proxy', 1)
app.use(helmet())
app.use(cors({ origin: process.env.GATEWAY_CLIENT_URL || 'http://localhost:5174', credentials: true }))
app.use(express.json({ limit: '1mb' }))
app.use(rateLimit({ windowMs: 60_000, max: 300, standardHeaders: true, legacyHeaders: false }))

function getGatewaySecret(name: 'GATEWAY_JWT_SECRET' | 'GATEWAY_WEBHOOK_ENCRYPTION_KEY') {
  const secret = process.env[name]
  if (!secret && process.env.NODE_ENV !== 'test') throw new Error(`${name} is required`)
  return secret || (name === 'GATEWAY_JWT_SECRET' ? 'ci-test-only-gateway-secret' : 'ci-test-only-webhook-secret')
}
const jwtSecret = getGatewaySecret('GATEWAY_JWT_SECRET')
const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex')
const random = (n = 32) => crypto.randomBytes(n).toString('hex')
const encrypt = (text: string) => {
  const key = crypto.createHash('sha256').update(getGatewaySecret('GATEWAY_WEBHOOK_ENCRYPTION_KEY')).digest()
  const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]); const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

function sign(payload: object, expiresIn = '8h') { return jwt.sign(payload, jwtSecret, { expiresIn } as jwt.SignOptions) }
async function authMerchant(req: Request, res: Response, next: NextFunction) {
  let token = String(req.headers.authorization || '')
  if (token.toLowerCase().startsWith('bearer ')) token = token.slice(7).trim()
  if (!token) return res.status(401).json({ error: 'Merchant authentication required' })
  try {
    const claims = jwt.verify(token, jwtSecret) as { merchantId: string; userId: string; role: MerchantRole }
    const user = await prisma.merchantUser.findFirst({ where: { id: claims.userId, merchantId: claims.merchantId, active: true } })
    if (!user) return res.status(401).json({ error: 'Merchant account is inactive or invalid' })
    const merchant = await prisma.merchant.findUnique({ where: { id: claims.merchantId }, select: { status: true } })
    if (!merchant || merchant.status === MerchantStatus.SUSPENDED || merchant.status === MerchantStatus.REJECTED) return res.status(403).json({ error: 'Merchant account is not permitted to access gateway resources' })
    ;(req as any).user = { merchantId: user.merchantId, userId: user.id, role: user.role }
    next()
  } catch { res.status(401).json({ error: 'Invalid or expired token' }) }
}
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = String(req.headers.authorization || '').replace(/^Bearer /i, '')
  const expected = process.env.NOTEORA_ADMIN_TOKEN
  if (!expected || token !== expected) return res.status(403).json({ error: 'Administrator access required' })
  next()
}
function requireMerchantPermission(...roles: MerchantRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as { merchantId: string; role: MerchantRole }
    if (!roles.includes(user.role)) return res.status(403).json({ error: 'Insufficient merchant permissions' })
    next()
  }
}
async function audit(merchantId: string | null, actorType: string, actorId: string | null, action: string, entity?: string, entityId?: string, req?: Request) {
  await prisma.gatewayAuditLog.create({ data: { merchantId, actorType, actorId, action, entity, entityId, ip: req?.ip, details: {} } })
}

app.get('/api/health', async (_req, res) => {
  try { await prisma.$queryRawUnsafe('SELECT 1'); res.json({ status: 'ok', service: 'Noteora Gateway API', payments: 'disabled' }) }
  catch { res.status(503).json({ status: 'unavailable', service: 'Noteora Gateway API' }) }
})

const registerSchema = z.object({ name: z.string().min(2).max(120), businessName: z.string().min(2).max(160), contactName: z.string().min(2).max(120), contactEmail: z.string().email(), contactPhone: z.string().min(8).max(30), businessType: z.string().min(2).max(80), website: z.string().url().optional(), password: z.string().min(12).max(72) })
app.post('/api/v1/merchants/register', async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body); const base = input.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const merchant = await tx.merchant.create({ data: { name: input.name, slug: `${base}-${random(3)}`, businessName: input.businessName, contactName: input.contactName, contactEmail: input.contactEmail, contactPhone: input.contactPhone, businessType: input.businessType, website: input.website, status: MerchantStatus.PENDING, onboardingStep: 1 } })
      const user = await tx.merchantUser.create({ data: { merchantId: merchant.id, name: input.contactName, email: input.contactEmail.toLowerCase(), passwordHash: await bcrypt.hash(input.password, 12), role: MerchantRole.MERCHANT_OWNER } })
      await tx.gatewayAuditLog.create({ data: { merchantId: merchant.id, actorType: 'MERCHANT', actorId: user.id, action: 'MERCHANT_REGISTERED', entity: 'MERCHANT', entityId: merchant.id, ip: req.ip } })
      return { merchant, user }
    })
    res.status(201).json({ id: result.merchant.id, status: result.merchant.status, message: 'Application submitted for review' })
  } catch (e) { next(e) }
})

app.post('/api/v1/auth/login', async (req, res) => {
  const parsed = z.object({ email: z.string().email(), password: z.string() }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid login request' })
  const user = await prisma.merchantUser.findUnique({ where: { email: parsed.data.email.toLowerCase() } })
  if (!user || !user.active || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) return res.status(401).json({ error: 'Invalid credentials' })
  await prisma.merchantUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
  await audit(user.merchantId, 'MERCHANT_USER', user.id, 'MERCHANT_LOGIN', 'MERCHANT_USER', user.id, req)
  res.json({ token: sign({ merchantId: user.merchantId, userId: user.id, role: user.role }), merchantId: user.merchantId, role: user.role })
})

app.post('/api/v1/credentials/verify', async (req, res) => {
  const parsed = z.object({ apiKey: z.string().min(10), apiSecret: z.string().min(10), environment: z.enum(['SANDBOX','LIVE']) }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ valid: false })
  const credential = await prisma.merchantCredential.findFirst({ where: { apiKey: sha256(parsed.data.apiKey), environment: parsed.data.environment as PaymentEnvironment, active: true } })
  if (!credential || credential.apiSecretHash !== sha256(parsed.data.apiSecret)) return res.status(401).json({ valid: false })
  if (credential.expiresAt && credential.expiresAt <= new Date()) return res.status(401).json({ valid: false })
  const merchant = await prisma.merchant.findUnique({ where: { id: credential.merchantId }, select: { id: true, status: true } })
  if (!merchant || merchant.status !== MerchantStatus.APPROVED) return res.status(403).json({ valid: false })
  res.json({ valid: true, environment: parsed.data.environment, merchantId: merchant.id })
})

app.get('/api/v1/merchant/me', authMerchant, async (req, res) => {
  const { merchantId } = (req as any).user
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId }, include: { users: { select: { id: true, name: true, email: true, role: true, active: true } } } })
  if (!merchant) return res.status(404).json({ error: 'Merchant not found' })
  res.json(merchant)
})

app.patch('/api/v1/merchant/me', authMerchant, requireMerchantPermission(MerchantRole.MERCHANT_OWNER, MerchantRole.MERCHANT_ADMIN), async (req, res, next) => {
  try {
    const input = z.object({ businessName: z.string().min(2).optional(), contactName: z.string().min(2).optional(), contactPhone: z.string().min(8).optional(), website: z.string().url().optional(), address: z.record(z.unknown()).optional() }).parse(req.body)
    const { merchantId, userId } = (req as any).user
    const merchant = await prisma.merchant.update({ where: { id: merchantId }, data: { ...input, address: input.address ? input.address as any : undefined } })
    await audit(merchantId, 'MERCHANT_USER', userId, 'MERCHANT_PROFILE_UPDATED', 'MERCHANT', merchantId, req)
    res.json(merchant)
  } catch (e) { next(e) }
})

app.get('/api/v1/admin/merchants', requireAdmin, async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status as MerchantStatus : undefined
  const merchants = await prisma.merchant.findMany({ where: status ? { status } : undefined, orderBy: { createdAt: 'desc' }, include: { _count: { select: { credentials: true, webhookEndpoints: true } } } })
  res.json(merchants)
})
app.get('/api/v1/admin/overview', requireAdmin, async (_req, res) => {
  const statuses = await prisma.merchant.groupBy({ by: ['status'], _count: { _all: true } })
  const counts = Object.fromEntries(statuses.map(x => [x.status, x._count._all]))
  res.json({ total: counts.PENDING + counts.UNDER_REVIEW + counts.APPROVED + counts.REJECTED + counts.SUSPENDED || 0, pending: counts.PENDING || 0, underReview: counts.UNDER_REVIEW || 0, approved: counts.APPROVED || 0, rejected: counts.REJECTED || 0, suspended: counts.SUSPENDED || 0 })
})
app.patch('/api/v1/admin/merchants/:id/status', requireAdmin, async (req, res, next) => {
  try {
    const input = z.object({ status: z.enum(['UNDER_REVIEW','APPROVED','REJECTED','SUSPENDED']), reason: z.string().max(500).optional() }).parse(req.body)
    if (input.status === 'REJECTED' && !input.reason) return res.status(400).json({ error: 'Rejection reason is required' })
    const merchant = await prisma.merchant.update({ where: { id: String(req.params.id) }, data: { status: input.status as MerchantStatus, rejectionReason: input.reason || null, reviewedAt: new Date(), onboardingStep: input.status === 'APPROVED' ? 4 : undefined } })
    await audit(merchant.id, 'ADMIN', null, `MERCHANT_${input.status}`, 'MERCHANT', merchant.id, req)
    res.json(merchant)
  } catch (e) { next(e) }
})

app.post('/api/v1/merchant/api-keys', authMerchant, requireMerchantPermission(MerchantRole.MERCHANT_OWNER, MerchantRole.MERCHANT_ADMIN, MerchantRole.MERCHANT_DEVELOPER), async (req, res, next) => {
  try {
    const input = z.object({ environment: z.enum(['SANDBOX','LIVE']), expiresAt: z.string().datetime().optional() }).parse(req.body)
    const { merchantId, userId } = (req as any).user
    const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } })
    if (!merchant || merchant.status !== MerchantStatus.APPROVED) return res.status(409).json({ error: 'Only approved merchants may create API keys' })
    const environment = input.environment as PaymentEnvironment
    const keyPrefix = environment === 'LIVE' ? 'nk_live_' : 'nk_test_'
    const apiKey = keyPrefix + random(18); const secret = random(32)
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.merchantCredential.updateMany({ where: { merchantId, environment, active: true }, data: { active: false } })
      await tx.merchantCredential.create({ data: { merchantId, environment, apiKey: sha256(apiKey), apiSecretHash: sha256(secret), expiresAt: input.expiresAt ? new Date(input.expiresAt) : null } })
      await tx.gatewayAuditLog.create({ data: { merchantId, actorType: 'MERCHANT_USER', actorId: userId, action: 'API_KEY_ROTATED', entity: 'MERCHANT_CREDENTIAL', details: { environment } } })
    })
    res.status(201).json({ apiKey, apiSecret: secret, environment, notice: 'Save the secret now. It cannot be retrieved again.' })
  } catch (e) { next(e) }
})
app.post('/api/v1/merchant/api-keys/:id/revoke', authMerchant, requireMerchantPermission(MerchantRole.MERCHANT_OWNER, MerchantRole.MERCHANT_ADMIN), async (req, res) => {
  const { merchantId, userId } = (req as any).user
  const credential = await prisma.merchantCredential.findFirst({ where: { id: String(req.params.id), merchantId } })
  if (!credential) return res.status(404).json({ error: 'Credential not found' })
  await prisma.merchantCredential.update({ where: { id: credential.id }, data: { active: false, revokedAt: new Date() } })
  await audit(merchantId, 'MERCHANT_USER', userId, 'API_KEY_REVOKED', 'MERCHANT_CREDENTIAL', credential.id, req)
  res.json({ revoked: true })
})

app.get('/api/v1/merchant/api-keys', authMerchant, async (req, res) => {
  const { merchantId } = (req as any).user
  const keys = await prisma.merchantCredential.findMany({ where: { merchantId }, orderBy: { createdAt: 'desc' }, select: { id: true, environment: true, active: true, createdAt: true, expiresAt: true, revokedAt: true } })
  res.json(keys)
})

app.put('/api/v1/merchant/webhooks', authMerchant, requireMerchantPermission(MerchantRole.MERCHANT_OWNER, MerchantRole.MERCHANT_ADMIN, MerchantRole.MERCHANT_DEVELOPER), async (req, res, next) => {
  try {
    const input = z.object({ environment: z.enum(['SANDBOX','LIVE']), url: z.string().url(), active: z.boolean().default(true), eventSubscriptions: z.array(z.string()).default([]) }).parse(req.body)
    const { merchantId, userId } = (req as any).user
    const secret = random(32); const environment = input.environment as PaymentEnvironment
    const existing = await prisma.webhookEndpoint.findFirst({ where: { merchantId, environment } })
    const endpoint = existing ? await prisma.webhookEndpoint.update({ where: { id: existing.id }, data: { url: input.url, active: input.active, signingSecretHash: sha256(secret), signingSecretEncrypted: encrypt(secret), eventSubscriptions: input.eventSubscriptions } }) : await prisma.webhookEndpoint.create({ data: { merchantId, environment, url: input.url, active: input.active, signingSecretHash: sha256(secret), signingSecretEncrypted: encrypt(secret), eventSubscriptions: input.eventSubscriptions } })
    await audit(merchantId, 'MERCHANT_USER', userId, 'WEBHOOK_CONFIGURED', 'WEBHOOK_ENDPOINT', endpoint.id, req)
    res.status(existing ? 200 : 201).json({ id: endpoint.id, environment, url: endpoint.url, active: endpoint.active, eventSubscriptions: endpoint.eventSubscriptions, signingSecret: secret, notice: 'Save the webhook signing secret now. It cannot be retrieved again.' })
  } catch (e) { next(e) }
})
app.get('/api/v1/merchant/webhooks', authMerchant, async (req, res) => {
  const { merchantId } = (req as any).user
  const endpoints = await prisma.webhookEndpoint.findMany({ where: { merchantId }, orderBy: { createdAt: 'desc' }, select: { id: true, environment: true, url: true, active: true, eventSubscriptions: true, createdAt: true, updatedAt: true } })
  res.json(endpoints)
})

app.get('/api/v1/merchant/activity', authMerchant, async (req, res) => {
  const { merchantId } = (req as any).user
  const logs = await prisma.gatewayAuditLog.findMany({ where: { merchantId }, orderBy: { createdAt: 'desc' }, take: 100 })
  res.json(logs)
})

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', fields: err.flatten() })
  console.error('Gateway API error', { message: err.message })
  res.status(err.status || 500).json({ error: err.message || 'Internal gateway error' })
})

if (process.env.NODE_ENV !== 'test') {
  const port = Number(process.env.PORT || 5100)
  app.listen(port, () => console.log(`Noteora Gateway API listening on ${port}`))
}
