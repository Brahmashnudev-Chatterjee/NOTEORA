import jwt from 'jsonwebtoken'
import type { Request, Response, NextFunction } from 'express'

export type AuthRequest = Request & { user?: { id: string; role: string } }

export function signToken(user: { _id: any; role: string }) {
  return jwt.sign({ id: String(user._id), role: user.role }, process.env.JWT_ACCESS_SECRET || 'dev-access', { expiresIn: '15m' })
}

export function auth(req: AuthRequest, res: Response, next: NextFunction) {
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  const token = bearer || req.cookies?.accessToken
  if (!token) return res.status(401).json({ message: 'Authentication required' })
  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET || 'dev-access') as { id: string; role: string }
    req.user = decoded
    next()
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' })
  }
}

export function allow(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' })
    next()
  }
}
