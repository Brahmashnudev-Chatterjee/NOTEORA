import {afterAll,beforeAll,describe,it,expect} from 'vitest'
import {MongoMemoryServer} from 'mongodb-memory-server'
import mongoose from 'mongoose'
import crypto from 'node:crypto'
import request from 'supertest'
import {app} from './index.js'
import {User,UserSession} from './models.js'
import {hashToken,signToken} from './auth.js'
let mongo:MongoMemoryServer
// Synthetic records exercise legacy shapes. Preserved account material is never replayed.
describe('Historical authentication shapes against current security controls',()=>{
 beforeAll(async()=>{mongo=await MongoMemoryServer.create();await mongoose.connect(mongo.getUri());await User.init()})
 afterAll(async()=>{await mongoose.disconnect();await mongo?.stop()})
 it('rejects missing verification expiry and legacy plaintext token storage',async()=>{
  const token=crypto.randomBytes(32).toString('hex')
  const user=await User.create({name:'Legacy shape fixture',email:crypto.randomUUID()+'@example.com',password:'TEST_ONLY_NOT_A_REAL_PASSWORD_HASH',active:true,verified:false,verificationToken:hashToken(token)})
  expect((await request(app).post('/api/v1/auth/verify').send({token})).status).toBe(400)
  await User.updateOne({_id:user._id},{$set:{verificationToken:token,verificationExpires:new Date(Date.now()+60000)}})
  expect((await request(app).post('/api/v1/auth/verify').send({token})).status).toBe(400)
  expect((await User.findById(user._id))!.verified).toBe(false)
 })
 it('does not treat a legacy analytics session record as an authentication session',async()=>{
  const user=await User.create({name:'Legacy session fixture',email:crypto.randomUUID()+'@example.com',password:'TEST_ONLY_NOT_A_REAL_PASSWORD_HASH',active:true})
  const logged=await UserSession.create({user:user._id,ip:'127.0.0.1',userAgent:'Synthetic local security test'})
  const access=signToken(user,String(logged._id))
  expect((await request(app).get('/api/v1/users/me').auth(access,{type:'bearer'})).status).toBe(401)
 })
})
