// Explicit development deployment entrypoint. Never accepts production endpoints.
import {PrismaClient} from '../node_modules/@prisma/client/default.js'
import {spawn} from 'node:child_process'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
const root=fileURLToPath(new URL('..',import.meta.url)),schema=path.join(root,'database/prisma/schema.prisma')
export async function deployDevelopmentSchema(raw){
 let url;try{url=new URL(raw)}catch{throw new Error('Invalid DEV_DATABASE_URL; value is intentionally not logged')}
 if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||!/_test$|_development$/.test(url.pathname))throw new Error('Development deploy requires an explicit loopback _test or _development database')
 const db=new PrismaClient({datasources:{db:{url:raw}},log:[]})
 const cli=async args=>{
  const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[path.join(root,'node_modules/prisma/build/index.js'),...args,'--schema',schema],{cwd:root,env:{...process.env,DATABASE_URL:raw},stdio:'inherit',windowsHide:true});child.on('error',reject);child.on('exit',resolve)})
  if(code!==0)throw new Error('Development migration command failed; no history was automatically repaired')
 }
 try{
  await db.$transaction(async tx=>{
   await tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock(93741521)::text')
   const tables=await tx.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname IN ('gateway','marketplace') AND tablename <> '_prisma_migrations'")
   const history=await tx.$queryRawUnsafe("SELECT schemaname FROM pg_tables WHERE tablename='_prisma_migrations' AND schemaname IN ('gateway','marketplace')")
   const baseline='20261108175257_phase5b',file=path.join(root,'database/prisma/migrations',baseline,'migration.sql'),checksum=crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex')
   let rows=[]
   for(const h of history){rows.push(...await tx.$queryRawUnsafe(`SELECT migration_name,checksum,finished_at,rolled_back_at FROM "${h.schemaname}"."_prisma_migrations"`))}
   if(rows.some(r=>!r.finished_at&&!r.rolled_back_at))throw new Error('Failed migration history requires explicit recovery review')
   const recorded=rows.find(r=>r.migration_name===baseline&&r.finished_at)
   if(recorded&&recorded.checksum!==checksum)throw new Error('Baseline checksum mismatch; deployment stopped')
   if(!recorded){
    if(tables.length||rows.length)throw new Error('Nonempty database without verified baseline; deployment stopped')
    // Historical names sort phase5c before phase5b. Apply the tracked baseline,
    // then record that exact, successfully executed SQL; never mark missing SQL applied.
    await cli(['db','execute','--file',file]);await cli(['migrate','resolve','--applied',baseline])
   }
   await cli(['migrate','deploy'])
  },{timeout:120000,maxWait:120000})
 }finally{await db.$disconnect()}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(!process.env.DEV_DATABASE_URL)throw new Error('DEV_DATABASE_URL is required; DATABASE_URL is never used as a fallback')
 await deployDevelopmentSchema(process.env.DEV_DATABASE_URL)
}
