// Temporary local PostgreSQL only. Never accepts an existing database URL.
import { createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import net from 'node:net'
import crypto from 'node:crypto'
import { spawn } from 'node:child_process'

const root = fileURLToPath(new URL('..', import.meta.url))
const tools = process.env.NOTEORA_PG_TOOLS || path.join(os.tmpdir(),'noteora-phase-c-pg')
const require = createRequire(path.join(tools,'package.json'))
const {default: EmbeddedPostgres} = await import(pathToFileURL(require.resolve('embedded-postgres')))
const port = await new Promise(resolve => { const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))}) })
const directory=await fs.mkdtemp(path.join(os.tmpdir(),'noteora-gateway-auth-test-'))
const password=crypto.randomBytes(32).toString('hex')
const pg=new EmbeddedPostgres({databaseDir:path.join(directory,'data'),port,user:'noteora_test',password,persistent:true,authMethod:'scram-sha-256',postgresFlags:['-h','127.0.0.1'],onLog:()=>{},onError:()=>{}})
let started=false
try {
  await pg.initialise();await pg.start();started=true
  await pg.createDatabase('noteora_gateway_test')
  const client=pg.getPgClient('noteora_gateway_test','127.0.0.1');await client.connect()
  console.log((await client.query('SELECT version()')).rows[0].version)
  await client.query('CREATE SCHEMA marketplace; CREATE SCHEMA gateway;')
  for(const migration of ['20261108175257_phase5b','20261108_phase5c','20261112_phase_b_gateway_auth']){
    await client.query(await fs.readFile(path.join(root,'database/prisma/migrations',migration,'migration.sql'),'utf8'))
    console.log(`Fresh database migration applied: ${migration}`)
  }
  const columns=await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='gateway' AND table_name='MerchantUser' AND column_name IN ('authVersion','authFamily','authExpiresAt')")
  if(columns.rowCount!==3)throw new Error('Auth migration column verification failed')
  await client.end()
  const testUrl=`postgresql://noteora_test:${password}@127.0.0.1:${port}/noteora_gateway_test?schema=gateway`
  for(const target of [{package:'gateway-api',file:'test/auth.postgres.test.ts'},{package:'server',file:'src/postgres.integration.test.ts'}]){
    const status=await new Promise((resolve,reject)=>{
      const child=spawn(process.execPath,[path.join(root,target.package,'node_modules/vitest/vitest.mjs'),'run',target.file],{cwd:path.join(root,target.package),env:{...process.env,DATABASE_URL:testUrl,TEST_GATEWAY_DATABASE_URL:testUrl,TEST_DATABASE_URL:testUrl,NODE_ENV:'test'},stdio:'inherit',windowsHide:true})
      child.on('error',reject);child.on('exit',resolve)
    })
    if(status!==0)throw new Error(target.package+' PostgreSQL integration tests failed')
  }
  console.log('Fresh migration, 4 gateway auth and 5 marketplace PostgreSQL cases verified; temporary cluster will stop.')
} finally {
  if(started)await pg.stop()
  // Preserve disposable files for inspection rather than recursively deleting paths.
  console.log('Temporary PostgreSQL stopped. No existing database was used.')
}
