import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import mongoose from 'mongoose'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { chromium, type Browser, type Page } from '@playwright/test'
import type { ViteDevServer } from '../../client/node_modules/vite/dist/node/index.js'
import type { Server } from 'node:http'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import bcrypt from 'bcryptjs'
import { app } from './index.js'
import { Material, Category, Order, User, Review, Promotion } from './models.js'
import { testActor, testPdf, testPng } from './testFixtures.js'

let mongo:MongoMemoryReplSet,browser:Browser,vite:ViteDevServer,apiServer:Server,base:string,directory:string
let seller:Awaited<ReturnType<typeof testActor>>,buyer:typeof seller,admin:typeof seller,sellerPage:Page,buyerPage:Page,adminPage:Page,materialId:string,categoryId:string
const title='Browser linear algebra notes'
const evidence=fileURLToPath(new URL('../../docs/evidence/phase-c/',import.meta.url))
const login=async(page:Page,actor:typeof seller)=>{await page.goto(base+'/login');await page.locator('#email').fill(actor.user.email);await page.locator('#password').fill('BrowserPassword1!');await page.locator('form button').last().click();await page.waitForURL(actor.user.role==='ADMIN'?'**/admin':'**/dashboard')}
describe.skipIf(process.env.RUN_MARKETPLACE_BROWSER!=='1').sequential('Phase C browser journeys with real isolated MongoDB',()=>{
  beforeAll(async()=>{
    mongo=await MongoMemoryReplSet.create({replSet:{count:1}});await mongoose.connect(mongo.getUri())
    directory=await fs.mkdtemp(path.join(os.tmpdir(),'noteora-browser-marketplace-'));process.env.PRIVATE_UPLOAD_DIR=directory
    await fs.mkdir(evidence,{recursive:true})
    const hash=await bcrypt.hash('BrowserPassword1!',12)
    ;[seller,buyer,admin]=await Promise.all([testActor('USER',hash),testActor('USER',hash),testActor('ADMIN',hash)])
    await User.updateOne({_id:seller.user._id},{name:'Browser Seller',bio:'Carefully written mathematics notes',university:'Example University'})
    const category=await Category.create({name:'Mathematics',slug:'math'});categoryId=String(category._id)
    const extraSeller=await testActor('USER',hash),pdf=path.join(directory,'extra.pdf');await fs.writeFile(pdf,testPdf())
    for(let i=0;i<4;i++)await Material.create({title:`Other resource ${i}`,subject:'Science',academicLevel:'Graduate',price:10+i,status:'APPROVED',seller:extraSeller.user._id,pdfPath:pdf})
    apiServer=await new Promise<Server>(resolve=>{const server=app.listen(0,'127.0.0.1',()=>resolve(server))})
    const {createServer}=await import('../../client/node_modules/vite/dist/node/index.js')
    vite=await createServer({root:fileURLToPath(new URL('../../client',import.meta.url)),server:{host:'127.0.0.1',port:0,proxy:{'/api':`http://127.0.0.1:${(apiServer.address() as any).port}`}}})
    await vite.listen();base=`http://127.0.0.1:${(vite.httpServer!.address() as any).port}`;process.env.CLIENT_URL=base
    browser=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),headless:true})
    sellerPage=await(await browser.newContext({viewport:{width:1440,height:1000}})).newPage()
    buyerPage=await(await browser.newContext({viewport:{width:1365,height:950},acceptDownloads:true})).newPage()
    adminPage=await(await browser.newContext({viewport:{width:1440,height:1000}})).newPage()
    for(const p of [sellerPage,buyerPage,adminPage]){p.setDefaultTimeout(10000);p.on('pageerror',e=>console.error('Browser runtime error:',e.message))}
    await Promise.all([login(sellerPage,seller),login(buyerPage,buyer),login(adminPage,admin)])
    console.log('Buyer, seller and administrator browser sessions ready.')
  },120000)
  afterAll(async()=>{
    if(browser){for(const [label,p] of [['seller',sellerPage],['buyer',buyerPage],['admin',adminPage]] as const){if(p)await p.screenshot({path:path.join(evidence,'latest-'+label+'.png'),fullPage:true}).catch(()=>{})}}
    await browser?.close();await vite?.close();if(apiServer)await new Promise<void>(resolve=>apiServer.close(()=>resolve()))
    await mongoose.disconnect();await mongo?.stop()
    if(directory){for(const name of await fs.readdir(directory))await fs.rm(path.join(directory,name),{force:true});await fs.rmdir(directory)}
  })
  it('seller uploads a draft with thumbnail and preview, edits it and submits for review',async()=>{
    await sellerPage.goto(base+'/seller/upload')
    await sellerPage.getByLabel('Title',{exact:true}).fill(title);await sellerPage.getByLabel('Description',{exact:true}).fill('Detailed linear algebra notes for the first semester.')
    await sellerPage.getByLabel('Subject',{exact:true}).fill('Mathematics');await sellerPage.getByLabel('Academic level',{exact:true}).fill('Undergraduate')
    await sellerPage.getByLabel('Course',{exact:true}).fill('MATH101');await sellerPage.getByLabel('Instructor',{exact:true}).fill('Professor Example')
    await sellerPage.getByLabel('Category',{exact:true}).selectOption(categoryId);await sellerPage.getByLabel('Price in ₹',{exact:true}).fill('75')
    await sellerPage.getByLabel('Save as',{exact:true}).selectOption('DRAFT')
    await sellerPage.locator('input[name=pdf]').setInputFiles({name:'notes.pdf',mimeType:'application/pdf',buffer:testPdf('Paid notes')})
    await sellerPage.locator('input[name=cover]').setInputFiles({name:'cover.png',mimeType:'image/png',buffer:testPng})
    await sellerPage.locator('input[name=preview]').setInputFiles({name:'preview.pdf',mimeType:'application/pdf',buffer:testPdf('Preview excerpt')})
    const uploaded=sellerPage.waitForResponse(r=>r.url().endsWith('/api/v1/materials')&&r.request().method()==='POST')
    await sellerPage.getByRole('button',{name:'Save draft',exact:true}).click();const response=await uploaded;expect(await response.json()).toMatchObject({status:'DRAFT'});expect(response.status()).toBe(201);await sellerPage.waitForURL('**/seller/materials')
    await sellerPage.getByRole('heading',{name:title,exact:true}).waitFor()
    materialId=String((await Material.findOne({title}))!._id)
    expect((await Material.findById(materialId))!.status).toBe('DRAFT')
    await sellerPage.getByRole('button',{name:'Edit',exact:true}).click();await sellerPage.getByLabel('Description',{exact:true}).fill('Updated algebra notes with worked examples.')
    await sellerPage.getByRole('button',{name:'Save changes',exact:true}).click();await sellerPage.getByRole('status').filter({hasText:'Changes saved.'}).waitFor()
    await sellerPage.getByRole('button',{name:'Submit for review',exact:true}).click();await sellerPage.getByRole('status').filter({hasText:'Material status updated.'}).waitFor()
    expect((await Material.findById(materialId))!.status).toBe('PENDING')
    await sellerPage.screenshot({path:path.join(evidence,'seller-materials.png'),fullPage:true})
  },30000)
  it('admin previews and rejects, seller resubmits, admin approves and verifies seller',async()=>{
    await adminPage.goto(base+'/admin/materials');await adminPage.getByRole('heading',{name:title,exact:true}).waitFor()
    const popupPromise=adminPage.waitForEvent('popup');await adminPage.getByRole('button',{name:'Review PDF',exact:true}).click();const popup=await popupPromise;await popup.waitForURL(url=>url.protocol==='blob:');await popup.close()
    const excerptPromise=adminPage.waitForEvent('popup');await adminPage.getByRole('button',{name:'Review preview',exact:true}).click();const excerpt=await excerptPromise;await excerpt.waitForURL(url=>url.protocol==='blob:');await excerpt.close()
    await adminPage.getByLabel('Feedback',{exact:true}).fill('Please improve the description.');await adminPage.getByRole('button',{name:'Reject',exact:true}).click()
    await adminPage.getByRole('status').filter({hasText:'Moderation decision saved.'}).waitFor()
    await sellerPage.reload();await sellerPage.getByText('Feedback: Please improve the description.').waitFor()
    await sellerPage.getByRole('button',{name:'Edit',exact:true}).click();await sellerPage.getByLabel('Description',{exact:true}).fill('Complete worked examples and clear chapter descriptions.');await sellerPage.getByRole('button',{name:'Save changes'}).click()
    await sellerPage.getByRole('status').filter({hasText:'Changes saved.'}).waitFor();await sellerPage.getByRole('button',{name:'Submit for review'}).click()
    await sellerPage.getByRole('status').filter({hasText:'Material status updated.'}).waitFor()
    await adminPage.reload();await adminPage.getByRole('button',{name:'Approve',exact:true}).click();await adminPage.getByRole('status').filter({hasText:'Moderation decision saved.'}).waitFor()
    expect((await Material.findById(materialId))!.status).toBe('APPROVED')
    await adminPage.getByLabel('Material status').selectOption('APPROVED');await adminPage.getByRole('heading',{name:title,exact:true}).waitFor();await adminPage.screenshot({path:path.join(evidence,'admin-moderation.png'),fullPage:true})
    await adminPage.locator('article').filter({hasText:title}).getByRole('button',{name:'Edit material',exact:true}).click();await adminPage.getByLabel('Description',{exact:true}).fill('Administrator-reviewed worked examples and chapter descriptions.')
    await adminPage.getByRole('button',{name:'Save material',exact:true}).click();await adminPage.getByRole('status').filter({hasText:'Material edited.'}).waitFor()
    expect((await Material.findById(materialId))!.status).toBe('PENDING')
    await adminPage.getByLabel('Material status').selectOption('PENDING');await adminPage.getByRole('button',{name:'Approve',exact:true}).click();await adminPage.getByRole('status').filter({hasText:'Moderation decision saved.'}).waitFor()
    await adminPage.goto(base+'/admin/sellers');await adminPage.locator('article').filter({hasText:'Browser Seller'}).getByRole('button',{name:'Verify seller',exact:true}).click()
    await adminPage.getByRole('status').filter({hasText:'Seller status updated.'}).waitFor()
    expect((await User.findById(seller.user._id))!.sellerVerified).toBe(true)
  },30000)
  it('buyer filters, paginates, reads detail/preview and adds/removes cart items',async()=>{
    await buyerPage.goto(base+'/materials?pageSize=2');await buyerPage.getByRole('button',{name:'Next',exact:true}).click();await buyerPage.getByText('Page 2 of 3').waitFor()
    await buyerPage.goto(base+'/materials');await buyerPage.getByLabel('Search notes',{exact:true}).fill('linear algebra');await buyerPage.getByRole('button',{name:'Search',exact:true}).click()
    await buyerPage.getByLabel('Subject',{exact:true}).selectOption('Mathematics');await buyerPage.getByLabel('Category',{exact:true}).selectOption(categoryId);await buyerPage.getByLabel('Academic level',{exact:true}).selectOption('Undergraduate')
    await buyerPage.getByLabel('Minimum price').fill('50');await buyerPage.getByLabel('Maximum price').fill('100');await buyerPage.getByLabel('Sort',{exact:true}).selectOption('rating')
    await buyerPage.waitForURL(url=>url.searchParams.get('search')==='linear algebra'&&url.searchParams.get('sort')==='rating')
    expect(new URL(buyerPage.url()).searchParams.get('search')).toBe('linear algebra')
    expect(await buyerPage.getByLabel('Search notes',{exact:true}).inputValue()).toBe('linear algebra')
    await buyerPage.getByRole('heading',{name:title,exact:true}).waitFor();await buyerPage.screenshot({path:path.join(evidence,'buyer-marketplace.png'),fullPage:true})
    await buyerPage.getByRole('heading',{name:title,exact:true}).click();await buyerPage.getByRole('heading',{name:'Seller',exact:true}).waitFor()
    await buyerPage.getByText('Browser Seller · Verified seller').waitFor();expect(await buyerPage.locator('iframe[title="Material preview"]').count()).toBe(1)
    await buyerPage.getByRole('button',{name:'Add to cart',exact:true}).click();await buyerPage.getByRole('status').filter({hasText:'Added to cart.'}).waitFor()
    await buyerPage.getByRole('link',{name:'View cart',exact:true}).click();await buyerPage.getByText('Material subtotal:',{exact:false}).waitFor()
    await buyerPage.getByRole('button',{name:'Remove',exact:true}).click();await buyerPage.getByText('No records found.',{exact:true}).waitFor()
    await buyerPage.goto(base+'/materials/'+materialId);await buyerPage.getByRole('button',{name:'Add to cart',exact:true}).click();await buyerPage.getByRole('status').filter({hasText:'Added to cart.'}).waitFor()
  },30000)
  it('buyer downloads an existing paid purchase, writes a review and seller sees actual sales analytics',async()=>{
    const m=await Material.findById(materialId)
    // Explicit pre-existing paid-order fixture. No payment processing is invoked or simulated as production success.
    await Order.create({internalOrderId:'BROWSER-PAID-FIXTURE',clientOrderId:'BROWSER-PAID-FIXTURE',user:buyer.user._id,items:[{material:m!._id,title:m!.title,unitPrice:m!.price,seller:seller.user._id}],subtotal:m!.price,total:m!.price,environment:'sandbox',paymentStatus:'PAID',paidAt:new Date()})
    await buyerPage.goto(base+'/orders');const downloading=buyerPage.waitForEvent('download');await buyerPage.getByRole('button',{name:'Download PDF',exact:true}).click();const downloaded=await downloading;expect(await downloaded.failure()).toBeNull()
    await buyerPage.getByRole('button',{name:'Write review',exact:true}).click();await buyerPage.getByLabel('Rating',{exact:true}).selectOption('5');await buyerPage.getByLabel('Comment',{exact:true}).fill('Useful worked examples.');await buyerPage.getByRole('button',{name:'Submit review',exact:true}).click();await buyerPage.getByRole('status').filter({hasText:'Review submitted.'}).waitFor()
    expect(await Review.countDocuments({material:materialId})).toBe(1)
    await sellerPage.goto(base+'/seller/analytics');await sellerPage.getByRole('heading',{name:'daily',exact:true}).waitFor();await sellerPage.locator('main').getByText(title+': 1 sales · ₹75',{exact:true}).waitFor();await sellerPage.screenshot({path:path.join(evidence,'seller-analytics.png'),fullPage:true})
    await sellerPage.goto(base+'/seller/reviews');await sellerPage.getByText('Useful worked examples.',{exact:true}).waitFor()
    await buyerPage.goto(base+'/materials/'+materialId);await buyerPage.getByText('Useful worked examples.',{exact:true}).waitFor()
  },30000)
  it('seller manages promotions, support, profile and persisted preferences',async()=>{
    await sellerPage.goto(base+'/seller/promotions');await sellerPage.getByLabel('Code',{exact:true}).fill('BROWSER10');await sellerPage.getByLabel('Discount %',{exact:true}).fill('10');await sellerPage.getByRole('button',{name:'Save promotion',exact:true}).click();await sellerPage.getByRole('status').filter({hasText:'Promotion saved.'}).waitFor()
    expect(await Promotion.countDocuments({seller:seller.user._id,code:'BROWSER10'})).toBe(1)
    await sellerPage.getByRole('button',{name:'Disable',exact:true}).click();await sellerPage.getByRole('button',{name:'Enable',exact:true}).waitFor()
    await sellerPage.goto(base+'/seller/profile');await sellerPage.getByLabel('Biography',{exact:true}).fill('Updated seller biography');await sellerPage.getByRole('button',{name:'Save profile',exact:true}).click();await sellerPage.getByRole('status').filter({hasText:'Profile updated.'}).waitFor()
    await sellerPage.goto(base+'/seller/settings');await sellerPage.getByLabel('Email updates',{exact:true}).uncheck();await sellerPage.getByRole('button',{name:'Save preferences',exact:true}).click();await sellerPage.getByRole('status').filter({hasText:'Preferences saved.'}).waitFor();await sellerPage.reload();await sellerPage.waitForFunction(()=>Array.from(document.querySelectorAll('label')).some(l=>l.textContent?.includes('Email updates')&&l.querySelector('input')?.checked===false));expect(await sellerPage.getByLabel('Email updates',{exact:true}).isChecked()).toBe(false)
    await sellerPage.goto(base+'/seller/support');await sellerPage.getByLabel('Subject',{exact:true}).fill('Browser support request');await sellerPage.getByLabel('Message',{exact:true}).fill('Please help with my material.');await sellerPage.getByRole('button',{name:'Submit ticket',exact:true}).click();await sellerPage.getByRole('status').filter({hasText:'Support ticket submitted.'}).waitFor();await sellerPage.getByText('Please help with my material.',{exact:true}).waitFor()
  },30000)
  it('retains paid download access after archive and supports mobile buyer/seller navigation',async()=>{
    await sellerPage.goto(base+'/seller/materials');await sellerPage.getByRole('button',{name:'Archive',exact:true}).click();await sellerPage.getByRole('status').filter({hasText:'Material status updated.'}).waitFor()
    await buyerPage.goto(base+'/orders');const downloading=buyerPage.waitForEvent('download');await buyerPage.getByRole('button',{name:'Download PDF',exact:true}).click();expect(await(await downloading).failure()).toBeNull()
    await buyerPage.setViewportSize({width:390,height:844});await buyerPage.goto(base+'/materials');await buyerPage.getByRole('button',{name:'Menu',exact:true}).click();await buyerPage.getByRole('link',{name:'Cart',exact:true}).click();await buyerPage.getByRole('heading',{name:'Shopping cart'}).waitFor()
    expect(await buyerPage.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
    await buyerPage.screenshot({path:path.join(evidence,'buyer-mobile.png'),fullPage:true})
    await sellerPage.setViewportSize({width:390,height:844});await sellerPage.goto(base+'/dashboard');await sellerPage.getByRole('link',{name:'My Materials',exact:true}).click();await sellerPage.getByRole('heading',{name:'My Materials'}).waitFor()
    expect(await sellerPage.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
    await sellerPage.screenshot({path:path.join(evidence,'seller-mobile.png'),fullPage:true})
  },30000)
  it('shows genuine empty and transport-error states and recovers using Retry',async()=>{
    await buyerPage.setViewportSize({width:1365,height:950})
    await buyerPage.goto(base+'/materials?search=no-resource-matches-this-query')
    await buyerPage.getByText('No records found.',{exact:true}).waitFor()
    await buyerPage.getByRole('button',{name:'Clear filters',exact:true}).click()
    await buyerPage.getByRole('heading',{name:'Other resource 0',exact:true}).waitFor()
    await buyerPage.route('**/api/v1/materials?*',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Test service temporarily unavailable'})}))
    await buyerPage.reload();await buyerPage.getByRole('alert').filter({hasText:'Test service temporarily unavailable'}).waitFor()
    expect(await buyerPage.locator('h2').filter({hasText:'Other resource'}).count()).toBe(0)
    await buyerPage.unroute('**/api/v1/materials?*')
    await buyerPage.getByRole('button',{name:'Retry',exact:true}).click()
    await buyerPage.getByRole('heading',{name:'Other resource 0',exact:true}).waitFor()
    await buyerPage.screenshot({path:path.join(evidence,'buyer-retry-recovered.png'),fullPage:true})
  },30000)

  it('never treats a success URL as proof that an unpaid purchase was paid',async()=>{
    const m=await Material.findById(materialId)
    const order=await Order.create({internalOrderId:'BROWSER-PENDING-FIXTURE',clientOrderId:'BROWSER-PENDING-FIXTURE',user:buyer.user._id,items:[{material:m!._id,title:m!.title,unitPrice:m!.price,seller:seller.user._id}],subtotal:m!.price,total:m!.price,environment:'sandbox',paymentStatus:'PENDING'})
    await buyerPage.goto(base+'/payment/success?order='+order._id)
    await buyerPage.getByText('Recorded status:',{exact:false}).waitFor()
    await buyerPage.getByRole('heading',{name:'Payment not confirmed',exact:true}).waitFor()
    expect((await Order.findById(order._id))!.paymentStatus).toBe('PENDING')
    await buyerPage.getByRole('button',{name:'Refresh purchase records',exact:true}).click()
    await buyerPage.getByText('Recorded status:',{exact:false}).waitFor()
    await buyerPage.screenshot({path:path.join(evidence,'payment-return-unconfirmed.png'),fullPage:true})
  },30000)

  it('keeps sales, earnings and subscription pages functional without claiming payouts or activating paid plans',async()=>{
    await sellerPage.setViewportSize({width:1440,height:1000})
    await sellerPage.goto(base+'/seller/sales');await sellerPage.getByText(title,{exact:false}).waitFor()
    await sellerPage.goto(base+'/seller/earnings');await sellerPage.getByText('No records found.',{exact:true}).waitFor()
    await sellerPage.getByText('Payout execution is not available yet',{exact:false}).waitFor()
    await sellerPage.goto(base+'/seller/subscription');await sellerPage.getByRole('heading',{name:'PRO',exact:true}).waitFor()
    expect(await sellerPage.getByText('Paid activation unavailable.',{exact:true}).count()).toBe(2)
    expect((await User.findById(seller.user._id))!.plan).toBe('FREE')
  },30000)

})
