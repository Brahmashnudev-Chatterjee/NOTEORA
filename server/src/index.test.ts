import { afterAll,beforeAll,describe,it,expect } from 'vitest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import request from 'supertest'
import { app } from './index.js'

let mongo:MongoMemoryServer
beforeAll(async()=>{mongo=await MongoMemoryServer.create();await mongoose.connect(mongo.getUri())})
afterAll(async()=>{await mongoose.disconnect();await mongo.stop()})

describe('authentication API integration',()=>{
  it('registers, rejects duplicate email, and logs in',async()=>{
    const email='buyer.noteora@example.com'
    const first=await request(app).post('/api/v1/auth/register').send({name:'Buyer One',email,password:'StrongPass1!',confirmPassword:'StrongPass1!',acceptedTerms:true})
    expect(first.status).toBe(201)
    expect(first.body.accessToken).toBeTruthy()
    const duplicate=await request(app).post('/api/v1/auth/register').send({name:'Buyer Two',email,password:'StrongPass1!',confirmPassword:'StrongPass1!',acceptedTerms:true})
    expect(duplicate.status).toBe(409)
    const login=await request(app).post('/api/v1/auth/login').send({email,password:'StrongPass1!'})
    expect(login.status).toBe(200)
    expect(login.body.user.email).toBe(email)
  })
  it('rejects protected access without a token and invalid credentials',async()=>{
    const protectedResponse=await request(app).get('/api/v1/users/me')
    expect(protectedResponse.status).toBe(401)
    const login=await request(app).post('/api/v1/auth/login').send({email:'missing@example.com',password:'WrongPass1!'})
    expect(login.status).toBe(401)
  })
  it('returns a non-disclosing forgot-password response',async()=>{
    const response=await request(app).post('/api/v1/auth/forgot-password').send({email:'unknown@example.com'})
    expect(response.status).toBe(200)
    expect(response.body.message).toContain('If an account exists')
  })
})
