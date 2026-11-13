import 'dotenv/config'
import express from 'express'
import mongoose from 'mongoose'
import helmet from 'helmet'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import { routes } from './routes.js'
import { getJwtSecret } from './auth.js'
import {origins,validateDeployment,requireHttps,corsOrigin,requestError,safeLog,gracefulStop,signals} from '../../security/runtime.mjs'
const deployment=validateDeployment(process.env,'marketplace')

export const app=express();app.set('trust proxy',deployment.proxy);app.use(helmet({crossOriginResourcePolicy:{policy:'cross-origin'}}));app.use(cors({origin:corsOrigin(process.env.NODE_ENV==='test'?()=>origins(process.env.CLIENT_URL||'http://localhost:5173',false):deployment.allowed),credentials:true}));app.use(requireHttps);app.use((_req,res,next)=>{res.setHeader('Cache-Control','no-store');next()});app.use(cookieParser());app.use('/api/v1',rateLimit({windowMs:60_000,max:300,standardHeaders:true,legacyHeaders:false}));app.use('/api/v1/payments/webhook',express.raw({type:'application/json',limit:'1mb'}));app.use(express.json({limit:'1mb'}));app.use('/api/v1',routes);app.use('/uploads',(req,res,next)=>{res.status(404).json({message:'Private document access required'})})
app.get('/api/live',(_req,res)=>res.json({status:'alive'}))
app.get('/api/health',async(_req,res)=>{
  const [{ redisPing }, { postgresPing }] = await Promise.all([import('./infrastructure/queues.js'), import('./infrastructure/prisma.js')])
  const [redis,postgres] = await Promise.all([redisPing(),postgresPing()])
  const mongo = mongoose.connection.readyState === 1
  const status = mongo && redis && postgres ? 'ok' : mongo ? 'degraded' : 'starting'
  res.status(status === 'ok' ? 200 : 503).json({status,service:'Noteora API',dependencies:{mongodb:mongo?'healthy':'unavailable',postgres:postgres?'healthy':'unavailable',redis:redis?'healthy':'unavailable'}})
})
app.use((err:any,_req:any,res:any,_next:any)=>{const error=requestError(err);safeLog('API_REQUEST_FAILED',{status:error.status});res.status(error.status).json({message:error.message})})
if(process.env.NODE_ENV!=='test'){
 getJwtSecret();const port=Number(process.env.PORT||5000)
 mongoose.connect(process.env.MONGO_URI||'mongodb://127.0.0.1:27017/noteora').then(()=>{
  const server=app.listen(port,()=>console.log(`Noteora API listening on ${port}`))
  signals(()=>gracefulStop(server,async()=>{const [{closeInfrastructure},{prisma}]=await Promise.all([import('./infrastructure/queues.js'),import('./infrastructure/prisma.js')]);await closeInfrastructure();await prisma.$disconnect();await mongoose.disconnect()}))
 }).catch(()=>{safeLog('MONGODB_CONNECTION_FAILED');process.exitCode=1})
}
