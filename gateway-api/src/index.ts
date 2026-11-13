import 'dotenv/config'
import express, { Request, Response, NextFunction } from 'express'
import helmet from 'helmet'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import type { Prisma } from '@prisma/client'
import {installManagement} from './management.js'
import {validateDeployment,requireHttps,corsOrigin,requestError,safeLog,gracefulStop,signals} from '../../security/runtime.mjs'
const deployment=validateDeployment(process.env,'gateway')

const MerchantStatus = { PENDING: 'PENDING', UNDER_REVIEW: 'UNDER_REVIEW', APPROVED: 'APPROVED', REJECTED: 'REJECTED', SUSPENDED: 'SUSPENDED', DISABLED: 'DISABLED' } as const
const MerchantRole = { MERCHANT_OWNER: 'MERCHANT_OWNER', MERCHANT_ADMIN: 'MERCHANT_ADMIN', MERCHANT_DEVELOPER: 'MERCHANT_DEVELOPER', MERCHANT_VIEWER: 'MERCHANT_VIEWER' } as const
const PaymentEnvironment = { SANDBOX: 'SANDBOX', LIVE: 'LIVE' } as const
type MerchantStatusValue = typeof MerchantStatus[keyof typeof MerchantStatus]
type MerchantRoleValue = typeof MerchantRole[keyof typeof MerchantRole]
type PaymentEnvironmentValue = typeof PaymentEnvironment[keyof typeof PaymentEnvironment]

export const prisma = new PrismaClient({ log: [] })
export const app = express()
app.set('trust proxy', deployment.proxy)
app.use(helmet())
app.use((_req,res,next)=>{res.setHeader('Cache-Control','no-store');next()})
app.use(cors({ origin: corsOrigin(deployment.allowed), credentials: true }))
app.use(requireHttps)
app.use(express.json({ limit: '1mb' }))
app.use(rateLimit({ windowMs: 60_000, max: 300, standardHeaders: true, legacyHeaders: false }))

function getGatewaySecret(name: 'GATEWAY_JWT_SECRET' | 'GATEWAY_WEBHOOK_ENCRYPTION_KEY') {
  const secret = process.env[name]
  if (!secret && process.env.NODE_ENV !== 'test') throw new Error(`${name} is required`)
  return secret || (name === 'GATEWAY_JWT_SECRET' ? 'ci-test-only-gateway-secret' : 'ci-test-only-webhook-secret')
}
const jwtSecret = getGatewaySecret('GATEWAY_JWT_SECRET')
if (process.env.NODE_ENV !== 'test' && jwtSecret.length < 32) throw new Error('GATEWAY_JWT_SECRET must contain at least 32 characters')
const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex')
const random = (n = 32) => crypto.randomBytes(n).toString('hex')
const encrypt = (text: string) => {
  const key = crypto.createHash('sha256').update(getGatewaySecret('GATEWAY_WEBHOOK_ENCRYPTION_KEY')).digest()
  const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]); const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

function sign(payload: object, refresh = false) { return jwt.sign(payload, jwtSecret, { algorithm:'HS256', expiresIn:refresh?'7d':'15m', issuer:'noteora-gateway', audience:refresh?'noteora-gateway-refresh':'noteora-gateway-merchant' }) }
const sessionCookie = 'noteora_gateway_refresh'
function cookie(value: string, expires?: Date) { return `${sessionCookie}=${value}; HttpOnly; SameSite=Strict; Path=/api/v1/auth; ${expires?`Expires=${expires.toUTCString()}`:'Max-Age=0'}${process.env.NODE_ENV==='production'?'; Secure':''}` }
function sessionCsrf(req: Request,res: Response,next: NextFunction) {
  const origins=(process.env.GATEWAY_CLIENT_URL||'http://localhost:5173,http://localhost:5174').split(',').map(x=>x.trim())
  if(!origins.includes(String(req.headers.origin||''))||req.headers['x-noteora-csrf']!=='1')return res.status(403).json({error:'Untrusted session request'})
  res.setHeader('Cache-Control','no-store');next()
}
app.use('/api/v1/team/accept',rateLimit({windowMs:15*60*1000,limit:20,standardHeaders:true,legacyHeaders:false}))
app.use('/api/v1/auth',rateLimit({windowMs:15*60*1000,limit:30,standardHeaders:true,legacyHeaders:false}))

async function authMerchant(req: Request, res: Response, next: NextFunction) {
  const bearer=/^Bearer ([^\s]+)$/i.exec(String(req.headers.authorization||''))
  const token=bearer?.[1]
  if (!token) return res.status(401).json({ error: 'Merchant authentication required' })
  try {
    const claims = jwt.verify(token, jwtSecret, {algorithms:['HS256'],issuer:'noteora-gateway',audience:'noteora-gateway-merchant'}) as { merchantId: string; userId: string; version:number; family:string }
    if(typeof claims.userId!=='string'||typeof claims.merchantId!=='string'||typeof claims.family!=='string'||!Number.isInteger(claims.version))return res.status(401).json({error:'Invalid merchant claims'})
    const user = await prisma.merchantUser.findFirst({ where: { id: claims.userId, merchantId: claims.merchantId, active: true, authVersion:claims.version, authFamily:claims.family, authExpiresAt:{gt: new Date()} } })
    if (!user) return res.status(401).json({ error: 'Merchant account is inactive or invalid' })
    const merchant = await prisma.merchant.findUnique({ where: { id: claims.merchantId }, select: { status: true } })
    if (!merchant || merchant.status === MerchantStatus.SUSPENDED || merchant.status === MerchantStatus.REJECTED || merchant.status === MerchantStatus.DISABLED) return res.status(403).json({ error: 'Merchant account is not permitted to access gateway resources' })
    ;(req as any).user = { merchantId: user.merchantId, userId: user.id, role: user.role }
    next()
  } catch { res.status(401).json({ error: 'Invalid or expired token' }) }
}
async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  // Administrator identities are marketplace sessions, never merchant JWTs or a browser-shipped shared secret.
  const match=/^Bearer ([^\s]+)$/i.exec(req.headers.authorization||'')
  const base=process.env.MARKETPLACE_AUTH_URL
  const claims=match?jwt.decode(match[1]) as jwt.JwtPayload|null:null
  if(!match||!base||!claims||claims.iss!=='noteora-marketplace'||claims.aud!=='noteora-marketplace-api')return res.status(403).json({error:'Administrator access required'})
  try {
    const response=await fetch(`${base.replace(/\/$/,'')}/api/v1/auth/gateway-admin`,{headers:{Authorization:`Bearer ${match[1]}`},signal:AbortSignal.timeout(5000),redirect:'error'})
    if(!response.ok)return res.status(403).json({error:'Administrator access required'})
    const identity=await response.json() as {id?:string;role?:string}
    if(!identity.id||!['ADMIN','SUPER_ADMIN'].includes(identity.role||''))return res.status(403).json({error:'Administrator access required'})
    ;(req as any).admin=identity;next()
  }catch{return res.status(503).json({error:'Administrator authentication unavailable'})}
}
function requireMerchantPermission(...roles: MerchantRoleValue[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as { merchantId: string; role: MerchantRoleValue }
    if (!roles.includes(user.role)) return res.status(403).json({ error: 'Insufficient merchant permissions' })
    next()
  }
}
async function audit(merchantId: string | null, actorType: string, actorId: string | null, action: string, entity?: string, entityId?: string, req?: Request) {
  await prisma.gatewayAuditLog.create({ data: { merchantId, actorType, actorId, action, entity, entityId, ip: req?.ip, details: {} } })
}

app.get('/api/live',(_req,res)=>res.json({status:'alive'}))
app.get('/api/health', async (_req, res) => {
  try { await prisma.$queryRawUnsafe('SELECT 1'); res.json({ status: 'ok', service: 'Noteora Gateway API', payments: 'disabled' }) }
  catch { res.status(503).json({ status: 'unavailable', service: 'Noteora Gateway API' }) }
})

const registerSchema = z.object({ name: z.string().min(2).max(120), businessName: z.string().min(2).max(160), contactName: z.string().min(2).max(120), contactEmail: z.string().email(), contactPhone: z.string().min(8).max(30), businessType: z.string().min(2).max(80), website: z.string().url().optional(), password: z.string().min(12).refine(x=>Buffer.byteLength(x,'utf8')<=72) })
app.post('/api/v1/merchants/register', rateLimit({windowMs:15*60*1000,limit:10,standardHeaders:true,legacyHeaders:false}), async (req, res, next) => {
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

app.post('/api/v1/auth/login', sessionCsrf, async (req, res) => {
  const parsed = z.object({ email: z.string().email(), password: z.string().max(1024) }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid login request' })
  const user = await prisma.merchantUser.findUnique({ where: { email: parsed.data.email.toLowerCase() } })
  if (!user || !user.active || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) { await audit(null,'ANONYMOUS',null,'MERCHANT_LOGIN_FAILED',undefined,undefined,req); return res.status(401).json({ error: 'Invalid credentials' }) }
  const merchant=await prisma.merchant.findUnique({where:{id:user.merchantId},select:{status:true}})
  if(!merchant||['SUSPENDED','REJECTED','DISABLED'].includes(merchant.status))return res.status(403).json({error:'Merchant account is inactive'})
  const family=random(24); const expires=new Date(Date.now()+7*86400000)
  const updated=await prisma.merchantUser.update({where:{id:user.id},data:{lastLoginAt:new Date(),authVersion:{increment:1},authFamily:family,authExpiresAt:expires}})
  const claims={merchantId:user.merchantId,userId:user.id,version:updated.authVersion,family}
  await audit(user.merchantId, 'MERCHANT_USER', user.id, 'MERCHANT_LOGIN', 'MERCHANT_USER', user.id, req)
  res.setHeader('Set-Cookie',cookie(sign(claims,true),expires))
  res.json({ token:sign(claims),merchantId:user.merchantId,role:user.role })
})
app.post('/api/v1/auth/refresh',sessionCsrf,async(req,res)=>{
  try{
    const raw=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(sessionCookie+'='))?.slice(sessionCookie.length+1)
    if(!raw)throw new Error('Missing refresh')
    const claims=jwt.verify(raw,jwtSecret,{algorithms:['HS256'],issuer:'noteora-gateway',audience:'noteora-gateway-refresh'}) as {userId:string;merchantId:string;version:number;family:string}
    if(typeof claims.userId!=='string'||typeof claims.merchantId!=='string'||typeof claims.family!=='string'||!Number.isInteger(claims.version))throw new Error('Invalid claims')
    const user=await prisma.merchantUser.findFirst({where:{id:claims.userId,merchantId:claims.merchantId,active:true,authFamily:claims.family,authExpiresAt:{gt:new Date()}}})
    const merchant=await prisma.merchant.findUnique({where:{id:claims.merchantId},select:{status:true}})
    if(!user||!merchant||['REJECTED','SUSPENDED','DISABLED'].includes(merchant.status))throw new Error('Inactive account')
    const updated=await prisma.merchantUser.updateMany({where:{id:user.id,authVersion:claims.version,authFamily:claims.family},data:{authVersion:{increment:1}}})
    if(!updated.count){
      await prisma.merchantUser.updateMany({where:{id:user.id,authFamily:claims.family},data:{authFamily:null,authVersion:{increment:1}}})
      await audit(user.merchantId,'MERCHANT_USER',user.id,'REFRESH_REUSE_DETECTED','MERCHANT_USER',user.id,req)
      throw new Error('Refresh reuse')
    }
    const next={userId:user.id,merchantId:user.merchantId,version:claims.version+1,family:claims.family}
    const refresh=jwt.sign(next,jwtSecret,{algorithm:'HS256',expiresIn:Math.max(1,Math.floor((user.authExpiresAt!.getTime()-Date.now())/1000)),issuer:'noteora-gateway',audience:'noteora-gateway-refresh'})
    res.setHeader('Set-Cookie',cookie(refresh,user.authExpiresAt!))
    res.json({token:sign(next),role:user.role,merchantId:user.merchantId})
  }catch{res.setHeader('Set-Cookie',cookie(''));res.status(401).json({error:'Invalid or revoked refresh session'})}
})
app.post('/api/v1/auth/logout',sessionCsrf,authMerchant,async(req,res)=>{
  const {userId,merchantId}=(req as any).user
  await prisma.merchantUser.update({where:{id:userId},data:{authVersion:{increment:1},authFamily:null,authExpiresAt:null}})
  await audit(merchantId,'MERCHANT_USER',userId,'MERCHANT_LOGOUT','MERCHANT_USER',userId,req)
  res.setHeader('Set-Cookie',cookie(''));res.json({signedOut:true})
})

app.use('/api/v1/merchant',rateLimit({windowMs:60000,limit:process.env.NODE_ENV==='production'?60:300,standardHeaders:true,legacyHeaders:false}))
installManagement(app,prisma,{authMerchant,requireAdmin,requireMerchantPermission})

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', fields: err.flatten() })
  const status=err.status||(err.code==='P2002'?409:err.code==='P2025'?404:500)
  err.status=status;const error=requestError(err);safeLog('GATEWAY_REQUEST_FAILED',{status:error.status});res.status(error.status).json({error:error.message})
})

if (process.env.NODE_ENV !== 'test') {
  const port = Number(process.env.PORT || 5100)
  const server=app.listen(port, () => console.log(`Noteora Gateway API listening on ${port}`))
  signals(()=>gracefulStop(server,()=>prisma.$disconnect()))
}
