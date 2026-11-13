import {entitlement} from './services/subscriptionService.js'
import { Router, type Request } from 'express'
import rateLimit from 'express-rate-limit'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { z } from 'zod'
import { User, AuthSession, ActivityLog, UserSession } from './models.js'
import { auth, allow, hashToken, signToken, sessionCookie, sessionLifetimeMs, sessionCsrf, setSessionCookie, clearSessionCookie, type AuthRequest } from './auth.js'
import { deliverAccountLink } from './services/emailService.js'

export const authRoutes = Router()
authRoutes.use((req, _res, next) => { req.body ||= {}; next() })
authRoutes.get('/auth/gateway-admin', auth, allow('ADMIN','SUPER_ADMIN'), (req: AuthRequest,res) => {
  res.setHeader('Cache-Control','no-store'); res.json({id:req.user!.id,role:req.user!.role})
})
const email = z.string().trim().email().max(320).transform(x => x.toLowerCase())
export const passwordSchema = z.string().min(8).refine(x => Buffer.byteLength(x, 'utf8') <= 72, 'Password exceeds 72 UTF-8 bytes')
const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/)
const rate = (limit: number) => rateLimit({ windowMs: 15 * 60 * 1000, limit, standardHeaders: true, legacyHeaders: false })
authRoutes.use('/auth', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next() })
authRoutes.use('/auth', rate(100))
authRoutes.use('/auth/login', rate(20))
authRoutes.use('/auth/forgot-password', rate(10))
authRoutes.use('/auth/resend-verification', rate(10))
const randomToken = () => crypto.randomBytes(32).toString('hex')
export const publicUser = (user: any) => ({ id: String(user._id), name: user.name, email: user.email, role: user.role, plan: user.plan, verified: user.verified, active: user.active })
async function activity(req: Request, action: string, user?: any) {
  await ActivityLog.create({ user: user?._id, actorRole: user?.role, action, entity: 'User', entityId: user ? String(user._id) : undefined, ip: req.ip })
}
async function newSession(req: Request, user: any, res: any) {
  const secret = randomToken(); const expiresAt = new Date(Date.now() + sessionLifetimeMs)
  const session = await AuthSession.create({ user: user._id, refreshTokenHash: hashToken(secret), securityVersion: user.securityVersion, expiresAt, ip: req.ip, userAgent: String(req.headers['user-agent'] || '').slice(0, 512) })
  await UserSession.create({ user: user._id, ip: req.ip, userAgent: String(req.headers['user-agent'] || '').slice(0, 512) })
  setSessionCookie(res, `${session._id}.${secret}`, expiresAt)
  return signToken(user, String(session._id))
}
async function issueVerification(user: any) {
  const token = randomToken()
  await User.updateOne({ _id: user._id, verified: false }, { $set: { verificationToken: hashToken(token), verificationExpires: new Date(Date.now() + 86400000) } })
  await deliverAccountLink(user.email, 'verify-email', token)
}
authRoutes.post('/auth/register', sessionCsrf, rate(10), async (req, res) => {
  const parsed = z.object({ name: z.string().trim().min(1).max(120), email, password: passwordSchema, confirmPassword: z.string().optional(), acceptedTerms: z.literal(true) }).safeParse(req.body)
  if (!parsed.success || (parsed.data.confirmPassword !== undefined && parsed.data.confirmPassword !== parsed.data.password)) return res.status(400).json({ message: 'Valid name, email, password and accepted terms required' })
  const input = parsed.data
  if (await User.exists({ email: input.email })) return res.status(409).json({ message: 'An account with this email already exists' })
  let user
  try { user = await User.create({ name: input.name, email: input.email, password: await bcrypt.hash(input.password, 12) }) }
  catch (error: any) { if (error.code === 11000) return res.status(409).json({ message: 'An account with this email already exists' }); throw error }
  let delivery = 'submitted-to-adapter'
  try { await issueVerification(user) } catch { delivery = 'unavailable'; await activity(req, 'VERIFICATION_DELIVERY_FAILED', user) }
  await activity(req, 'REGISTER', user)
  res.status(201).json({ message: 'Account created. Email verification is pending.', emailTransport: process.env.EMAIL_TRANSPORT || (process.env.NODE_ENV === 'production' ? 'smtp' : 'development'), verificationDelivery: delivery, accessToken: await newSession(req, user, res), requiresEmailVerification: true, user: {...publicUser(user),plan:(await entitlement(String(user._id))).plan.name} })
})
authRoutes.post('/auth/login', sessionCsrf, async (req, res) => {
  const input = z.object({ email, password: z.string().max(1024) }).safeParse(req.body)
  if (!input.success) return res.status(400).json({ message: 'Invalid login request' })
  const user = await User.findOne({ email: input.data.email }).select('+password')
  if (!user || !await bcrypt.compare(input.data.password, user.password)) { await activity(req, 'LOGIN_FAILED'); return res.status(401).json({ message: 'Invalid credentials' }) }
  if (!user.active || user.suspended) return res.status(403).json({ message: 'Account inactive or suspended' })
  await activity(req, 'LOGIN', user)
  res.json({ accessToken: await newSession(req, user, res), user: {...publicUser(user),plan:(await entitlement(String(user._id))).plan.name} })
})
authRoutes.post('/auth/verify', async (req, res) => {
  const input = tokenSchema.safeParse(req.body.token)
  if (!input.success) return res.status(400).json({ message: 'Invalid or expired verification token' })
  const user = await User.findOneAndUpdate({ verificationToken: hashToken(input.data), verificationExpires: { $gt: new Date() }, verified: false, active: true, suspended: { $ne: true } }, { $set: { verified: true }, $unset: { verificationToken: 1, verificationExpires: 1 } }, { new: true })
  if (!user) return res.status(400).json({ message: 'Invalid or expired verification token' })
  await activity(req, 'EMAIL_VERIFIED', user)
  res.json({ verified: true })
})
authRoutes.post('/auth/resend-verification', auth, async (req: AuthRequest, res) => {
  const user = await User.findById(req.user!.id)
  if (user && !user.verified) { try { await issueVerification(user) } catch { await activity(req, 'VERIFICATION_DELIVERY_FAILED', user); return res.status(503).json({ message: 'Verification delivery unavailable. Please retry later.' }) } }
  res.json({ message: 'If verification is needed, a link was submitted to the configured email adapter.' })
})
authRoutes.post('/auth/forgot-password', async (req, res) => {
  const input = email.safeParse(req.body.email)
  if (input.success) {
    const user = await User.findOne({ email: input.data, active: true, suspended: { $ne: true } })
    if (user) {
      const token = randomToken()
      await User.updateOne({ _id: user._id }, { $set: { resetPasswordToken: hashToken(token), resetPasswordExpires: new Date(Date.now() + 3600000) } })
      try { await deliverAccountLink(user.email, 'reset-password', token); await activity(req, 'PASSWORD_RECOVERY_REQUESTED', user) }
      catch { await activity(req, 'RECOVERY_DELIVERY_FAILED', user) }
    }
  }
  res.json({ message: 'If an account exists and delivery is available, reset instructions will be submitted to the configured email adapter.' })
})
authRoutes.post('/auth/reset-password', async (req, res) => {
  const input = z.object({ token: tokenSchema, password: passwordSchema }).safeParse(req.body)
  if (!input.success) return res.status(400).json({ message: 'Valid reset token and 8–72 byte password required' })
  const user = await User.findOneAndUpdate({ resetPasswordToken: hashToken(input.data.token), resetPasswordExpires: { $gt: new Date() }, active: true, suspended: { $ne: true } }, { $set: { password: await bcrypt.hash(input.data.password, 12) }, $inc: { securityVersion: 1 }, $unset: { resetPasswordToken: 1, resetPasswordExpires: 1 } }, { new: true })
  if (!user) return res.status(400).json({ message: 'Reset token is invalid or expired' })
  await AuthSession.updateMany({ user: user._id, revokedAt: null }, { $set: { revokedAt: new Date() } })
  await activity(req, 'PASSWORD_RESET', user); clearSessionCookie(res)
  res.json({ message: 'Password reset successful. Sign in again.' })
})
authRoutes.post('/auth/refresh', sessionCsrf, async (req, res) => {
  const match = /^([a-f0-9]{24})\.([a-f0-9]{64})$/.exec(String(req.cookies?.[sessionCookie] || ''))
  if (!match) { clearSessionCookie(res); return res.status(401).json({ message: 'Invalid refresh session' }) }
  const [, id, secret] = match; const hash = hashToken(secret); const nextSecret = randomToken()
  const session = await AuthSession.findOneAndUpdate({ _id: id, refreshTokenHash: hash, revokedAt: null, expiresAt: { $gt: new Date() } }, { $set: { refreshTokenHash: hashToken(nextSecret), lastUsedAt: new Date() }, $push: { usedRefreshHashes: hash } }, { new: true })
  if (!session) {
    const reused = await AuthSession.findOneAndUpdate({ _id: id, usedRefreshHashes: hash, revokedAt: null }, { $set: { revokedAt: new Date() } })
    if (reused) await ActivityLog.create({ user: reused.user, action: 'REFRESH_REUSE_DETECTED', entity: 'AuthSession', entityId: id, ip: req.ip })
    clearSessionCookie(res); return res.status(401).json({ message: 'Refresh session expired or revoked' })
  }
  const user = await User.findById(session.user)
  if (!user || !user.active || user.suspended || session.securityVersion !== user.securityVersion) {
    await AuthSession.updateOne({ _id: id }, { $set: { revokedAt: new Date() } }); clearSessionCookie(res)
    return res.status(401).json({ message: 'Account or session inactive' })
  }
  setSessionCookie(res, `${id}.${nextSecret}`, session.expiresAt)
  res.json({ accessToken: signToken(user, id), user: {...publicUser(user),plan:(await entitlement(String(user._id))).plan.name} })
})
authRoutes.post('/auth/logout', sessionCsrf, auth, async (req: AuthRequest, res) => {
  await AuthSession.updateOne({ _id: req.user!.sessionId }, { $set: { revokedAt: new Date() } })
  await ActivityLog.create({ user: req.user!.id, action: 'LOGOUT', entity: 'AuthSession', entityId: req.user!.sessionId, ip: req.ip })
  clearSessionCookie(res); res.json({ message: 'Signed out' })
})
authRoutes.post('/auth/logout-all', sessionCsrf, auth, async (req: AuthRequest, res) => {
  await User.updateOne({ _id: req.user!.id }, { $inc: { securityVersion: 1 } })
  await AuthSession.updateMany({ user: req.user!.id, revokedAt: null }, { $set: { revokedAt: new Date() } })
  await ActivityLog.create({ user: req.user!.id, action: 'LOGOUT_ALL', entity: 'User', entityId: req.user!.id, ip: req.ip })
  clearSessionCookie(res); res.json({ message: 'All sessions revoked' })
})
authRoutes.get('/auth/sessions', auth, async (req: AuthRequest, res) => {
  res.json(await AuthSession.find({ user: req.user!.id, revokedAt: null, expiresAt: { $gt: new Date() } }).select('_id ip userAgent createdAt lastUsedAt expiresAt').lean())
})
authRoutes.delete('/auth/sessions/:id', auth, async (req: AuthRequest, res) => {
  const session = await AuthSession.findOneAndUpdate({ _id: req.params.id, user: req.user!.id }, { $set: { revokedAt: new Date() } })
  if (!session) return res.status(404).json({ message: 'Session not found' })
  res.json({ message: 'Session revoked' })
})
authRoutes.patch('/users/password', auth, async (req: AuthRequest, res) => {
  const input = z.object({ currentPassword: z.string().max(1024), password: passwordSchema }).safeParse(req.body)
  if (!input.success) return res.status(400).json({ message: 'Invalid password request' })
  const user = await User.findById(req.user!.id).select('+password')
  if (!user || !await bcrypt.compare(input.data.currentPassword, user.password)) return res.status(400).json({ message: 'Current password is incorrect' })
  const updated = await User.updateOne({ _id: user._id, $or: [{securityVersion:user.securityVersion}, ...(user.securityVersion===0?[{securityVersion:{$exists:false}}]:[])] }, { $set: { password: await bcrypt.hash(input.data.password, 12) }, $inc: { securityVersion: 1 }, $unset: { resetPasswordToken: 1, resetPasswordExpires: 1 } })
  if (!updated.modifiedCount) return res.status(409).json({ message: 'Account changed. Sign in again.' })
  await AuthSession.updateMany({ user: user._id, revokedAt: null }, { $set: { revokedAt: new Date() } })
  await activity(req, 'PASSWORD_CHANGED', user); clearSessionCookie(res)
  res.json({ message: 'Password updated successfully. Sign in again.' })
})
