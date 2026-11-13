import {afterAll,beforeAll,describe,it,expect} from 'vitest'
import {MongoMemoryReplSet} from 'mongodb-memory-server'
import mongoose from 'mongoose'
import {chromium,type Browser,type Page} from '@playwright/test'
import type {ViteDevServer} from '../../client/node_modules/vite/dist/node/index.js'
import type {Server} from 'node:http'
import {fileURLToPath} from 'node:url'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import request from 'supertest'
import {app} from './index.js'
import {Order,Material,Cart,FinancialPolicy} from './models.js'
import {testActor} from './testFixtures.js'
import {decimal} from './services/money.js'

let db:MongoMemoryReplSet,browser:Browser,vite:ViteDevServer,server:Server,base:string,buyer:any,seller:any,other:any,root:any,publicPage:Page,sellerPage:Page,adminPage:Page,materialOrder:string
const evidence=fileURLToPath(new URL('../../docs/evidence/phase-d/',import.meta.url))
const post=(url:string,actor:any)=>request(app).post('/api/v1'+url).auth(actor.token,{type:'bearer'})
async function confirmTestOnly(orderId:string){
  const order=await Order.findById(orderId),id='BROWSER-FIXTURE-'+order!.internalOrderId;await Order.updateOne({_id:orderId},{gatewayOrderId:id})
  const raw=JSON.stringify({event_id:crypto.randomUUID(),event:'order.paid',event_sequence:1,environment:'sandbox',data:{order_id:id,amount:decimal(order!.financial.totalMinor),currency:'INR'}}),stamp=Math.floor(Date.now()/1000)
  const signature='t='+stamp+',v1='+crypto.createHmac('sha256','phase-d-browser-test-secret').update(`${stamp}.${raw}`).digest('hex')
  expect((await request(app).post('/api/v1/payments/webhook').set('Content-Type','application/json').set('X-Signature',signature).send(raw)).status).toBe(200)
}
async function login(page:Page,actor:any){await page.goto(base+'/login');await page.locator('#email').fill(actor.user.email);await page.locator('#password').fill('PhaseDBrowserPassword1!');await page.locator('form button').last().click();await page.waitForURL(actor.user.role==='SUPER_ADMIN'?'**/admin':'**/dashboard')}
describe.skipIf(process.env.RUN_FINANCIAL_BROWSER!=='1').sequential('Phase D browser subscription and accounting journeys',()=>{
  beforeAll(async()=>{
    db=await MongoMemoryReplSet.create({replSet:{count:1}});await mongoose.connect(db.getUri());await Promise.all(Object.values(mongoose.models).map(m=>m.init()))
    process.env.UPI_GATEWAY_ENV='sandbox';process.env.UPI_GATEWAY_SANDBOX_WEBHOOK_SECRET='phase-d-browser-test-secret'
    const hash=await bcrypt.hash('PhaseDBrowserPassword1!',12);[buyer,seller,other,root]=await Promise.all([testActor('USER',hash),testActor('USER',hash),testActor('USER',hash),testActor('SUPER_ADMIN',hash)])
    await FinancialPolicy.create({version:2,tax:{status:'APPROVED',mode:'NONE',rateBps:0,approvalReference:'TEST-ONLY no-tax fixture, not a GST conclusion'},gatewayFee:{status:'APPROVED',rateBps:100,fixedMinor:1,approvalReference:'TEST-ONLY fee fixture'}})
    server=await new Promise<Server>(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))})
    const {createServer}=await import('../../client/node_modules/vite/dist/node/index.js');vite=await createServer({root:fileURLToPath(new URL('../../client',import.meta.url)),server:{host:'127.0.0.1',port:0,proxy:{'/api':`http://127.0.0.1:${(server.address() as any).port}`}}});await vite.listen();base=`http://127.0.0.1:${(vite.httpServer!.address() as any).port}`;process.env.CLIENT_URL=base
    browser=await chromium.launch({headless:true,...process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}})
    publicPage=await browser.newPage({viewport:{width:1365,height:950}});sellerPage=await browser.newPage({viewport:{width:1440,height:1000}});adminPage=await browser.newPage({viewport:{width:1440,height:1000}})
    await fs.mkdir(evidence,{recursive:true});await login(sellerPage,seller);await login(adminPage,root)
  },120000)
  afterAll(async()=>{await browser?.close();await vite?.close();if(server)await new Promise<void>(resolve=>server.close(()=>resolve()));await mongoose.disconnect();await db?.stop()})
  it('shows the same authoritative Free/Pro/Ultra terms publicly and in the seller workspace',async()=>{
    await publicPage.goto(base+'/#pricing');await publicPage.getByRole('heading',{name:'PRO',exact:true}).waitFor()
    const pro=publicPage.locator('article').filter({has:publicPage.getByRole('heading',{name:'PRO',exact:true})});expect(await pro.innerText()).toContain('15 uploads');expect(await pro.innerText()).toContain('199.00')
    await sellerPage.goto(base+'/seller/subscription');await sellerPage.getByRole('heading',{name:'Current plan: FREE',exact:true}).waitFor();expect(await sellerPage.getByRole('heading',{name:'Ultra Pro',exact:true}).count()).toBe(1)
    await sellerPage.screenshot({path:path.join(evidence,'subscription-free.png'),fullPage:true})
  },30000)
  it('retains Free on an unpaid order, activates only on signed test evidence and cancels at term end',async()=>{
    const order=await post('/subscriptions/orders',seller).send({plan:'PRO'});expect(order.status).toBe(201)
    await sellerPage.reload();await sellerPage.getByRole('heading',{name:'Current plan: FREE',exact:true}).waitFor()
    await confirmTestOnly(order.body.orderId)
    await sellerPage.reload();await sellerPage.getByRole('heading',{name:'Current plan: PRO',exact:true}).waitFor()
    await sellerPage.getByRole('button',{name:'Cancel at period end',exact:true}).click();await sellerPage.getByText('Status: CANCELLED',{exact:true}).waitFor()
    await sellerPage.getByRole('heading',{name:'Current plan: PRO',exact:true}).waitFor()
    await sellerPage.screenshot({path:path.join(evidence,'subscription-cancelled.png'),fullPage:true})
  },30000)
  it('shows seller-only net earnings and a reconciliation result without exposing payment override controls',async()=>{
    const notes=await Material.create([{seller:seller.user._id,title:'First seller note',price:100,status:'APPROVED'},{seller:seller.user._id,title:'Second seller note',price:50,status:'APPROVED'},{seller:other.user._id,title:'Other seller note',price:75,status:'APPROVED'}])
    await Cart.create({user:buyer.user._id,items:notes.map(m=>({material:m._id,quantity:1}))})
    const created=await post('/orders',buyer).send({});expect(created.status).toBe(201);materialOrder=created.body.orderId;await confirmTestOnly(materialOrder)
    await sellerPage.goto(base+'/seller/earnings');const net=sellerPage.locator('.card').filter({has:sellerPage.getByText('Seller net earnings',{exact:true})});await net.waitFor();expect(await net.innerText()).toContain('120.00')
    await sellerPage.getByRole('combobox',{name:'Reporting period'}).selectOption('monthly');await sellerPage.getByText('Calendar timezone:',{exact:false}).waitFor();await sellerPage.screenshot({path:path.join(evidence,'seller-financial-report.png'),fullPage:true})
    await adminPage.goto(base+'/admin/orders');const order=await Order.findById(materialOrder),card=adminPage.locator('article').filter({hasText:order!.internalOrderId});await card.getByRole('button',{name:'Check reconciliation',exact:true}).click();await adminPage.getByRole('status').filter({hasText:'Order snapshot and ledger reconcile.'}).waitFor()
    expect(await adminPage.getByRole('button',{name:'Edit',exact:true}).count()).toBe(0)
    await adminPage.screenshot({path:path.join(evidence,'order-reconciliation.png'),fullPage:true})
  },30000)
  it('versions administrator plan changes while preserving current paid terms and displays financial periods',async()=>{
    await adminPage.goto(base+'/admin/subscriptions');const pro=adminPage.locator('section').filter({has:adminPage.getByRole('heading',{name:'PRO',exact:true})})
    await pro.getByLabel('Monthly price',{exact:true}).fill('249.00');await pro.getByLabel('Commission %',{exact:true}).fill('15.00');await adminPage.getByLabel('Change reason',{exact:true}).fill('Test-only catalog version, not a production price change');await adminPage.getByRole('button',{name:'Save catalog version',exact:true}).click();await adminPage.getByRole('status').filter({hasText:'New catalog version saved.'}).waitFor()
    await sellerPage.goto(base+'/seller/subscription');await sellerPage.getByText('Current terms:',{exact:false}).waitFor();expect(await sellerPage.getByText('Current terms:',{exact:false}).innerText()).toContain('20.00%')
    await adminPage.goto(base+'/admin/reports');await adminPage.getByRole('combobox',{name:'Reporting period'}).selectOption('annual');await adminPage.getByText('Subscription net revenue',{exact:true}).waitFor();await adminPage.screenshot({path:path.join(evidence,'admin-financial-report.png'),fullPage:true})
  },30000)
})
