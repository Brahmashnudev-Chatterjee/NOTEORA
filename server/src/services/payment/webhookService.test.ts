import { describe,it,expect } from 'vitest'
import crypto from 'crypto'
import { verifyGatewayWebhook } from './webhookService.js'

describe('gateway webhook verification',()=>{
  it('rejects invalid signatures and accepts valid raw-body signatures',()=>{
    process.env.UPI_GATEWAY_SANDBOX_WEBHOOK_SECRET='test-secret'
    process.env.UPI_GATEWAY_ENV='sandbox'
    const body=Buffer.from('{"event":"order.paid"}')
    const timestamp=Math.floor(Date.now()/1000)
    const digest=crypto.createHmac('sha256','test-secret').update(`${timestamp}.${body.toString()}`).digest('hex')
    expect(verifyGatewayWebhook(body,`t=${timestamp},v1=${digest}`,'sandbox')).toBe(true)
    expect(verifyGatewayWebhook(body,`t=${timestamp},v1=${'0'.repeat(64)}`,'sandbox')).toBe(false)
  })
})
