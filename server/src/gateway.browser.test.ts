import {afterAll,beforeAll,describe,it,expect} from 'vitest'
import {MongoMemoryReplSet} from 'mongodb-memory-server'
import mongoose from 'mongoose'
import {chromium,type Browser,type Page} from '@playwright/test'
import type {ViteDevServer} from '../../client/node_modules/vite/dist/node/index.js'
import type {Server} from 'node:http'
import http from 'node:http'
import net from 'node:net'
import {fileURLToPath} from 'node:url'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import {app} from './index.js'
import {testActor} from './testFixtures.js'
const gatewaySource=new URL('../../gateway-api/src/',import.meta.url)
function verifySignature(secret:string,timestamp:string,raw:string,signature:string){return crypto.createHmac('sha256',secret).update(timestamp+'.'+raw).digest('hex')===signature}
let workerDB:any;let mongo:MongoMemoryReplSet,browser:Browser,vite:ViteDevServer,marketplace:Server,gateway:Server,receiver:Server,db:any,runtime:any,base:string,merchantPage:Page,adminPage:Page,viewerPage:Page,received:any,root:any
const evidence=fileURLToPath(new URL('../../docs/evidence/phase-e/',import.meta.url)),email='browser-'+crypto.randomUUID()+'@example.com',password='OnlyBrowserDevelopment1!'
async function waitReady(page:Page){await page.getByRole('heading',{name:'Merchant developer workspace',exact:true}).waitFor();await page.getByRole('status').filter({hasText:'Working...'}).waitFor({state:'hidden'})}
describe.skipIf(process.env.RUN_GATEWAY_BROWSER!=='1'||!process.env.TEST_GATEWAY_DATABASE_URL||!process.env.TEST_GATEWAY_REDIS_URL).sequential('Gateway browser with real MongoDB PostgreSQL Redis and Chrome',()=>{
  beforeAll(async()=>{
    const url=new URL(process.env.TEST_GATEWAY_DATABASE_URL!);if(url.hostname!=='127.0.0.1'||!url.pathname.endsWith('_test'))throw new Error('Isolated test PostgreSQL required')
    process.env.DATABASE_URL=process.env.TEST_GATEWAY_RUNTIME_URL||process.env.TEST_GATEWAY_DATABASE_URL
    mongo=await MongoMemoryReplSet.create({replSet:{count:1}});await mongoose.connect(mongo.getUri());await Promise.all(Object.values(mongoose.models).map(m=>m.init()));root=await testActor('SUPER_ADMIN',await bcrypt.hash(password,12))
    marketplace=await new Promise<Server>(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s))});process.env.MARKETPLACE_AUTH_URL='http://127.0.0.1:'+(marketplace.address() as any).port
    const frontendPort=await new Promise<number>(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const port=(s.address() as any).port;s.close(()=>r(port))})});base='http://127.0.0.1:'+frontendPort;process.env.CLIENT_URL=base;process.env.GATEWAY_CLIENT_URL=base
    const gatewayModule=await import(new URL('index.ts',gatewaySource).href);db=gatewayModule.prisma;gateway=await new Promise<Server>(r=>{const s=gatewayModule.app.listen(0,'127.0.0.1',()=>r(s))});const gatewayBase='http://127.0.0.1:'+(gateway.address() as any).port+'/api/v1';process.env.VITE_GATEWAY_API_URL=gatewayBase
    const {createServer}=await import('../../client/node_modules/vite/dist/node/index.js');vite=await createServer({root:fileURLToPath(new URL('../../client',import.meta.url)),server:{host:'127.0.0.1',port:frontendPort,strictPort:true,proxy:{'/api':process.env.MARKETPLACE_AUTH_URL}}});await vite.listen()
    receiver=http.createServer(async(req,res)=>{let raw='';for await(const c of req)raw+=c;received={raw,headers:req.headers};res.writeHead(200);res.end()});await new Promise<void>(r=>receiver.listen(0,'127.0.0.1',r));process.env.GATEWAY_WEBHOOK_DEV_ORIGINS='http://127.0.0.1:'+(receiver.address() as any).port
    const {startWebhookWorker}=await import(new URL('worker.ts',gatewaySource).href);const {PrismaClient}=await import(new URL('../node_modules/@prisma/client/default.js',gatewaySource).href);workerDB=new PrismaClient({datasources:{db:{url:process.env.TEST_GATEWAY_WORKER_URL||process.env.TEST_GATEWAY_DATABASE_URL}}});runtime=startWebhookWorker(workerDB,process.env.TEST_GATEWAY_REDIS_URL!)
    browser=await chromium.launch({headless:true,...process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}});merchantPage=await browser.newPage({viewport:{width:1365,height:1000}});adminPage=await browser.newPage({viewport:{width:1440,height:1000}});viewerPage=await browser.newPage({viewport:{width:390,height:844}})
    for(const page of [merchantPage,adminPage,viewerPage]){page.setDefaultTimeout(8000);page.on('pageerror',error=>console.error('Gateway browser page error:',error.message))}
    await fs.mkdir(evidence,{recursive:true})
  },120000)
  afterAll(async()=>{await browser?.close();await runtime?.close();await workerDB?.$disconnect();await vite?.close();for(const s of [marketplace,gateway,receiver])if(s)await new Promise<void>(r=>s.close(()=>r()));await db?.$disconnect();await mongoose.disconnect();await mongo?.stop()})
  it('registers and signs in a pending merchant while disabling credential provisioning',async()=>{
    await merchantPage.goto(base+'/gateway/merchant');await merchantPage.getByRole('button',{name:'Register merchant',exact:true}).click()
    for(const [label,value] of Object.entries({'Merchant name':'Browser Merchant','Business name':'Browser Business','Contact name':'Browser Owner','Contact phone':'9999999999','Business type':'Education','Email':email,'Password':password}))await merchantPage.getByLabel(label,{exact:true}).fill(value)
    const [registered]=await Promise.all([merchantPage.waitForResponse(r=>r.url().endsWith('/merchants/register')),merchantPage.getByRole('button',{name:'Submit application',exact:true}).click()]);expect(registered.status(),await registered.text()).toBe(201);await merchantPage.getByRole('status').filter({hasText:'application submitted'}).waitFor()
    await merchantPage.getByLabel('Email',{exact:true}).fill(email);await merchantPage.getByLabel('Password',{exact:true}).fill(password);await merchantPage.getByRole('button',{name:'Sign in',exact:true}).click();await waitReady(merchantPage)
    await merchantPage.getByText('Browser Business - Status: PENDING',{exact:true}).waitFor();await merchantPage.getByRole('button',{name:'API keys',exact:true}).click();expect(await merchantPage.getByRole('button',{name:'Generate and rotate key',exact:true}).isDisabled()).toBe(true)
    await merchantPage.screenshot({path:path.join(evidence,'merchant-pending.png'),fullPage:true})
  },30000)
  it('approves via the administrator dashboard backed by real marketplace introspection',async()=>{
    await adminPage.goto(base+'/login');await adminPage.locator('#email').fill(root.user.email);await adminPage.getByLabel('Password',{exact:true}).fill(password);await adminPage.getByRole('button',{name:'Login',exact:true}).click();await adminPage.waitForURL(base+'/admin')
    await adminPage.goto(base+'/gateway/admin');await adminPage.getByLabel('Search merchants',{exact:true}).fill('Browser Business');await adminPage.getByRole('button',{name:'Search',exact:true}).click();await adminPage.getByRole('button',{name:'Review Browser Business',exact:true}).click()
    await adminPage.getByLabel('New merchant status',{exact:true}).selectOption('APPROVED');await adminPage.getByLabel('Review reason',{exact:true}).fill('Browser test-only review');await adminPage.getByRole('button',{name:'Apply status',exact:true}).click();await adminPage.getByRole('status').filter({hasText:'updated and audited'}).waitFor()
    await adminPage.screenshot({path:path.join(evidence,'admin-approved.png'),fullPage:true});await merchantPage.getByRole('button',{name:'Refresh data',exact:true}).click();await merchantPage.getByText('Browser Business - Status: APPROVED',{exact:true}).waitFor()
  },30000)
  it('invites and accepts a viewer without exposing management actions to that member',async()=>{
    await merchantPage.getByRole('button',{name:'Team',exact:true}).click();const viewerEmail='viewer-'+crypto.randomUUID()+'@example.com'
    await merchantPage.getByLabel('Member name',{exact:true}).fill('Browser Viewer');await merchantPage.getByLabel('Member email',{exact:true}).fill(viewerEmail);await merchantPage.getByRole('button',{name:'Create invitation',exact:true}).click();await merchantPage.getByText('One-time secrets - save securely',{exact:true}).waitFor()
    const invitation=JSON.parse(await merchantPage.locator('pre').innerText());await merchantPage.getByRole('button',{name:'Dismiss secrets',exact:true}).click()
    await viewerPage.goto(invitation.acceptUrl);await viewerPage.getByLabel('Password',{exact:true}).fill(password);await viewerPage.locator('form').getByRole('button',{name:'Accept invitation',exact:true}).click();await viewerPage.getByRole('status').filter({hasText:'Invitation accepted'}).waitFor()
    await viewerPage.getByLabel('Email',{exact:true}).fill(viewerEmail);await viewerPage.getByLabel('Password',{exact:true}).fill(password);await viewerPage.getByRole('button',{name:'Sign in',exact:true}).click();await waitReady(viewerPage)
    await viewerPage.getByRole('button',{name:'Team',exact:true}).click();expect(await viewerPage.getByRole('button',{name:'Create invitation',exact:true}).count()).toBe(0)
    await viewerPage.screenshot({path:path.join(evidence,'viewer-mobile.png'),fullPage:true})
  },30000)
  it('generates one-time credentials and sends a signed connectivity test through Redis',async()=>{
    await merchantPage.getByRole('button',{name:'API keys',exact:true}).click();await merchantPage.getByRole('button',{name:'Generate and rotate key',exact:true}).click();await merchantPage.getByText('One-time secrets - save securely',{exact:true}).waitFor()
    const key=JSON.parse(await merchantPage.locator('pre').innerText());expect(key.apiKey).toMatch(/^nk_test_/);await merchantPage.getByRole('button',{name:'Dismiss secrets',exact:true}).click()
    await merchantPage.getByRole('button',{name:'Webhooks',exact:true}).click();await merchantPage.getByLabel('Webhook URL',{exact:true}).fill(process.env.GATEWAY_WEBHOOK_DEV_ORIGINS+'/hook');await merchantPage.getByRole('button',{name:'Save endpoint',exact:true}).click();await merchantPage.getByText('One-time secrets - save securely',{exact:true}).waitFor()
    const config=JSON.parse(await merchantPage.locator('pre').innerText());await merchantPage.getByRole('button',{name:'Dismiss secrets',exact:true}).click();await merchantPage.getByRole('button',{name:'Send connectivity test',exact:true}).click();await merchantPage.getByRole('status').filter({hasText:'Queued connectivity test'}).waitFor()
    const deadline=Date.now()+15000;while(!received&&Date.now()<deadline)await new Promise(r=>setTimeout(r,100));expect(received).toBeTruthy();expect(verifySignature(config.signingSecret,received.headers['x-noteora-timestamp'],received.raw,received.headers['x-noteora-signature'])).toBe(true)
    await merchantPage.getByRole('button',{name:'Deliveries',exact:true}).click();for(let i=0;i<30;i++){await merchantPage.getByRole('button',{name:'Refresh data',exact:true}).click();await waitReady(merchantPage);if((await merchantPage.locator('main').innerText()).includes('DELIVERED'))break;await new Promise(r=>setTimeout(r,100))}
    expect(await merchantPage.locator('main').innerText()).toContain('DELIVERED');expect(JSON.parse(received.raw)).toMatchObject({event:'gateway.test',test:true});await merchantPage.screenshot({path:path.join(evidence,'webhook-delivered.png'),fullPage:true})
  },30000)
  it('shows secret-free key oversight and audited suspension in the administrator interface',async()=>{
    await adminPage.getByRole('button',{name:'Close review',exact:true}).click();await adminPage.getByRole('button',{name:'Review Browser Business',exact:true}).click();await adminPage.getByRole('heading',{name:'API key oversight (metadata only)',exact:true}).waitFor()
    expect(await adminPage.locator('main').innerText()).not.toContain('apiSecretHash');await adminPage.getByLabel('New merchant status',{exact:true}).selectOption('SUSPENDED');await adminPage.getByLabel('Review reason',{exact:true}).fill('Browser test-only suspension');await adminPage.getByRole('button',{name:'Apply status',exact:true}).click();await adminPage.getByRole('status').filter({hasText:'updated and audited'}).waitFor();await adminPage.screenshot({path:path.join(evidence,'admin-suspended.png'),fullPage:true})
    await viewerPage.getByRole('button',{name:'Refresh data',exact:true}).click();await viewerPage.getByRole('alert').waitFor();await viewerPage.getByRole('button',{name:'Sign out merchant session',exact:true}).click();await viewerPage.getByRole('heading',{name:'Merchant sign in',exact:true}).waitFor()
  },30000)
})
