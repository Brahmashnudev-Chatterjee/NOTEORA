import 'dotenv/config'
import express from 'express'
import mongoose from 'mongoose'
import helmet from 'helmet'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import { routes } from './routes.js'

export const app=express();app.set('trust proxy',1);app.use(helmet({crossOriginResourcePolicy:{policy:'cross-origin'}}));app.use(cors({origin:(process.env.CLIENT_URL||'http://localhost:5173').split(','),credentials:true}));app.use(cookieParser());app.use('/api/v1',rateLimit({windowMs:60_000,max:300,standardHeaders:true,legacyHeaders:false}));app.use('/api/v1/payments/webhook',express.raw({type:'application/json',limit:'1mb'}));app.use(express.json({limit:'1mb'}));app.use('/api/v1',routes);app.use('/uploads',(req,res,next)=>{res.status(404).json({message:'Private document access required'})})
app.get('/api/health',async(_req,res)=>{
  const [{ redisPing }, { postgresPing }] = await Promise.all([import('./infrastructure/queues.js'), import('./infrastructure/prisma.js')])
  const [redis,postgres] = await Promise.all([redisPing(),postgresPing()])
  const mongo = mongoose.connection.readyState === 1
  const status = mongo && redis && postgres ? 'ok' : mongo ? 'degraded' : 'starting'
  res.status(status === 'ok' ? 200 : 503).json({status,service:'Noteora API',dependencies:{mongodb:mongo?'healthy':'unavailable',postgres:postgres?'healthy':'unavailable',redis:redis?'healthy':'unavailable'}})
})
app.use((err:any,_req:any,res:any,_next:any)=>{console.error(err);res.status(err.status||500).json({message:err.message||'Internal server error'})})
if(process.env.NODE_ENV!=='test'){const port=Number(process.env.PORT||5000);mongoose.connect(process.env.MONGO_URI||'mongodb://127.0.0.1:27017/noteora').then(()=>app.listen(port,()=>console.log(`Noteora API listening on ${port}`))).catch(e=>{console.error('MongoDB connection failed',e);process.exit(1)})}
