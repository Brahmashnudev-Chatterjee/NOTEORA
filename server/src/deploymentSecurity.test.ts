import {describe,it,expect,vi} from 'vitest'
import request from 'supertest'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import {origins,validateDeployment,redact,requestError,redisOptions,gracefulStop,workerHeartbeat} from '../../security/runtime.mjs'
import {app} from './index.js'
const strong='4bc9e352c7164a94a73cd269f0e55c841a6bc59e936c421752e419a0ff7d724c'
const production={NODE_ENV:'production',CLIENT_URL:'https://notes.example.com',JWT_ACCESS_SECRET:strong,DATABASE_URL:'postgresql://app:password@database/noteora?sslmode=require&sslaccept=strict',REDIS_URL:'rediss://:password@redis:6379/1',MONGO_URI:'mongodb://app:password@mongo/noteora?tls=true',GATEWAY_CLIENT_URL:'https://notes.example.com',GATEWAY_JWT_SECRET:strong,GATEWAY_WEBHOOK_ENCRYPTION_KEY:strong,MARKETPLACE_AUTH_URL:'https://marketplace.internal'}
describe('Deployment security controls',()=>{
 it('requires explicit exact HTTPS production origins and strong configuration',()=>{
  for(const value of ['', '*','https://example.com/path','http://example.com','https://user:pass@example.com'])expect(()=>origins(value,true)).toThrow()
  expect(validateDeployment(production,'marketplace').allowed).toEqual(['https://notes.example.com'])
  expect(()=>validateDeployment({...production,JWT_ACCESS_SECRET:'replace-with-a-long-placeholder-secret'},'marketplace')).toThrow()
  expect(()=>validateDeployment({...production,TRUST_PROXY_HOPS:'true'},'marketplace')).toThrow()
 })
 it('rejects plaintext and missing production database/Redis/admin transports',()=>{
  expect(()=>validateDeployment({...production,DATABASE_URL:'postgresql://a:b@database/db'},'gateway')).toThrow()
  expect(()=>validateDeployment({...production,REDIS_URL:'redis://:password@redis'},'marketplace')).toThrow()
  expect(()=>validateDeployment({...production,MONGO_URI:'mongodb://app:password@mongo/db'},'marketplace')).toThrow()
  expect(()=>validateDeployment({...production,MONGO_URI:'mongodb+srv://app:password@mongo/db?tls=false'},'marketplace')).toThrow()
  expect(()=>validateDeployment({...production,MONGO_URI:'mongodb://app:password@mongo/db?tls=true&tlsAllowInvalidCertificates=true'},'marketplace')).toThrow()
  expect(validateDeployment({...production,MONGO_URI:'mongodb://app:password@mongo1:27017,mongo2:27017/db?tls=true&replicaSet=rs'},'marketplace')).toBeTruthy()
  expect(()=>validateDeployment({...production,DATABASE_URL:'postgresql://a:b@database/db?sslmode=require'},'gateway')).toThrow()
  expect(()=>validateDeployment({...production,MARKETPLACE_AUTH_URL:'http://marketplace.internal'},'gateway')).toThrow()
 })
 it('redacts nested credentials, connection URIs and bearer tokens without logging raw errors',()=>{
  const text=JSON.stringify(redact({headers:{authorization:'Bearer secret',cookie:'refresh=secret'},password:'secret',nested:{apiSecret:'secret',url:'postgresql://user:secret@host/db'},message:'Bearer secret'}))
  expect(text).not.toContain('secret');expect(text).not.toContain('user:')
  expect(requestError(Object.assign(new SyntaxError('body contained secret'),{status:400,type:'entity.parse.failed'}))).toEqual({status:400,message:'Invalid request'})
  try{redisOptions('redis://user:private-value@[invalid')}catch(error){expect(String(error)).not.toContain('private-value');expect(JSON.stringify(error)).not.toContain('private-value')}
 })
 it('rejects untrusted request origins and oversized/invalid JSON without reflecting bodies',async()=>{
  expect((await request(app).get('/api/live').set('Origin','https://attacker.example')).status).toBe(403)
  const bad=await request(app).post('/api/v1/auth/login').set('Content-Type','application/json').send('{"password":"private-value",')
  expect(bad.status).toBe(400);expect(JSON.stringify(bad.body)).not.toContain('private-value')
  expect((await request(app).post('/api/v1/auth/login').send({password:'a'.repeat(1100000)})).status).toBe(413)
 })
 it('sets security headers and rate limits repeated authentication failures',async()=>{
  const r=await request(app).get('/api/live');expect(r.headers['x-content-type-options']).toBe('nosniff');expect(r.headers['x-frame-options']).toBe('SAMEORIGIN');expect(r.headers['cache-control']).toBe('no-store')
  let code=0;for(let i=0;i<22;i++)code=(await request(app).post('/api/v1/auth/login').set('Origin','http://localhost:5173').set('X-Noteora-CSRF','1').send({})).status
  expect(code).toBe(429)
 })
 it('decodes Redis URL credentials and preserves TLS/database selection',()=>{
  const config=redisOptions('rediss://worker:p%40ss%3Aword@redis:6380/2');expect(config).toMatchObject({username:'worker',password:'p@ss:word',port:6380,db:2,tls:{}})
 })
 it('rejects production HTTP and accepts HTTPS only through an explicitly trusted proxy',async()=>{
  const previous=process.env.NODE_ENV,proxy=app.get('trust proxy');process.env.NODE_ENV='production'
  try{
   expect((await request(app).get('/api/v1/users/me').set('X-Forwarded-Proto','https')).status).toBe(403)
   app.set('trust proxy',1)
   expect((await request(app).get('/api/v1/users/me').set('X-Forwarded-Proto','https')).status).toBe(401)
   expect((await request(app).get('/api/live')).status).toBe(200)
  }finally{process.env.NODE_ENV=previous;app.set('trust proxy',proxy)}
 })
 it('creates a worker readiness marker only after a healthy check and removes it on shutdown',async()=>{
  const file=path.join(os.tmpdir(),'noteora-health-'+crypto.randomUUID());const stop=workerHeartbeat(file,async()=>true)
  try{await expect.poll(async()=>Number(await fs.readFile(file,'utf8'))).toBeGreaterThan(0)}finally{await stop()}
  await expect(fs.access(file)).rejects.toThrow()
 })
 it('drains a real HTTP listener before cleanup',async()=>{
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const cleanup=vi.fn(async()=>{expect(server.listening).toBe(false)})
  await gracefulStop(server,cleanup);expect(cleanup).toHaveBeenCalledOnce()
 })
})
