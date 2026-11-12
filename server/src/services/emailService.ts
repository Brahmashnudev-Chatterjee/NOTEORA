import nodemailer from 'nodemailer'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

type Mail = { to: string; subject: string; text: string }
const testMailbox: Mail[] = []
export function readTestMailbox() {
  if (process.env.NODE_ENV !== 'test') throw new Error('Test mailbox unavailable')
  return testMailbox.splice(0)
}
export async function sendAccountMail(mail: Mail) {
  const transport = process.env.EMAIL_TRANSPORT || (process.env.NODE_ENV === 'production' ? 'smtp' : 'development')
  if (transport === 'smtp') {
    if (!process.env.SMTP_HOST || !process.env.SMTP_FROM) throw new Error('SMTP configuration required')
    const sender = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true', requireTLS: process.env.SMTP_SECURE !== 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
      connectionTimeout: 10000, socketTimeout: 15000, logger: false, debug: false
    })
    await sender.sendMail({ from: process.env.SMTP_FROM, ...mail })
    return
  }
  if (transport !== 'development' || process.env.NODE_ENV === 'production') throw new Error('Invalid email transport')
  if (process.env.NODE_ENV === 'test') { testMailbox.push(mail); return }
  const directory = path.resolve('.dev-mail')
  await fs.mkdir(directory, { recursive: true, mode: 0o700 })
  await fs.writeFile(path.join(directory, `${crypto.randomUUID()}.json`), JSON.stringify(mail), { mode: 0o600, flag: 'wx' })
}
export async function deliverAccountLink(email: string, purpose: 'verify-email' | 'reset-password', token: string) {
  const base = (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].replace(/\/$/, '')
  // Fragments stay out of server request logs and Referer headers.
  await sendAccountMail({ to: email, subject: purpose === 'verify-email' ? 'Verify your Noteora email' : 'Reset your Noteora password', text: `${base}/${purpose}#token=${token}` })
}
