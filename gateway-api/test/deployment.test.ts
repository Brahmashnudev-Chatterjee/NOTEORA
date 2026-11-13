import {describe,it,expect} from 'vitest'
import request from 'supertest'
import {app} from '../src/index.js'
describe('Gateway request hardening',()=>{
 it('rejects untrusted origins without exposing request credentials',async()=>{
  const r=await request(app).get('/api/live').set('Origin','https://attacker.example')
  expect(r.status).toBe(403);expect(r.body.error).toBe('Origin is not permitted')
 })
 it('limits JSON request size and masks malformed private bodies',async()=>{
  const bad=await request(app).post('/api/v1/auth/login').set('Content-Type','application/json').send('{"apiSecret":"private-value",')
  expect(bad.status).toBe(400);expect(JSON.stringify(bad.body)).not.toContain('private-value')
  const large=await request(app).post('/api/v1/auth/login').send({password:'a'.repeat(1100000)});expect(large.status).toBe(413)
 })
 it('marks responses no-store and emits security headers on liveness',async()=>{
  const r=await request(app).get('/api/live');expect(r.status).toBe(200);expect(r.headers['cache-control']).toBe('no-store');expect(r.headers['x-content-type-options']).toBe('nosniff')
 })
})
