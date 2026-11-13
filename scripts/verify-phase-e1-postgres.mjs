// Isolated development verifier: never accepts an existing PostgreSQL URL.
import {createRequire} from 'node:module'
import {pathToFileURL,fileURLToPath} from 'node:url'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import net from 'node:net'
import crypto from 'node:crypto'
import {spawn} from 'node:child_process'
import assert from 'node:assert/strict'
import {deployDevelopmentSchema} from './deploy-development-schema.mjs'
const root=fileURLToPath(new URL('..',import.meta.url)),tools=process.env.NOTEORA_PG_TOOLS||path.join(os.tmpdir(),'noteora-phase-c-pg')
const require=createRequire(path.join(tools,'package.json'))
const {default:EmbeddedPostgres}=await import(pathToFileURL(require.resolve('embedded-postgres')))
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>r(port))})})
const port=await freePort(),redisPort=await freePort(),password=crypto.randomBytes(32).toString('hex'),redisPassword=crypto.randomBytes(32).toString('hex')
const directory=await fs.mkdtemp(path.join(os.tmpdir(),'noteora-phase-e1-test-'))
const pg=new EmbeddedPostgres({databaseDir:path.join(directory,'data'),port,user:'noteora_test',password,persistent:true,authMethod:'scram-sha-256',postgresFlags:['-h','127.0.0.1'],onLog:()=>{},onError:()=>{}})
const url=name=>`postgresql://noteora_test:${password}@127.0.0.1:${port}/${name}?schema=gateway`
const redisBinary=process.env.NOTEORA_REDIS_BINARY||path.join(os.tmpdir(),'noteora-phase-e-redis','bin','Redis-7.4.2-Windows-x64-cygwin','redis-server.exe')
let started=false,redis
async function run(args,cwd,env){const status=await new Promise((r,j)=>{const child=spawn(process.execPath,args,{cwd,env:{...process.env,...env},stdio:'inherit',windowsHide:true});child.on('error',j);child.on('exit',r)});if(status!==0)throw new Error('Verification subprocess failed')}
async function migrate(name){await deployDevelopmentSchema(url(name))}

try{
 await pg.initialise();await pg.start();started=true;await pg.createDatabase('noteora_gateway_test')
 await migrate('noteora_gateway_test');await migrate('noteora_gateway_test');console.log('Fresh and repeated Prisma migration deployment passed.')
 await assert.rejects(deployDevelopmentSchema('postgresql://fixture:fixture@not-a-real-host.invalid/production'),/loopback/)
 await pg.createDatabase('noteora_untracked_test');const untracked=pg.getPgClient('noteora_untracked_test','127.0.0.1');await untracked.connect();await untracked.query('CREATE SCHEMA gateway;CREATE TABLE gateway.untracked(id integer)');await untracked.end()
 await assert.rejects(deployDevelopmentSchema(url('noteora_untracked_test')),/Nonempty database/)
 await pg.createDatabase('noteora_ordering_failure_test');let expectedFailure=false
 try{await run([path.join(root,'node_modules/prisma/build/index.js'),'migrate','deploy','--schema',path.join(root,'database/prisma/schema.prisma')],root,{DATABASE_URL:url('noteora_ordering_failure_test'),NODE_ENV:'test'})}catch{expectedFailure=true}
 assert.equal(expectedFailure,true,'Bare historical deployment must reproduce the documented ordering defect')
 await assert.rejects(deployDevelopmentSchema(url('noteora_ordering_failure_test')),/Failed migration history/)
 console.log('Migration guards verified: nonlocal/nonempty/failed-history rejected; original bare-deploy ordering defect reproduced. Expected failure was isolated.')

 // Test dedicated runtime roles after schemas exist. Credentials stay in memory.
 const roleClient=pg.getPgClient('noteora_gateway_test','127.0.0.1');await roleClient.connect()
 const runtimePasswords={noteora_gateway_api:crypto.randomBytes(32).toString('hex'),noteora_gateway_worker:crypto.randomBytes(32).toString('hex')}
 for(const [role,pass] of Object.entries(runtimePasswords)){
  const sql=(await roleClient.query("SELECT format('CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION',$1::text,$2::text) statement",[role,pass])).rows[0].statement
  await roleClient.query(sql)
 }
 await roleClient.query(await fs.readFile(path.join(root,'database/security/gateway-runtime-grants.sql'),'utf8'))
 await roleClient.end()
 const runtimeUrl=role=>`postgresql://${role}:${runtimePasswords[role]}@127.0.0.1:${port}/noteora_gateway_test?schema=gateway`

 await fs.access(redisBinary)
 redis=spawn(redisBinary,['--bind','127.0.0.1','--port',String(redisPort),'--save','','--appendonly','no','--requirepass',redisPassword],{cwd:directory,stdio:'ignore',windowsHide:true})
 let redisError;redis.on('error',e=>{redisError=e})
 for(let i=0;i<100;i++){if(redisError)throw redisError;const ready=await new Promise(r=>{const s=net.connect(redisPort,'127.0.0.1',()=>{s.destroy();r(true)});s.on('error',()=>r(false))});if(ready)break;if(i===99)throw new Error('Temporary Redis failed to start');await new Promise(r=>setTimeout(r,100))}
 const env={DATABASE_URL:url('noteora_gateway_test'),TEST_GATEWAY_DATABASE_URL:url('noteora_gateway_test'),TEST_DATABASE_URL:url('noteora_gateway_test'),TEST_GATEWAY_REDIS_URL:`redis://:${redisPassword}@127.0.0.1:${redisPort}/0`,TEST_GATEWAY_RUNTIME_URL:runtimeUrl('noteora_gateway_api'),TEST_GATEWAY_WORKER_URL:runtimeUrl('noteora_gateway_worker'),NODE_ENV:'test'}
 for(const target of [{package:'gateway-api',file:null},{package:'server',file:'src/postgres.integration.test.ts'},...(process.env.RUN_GATEWAY_BROWSER==='1'?[{package:'server',file:'src/gateway.browser.test.ts'}]:[])]){
  await run([path.join(root,target.package,'node_modules/vitest/vitest.mjs'),'run',...(target.file?[target.file]:[])],path.join(root,target.package),env)
 }
 // Full gateway-table logical fixture round trip; not a production backup command.
 const source=pg.getPgClient('noteora_gateway_test','127.0.0.1');await source.connect()
 const id=crypto.randomUUID();await source.query('INSERT INTO gateway."Merchant" (id,name,slug,status,"updatedAt") VALUES ($1,$2,$3,$4,NOW())',[id,'Backup fixture',crypto.randomUUID(),'APPROVED'])
 await source.query('INSERT INTO gateway."GatewayAuditLog" (id,"merchantId","actorType",action) VALUES ($1,$2,$3,$4)',[crypto.randomUUID(),id,'SYSTEM','BACKUP_RESTORE_FIXTURE'])
 await source.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
 const tables=(await source.query("SELECT tablename FROM pg_tables WHERE schemaname='gateway' AND tablename <> '_prisma_migrations' ORDER BY tablename")).rows.map(x=>x.tablename)
 const edges=(await source.query("SELECT a.relname child,b.relname parent FROM pg_constraint c JOIN pg_class a ON a.oid=c.conrelid JOIN pg_class b ON b.oid=c.confrelid JOIN pg_namespace n ON n.oid=a.relnamespace WHERE c.contype='f' AND n.nspname='gateway'")).rows
 const ordered=[];while(ordered.length<tables.length){const next=tables.find(t=>!ordered.includes(t)&&edges.filter(e=>e.child===t&&e.parent!==t&&tables.includes(e.parent)).every(e=>ordered.includes(e.parent)));if(!next)throw new Error('Unexpected cyclic gateway schema');ordered.push(next)}
 const snapshot={};for(const table of ordered)snapshot[table]=(await source.query(`SELECT to_jsonb(t) record FROM gateway."${table}" t ORDER BY id`)).rows.map(x=>x.record)
 await source.query('COMMIT');await fs.writeFile(path.join(directory,'gateway-fixture-backup.json'),JSON.stringify(snapshot))
 await pg.createDatabase('noteora_restore_test');await migrate('noteora_restore_test')
 const restored=pg.getPgClient('noteora_restore_test','127.0.0.1');await restored.connect();await restored.query('BEGIN')
 const saved=JSON.parse(await fs.readFile(path.join(directory,'gateway-fixture-backup.json'),'utf8'))
 for(const table of ordered)if(saved[table].length)await restored.query(`INSERT INTO gateway."${table}" SELECT * FROM json_populate_recordset(NULL::gateway."${table}",$1::json)`,[JSON.stringify(saved[table])])
 await restored.query('COMMIT')
 for(const table of ordered){const rows=(await restored.query(`SELECT to_jsonb(t) record FROM gateway."${table}" t ORDER BY id`)).rows.map(x=>x.record);if(JSON.stringify(rows)!==JSON.stringify(saved[table]))throw new Error('Restore mismatch: '+table)}
 console.log(`Gateway logical fixture backup/restore: ${ordered.length} tables identical; no production database used.`)
 await restored.end();await source.end()
}finally{
 if(redis){const stopped=new Promise(r=>redis.once('exit',r));redis.kill();await stopped}
 if(started)await pg.stop()
 console.log('Disposable PostgreSQL and Redis stopped. No existing service was used.')
}
