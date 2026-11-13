// Isolated development verifier: never accepts an existing PostgreSQL URL.
import {createRequire} from 'node:module'
import {pathToFileURL,fileURLToPath} from 'node:url'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import net from 'node:net'
import crypto from 'node:crypto'
import {spawn} from 'node:child_process'
const root=fileURLToPath(new URL('..',import.meta.url)),tools=process.env.NOTEORA_PG_TOOLS||path.join(os.tmpdir(),'noteora-phase-c-pg')
const require=createRequire(path.join(tools,'package.json'))
const {default:EmbeddedPostgres}=await import(pathToFileURL(require.resolve('embedded-postgres')))
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>r(port))})})
const port=await freePort(),redisPort=await freePort(),password=crypto.randomBytes(32).toString('hex'),redisPassword=crypto.randomBytes(32).toString('hex')
const directory=await fs.mkdtemp(path.join(os.tmpdir(),'noteora-phase-e-test-'))
const pg=new EmbeddedPostgres({databaseDir:path.join(directory,'data'),port,user:'noteora_test',password,persistent:true,authMethod:'scram-sha-256',postgresFlags:['-h','127.0.0.1'],onLog:()=>{},onError:()=>{}})
const url=name=>`postgresql://noteora_test:${password}@127.0.0.1:${port}/${name}?schema=gateway`
const redisBinary=process.env.NOTEORA_REDIS_BINARY||path.join(os.tmpdir(),'noteora-phase-e-redis','bin','Redis-7.4.2-Windows-x64-cygwin','redis-server.exe')
let started=false,redis
async function run(args,cwd,env){const status=await new Promise((r,j)=>{const child=spawn(process.execPath,args,{cwd,env:{...process.env,...env},stdio:'inherit',windowsHide:true});child.on('error',j);child.on('exit',r)});if(status!==0)throw new Error('Verification subprocess failed')}
async function migrate(name){
 const client=pg.getPgClient(name,'127.0.0.1');await client.connect()
 const tables=(await client.query("SELECT count(*)::int count FROM pg_tables WHERE schemaname IN ('gateway','marketplace')")).rows[0].count
 await client.end()
 // Historical names sort phase5c before phase5b in Prisma. Preserve existing history;
 // apply and record the exact baseline ONLY in an empty database created by this runner.
 if(!tables){const bootstrap=pg.getPgClient(name,'127.0.0.1');await bootstrap.connect();await bootstrap.query(await fs.readFile(path.join(root,'database/prisma/migrations/20261108175257_phase5b/migration.sql'),'utf8'));await bootstrap.end();await run([path.join(root,'node_modules/prisma/build/index.js'),'migrate','resolve','--applied','20261108175257_phase5b','--schema',path.join(root,'database/prisma/schema.prisma')],root,{DATABASE_URL:url(name),NODE_ENV:'test'})}
 await run([path.join(root,'node_modules/prisma/build/index.js'),'migrate','deploy','--schema',path.join(root,'database/prisma/schema.prisma')],root,{DATABASE_URL:url(name),NODE_ENV:'test'})
}
try{
 await pg.initialise();await pg.start();started=true;await pg.createDatabase('noteora_gateway_test')
 await migrate('noteora_gateway_test');await migrate('noteora_gateway_test');console.log('Fresh and repeated Prisma migration deployment passed.')
 await fs.access(redisBinary)
 redis=spawn(redisBinary,['--bind','127.0.0.1','--port',String(redisPort),'--save','','--appendonly','no','--requirepass',redisPassword],{cwd:directory,stdio:'ignore',windowsHide:true})
 let redisError;redis.on('error',e=>{redisError=e})
 for(let i=0;i<100;i++){if(redisError)throw redisError;const ready=await new Promise(r=>{const s=net.connect(redisPort,'127.0.0.1',()=>{s.destroy();r(true)});s.on('error',()=>r(false))});if(ready)break;if(i===99)throw new Error('Temporary Redis failed to start');await new Promise(r=>setTimeout(r,100))}
 const env={DATABASE_URL:url('noteora_gateway_test'),TEST_GATEWAY_DATABASE_URL:url('noteora_gateway_test'),TEST_DATABASE_URL:url('noteora_gateway_test'),TEST_GATEWAY_REDIS_URL:`redis://:${redisPassword}@127.0.0.1:${redisPort}/0`,NODE_ENV:'test'}
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
