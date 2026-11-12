import { afterEach, describe, expect, it, vi } from 'vitest'
import nodemailer from 'nodemailer'
import { deliverAccountLink, readTestMailbox, sendAccountMail } from './emailService.js'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); readTestMailbox() })
describe('Account mail adapters', () => {
  it('captures development links privately without claiming SMTP delivery', async () => {
    vi.stubEnv('EMAIL_TRANSPORT','development');vi.stubEnv('CLIENT_URL','http://localhost:5173')
    await deliverAccountLink('buyer@example.com','verify-email','test-token')
    expect(readTestMailbox()[0].text).toBe('http://localhost:5173/verify-email#token=test-token')
  })
  it('configures authenticated TLS SMTP and submits the expected mail', async () => {
    vi.stubEnv('EMAIL_TRANSPORT','smtp'); vi.stubEnv('SMTP_HOST','smtp.example.com'); vi.stubEnv('SMTP_FROM','Noteora <no-reply@example.com>'); vi.stubEnv('SMTP_USER','sender'); vi.stubEnv('SMTP_PASSWORD','test-only-password')
    const sendMail=vi.fn().mockResolvedValue({accepted:['buyer@example.com']})
    const create=vi.spyOn(nodemailer,'createTransport').mockReturnValue({sendMail} as any)
    await sendAccountMail({to:'buyer@example.com',subject:'Verify',text:'private link'})
    expect(create).toHaveBeenCalledWith(expect.objectContaining({requireTLS:true,logger:false,debug:false,auth:{user:'sender',pass:'test-only-password'}}))
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({to:'buyer@example.com'}))
  })
  it('fails closed for missing SMTP settings and disallows development mail in production', async () => {
    vi.stubEnv('EMAIL_TRANSPORT','smtp'); vi.stubEnv('SMTP_HOST','')
    await expect(sendAccountMail({to:'x@example.com',subject:'Verify',text:'private'})).rejects.toThrow('SMTP configuration')
    vi.stubEnv('NODE_ENV','production'); vi.stubEnv('EMAIL_TRANSPORT','development')
    await expect(sendAccountMail({to:'x@example.com',subject:'Verify',text:'private'})).rejects.toThrow('Invalid email transport')
  })
})
