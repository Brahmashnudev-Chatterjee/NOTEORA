import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../src/index.js'

describe('Gateway security foundation', () => {
  it('rejects merchant routes without authentication', async () => {
    const response = await request(app).get('/api/v1/merchant/me')
    expect(response.status).toBe(401)
  })
  it('rejects administrator routes without the administrator token', async () => {
    const response = await request(app).get('/api/v1/admin/overview')
    expect(response.status).toBe(403)
  })
  it('rejects invalid registration payloads', async () => {
    const response = await request(app).post('/api/v1/merchants/register').send({ name: 'x' })
    expect(response.status).toBe(400)
  })
  it('rejects invalid API credential verification payloads', async () => {
    const response = await request(app).post('/api/v1/credentials/verify').send({ apiKey: 'short' })
    expect(response.status).toBe(400)
  })
})
