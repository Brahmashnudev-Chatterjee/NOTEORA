import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import type { Request, Response, NextFunction } from 'express'
import { User, AuthSession } from './models.js'

export type AuthRequest = Request & { user?: { id: string; role: string; sessionId: string } }
export const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex')
export const sessionCookie = 'noteora_refresh'
export const sessionLifetimeMs = 7 * 24 * 60 * 60 * 1000
export function getJwtSecret() {
  const secret = process.env.JWT_ACCESS_SECRET
  if ((!secret || secret.length < 32) && process.env.NODE_ENV !== 'test') throw new Error('JWT_ACCESS_SECRET must contain at least 32 characters')
  return secret || 'ci-test-only-access-secret'
}
export function signToken(user: { _id: any }, sessionId: string) {
  return jwt.sign({ id: String(user._id), sid: sessionId }, getJwtSecret(), {
    algorithm: 'HS256', expiresIn: '15m', issuer: 'noteora-marketplace', audience: 'noteora-marketplace-api'
  })
}
export function cookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/api/v1/auth' }
}
export function clearSessionCookie(res: Response) { res.clearCookie(sessionCookie, cookieOptions()) }
export function setSessionCookie(res: Response, value: string, expires: Date) {
  res.cookie(sessionCookie, value, { ...cookieOptions(), expires })
  res.setHeader('Cache-Control', 'no-store')
}
// Only session mutations use cookies; marketplace requests require a bearer token.
export function sessionCsrf(req: Request, res: Response, next: NextFunction) {
  const origins = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map(x => x.trim())
  if (!origins.includes(String(req.headers.origin || '')) || req.headers['x-noteora-csrf'] !== '1') return res.status(403).json({ message: 'Untrusted session request' })
  next()
}
export async function auth(req: AuthRequest, res: Response, next: NextFunction) {
  const match = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization || '')
  if (!match) return res.status(401).json({ message: 'Authentication required' })
  try {
    const claims = jwt.verify(match[1], getJwtSecret(), { algorithms: ['HS256'], issuer: 'noteora-marketplace', audience: 'noteora-marketplace-api' }) as jwt.JwtPayload
    if (typeof claims.id !== 'string' || typeof claims.sid !== 'string') throw new Error('Invalid claims')
    const [user, session] = await Promise.all([
      User.findById(claims.id), AuthSession.findOne({ _id: claims.sid, user: claims.id, revokedAt: null, expiresAt: { $gt: new Date() } })
    ])
    if (!user || !user.active || user.suspended || !session || session.securityVersion !== user.securityVersion) return res.status(401).json({ message: 'Session is inactive or revoked' })
    req.user = { id: String(user._id), role: user.role, sessionId: String(session._id) }
    next()
  } catch { res.status(401).json({ message: 'Invalid or expired token' }) }
}
export function allow(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' })
    next()
  }
}
