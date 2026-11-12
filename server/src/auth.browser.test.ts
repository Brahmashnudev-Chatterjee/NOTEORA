import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { chromium, type Browser, type Page } from '@playwright/test'
import type { ViteDevServer } from '../../client/node_modules/vite/dist/node/index.js'
import type { Server } from 'node:http'
import { fileURLToPath } from 'node:url'
import { app } from './index.js'
import { User } from './models.js'
import { readTestMailbox } from './services/emailService.js'

let mongo: MongoMemoryServer, browser: Browser, page: Page, apiServer: Server, vite: ViteDevServer
let base: string
const enabled = process.env.RUN_AUTH_BROWSER === '1'
describe.skipIf(!enabled).sequential('Phase B real browser authentication journey', () => {
  beforeAll(async () => {
    process.env.EMAIL_TRANSPORT = 'development'
    mongo = await MongoMemoryServer.create(); await mongoose.connect(mongo.getUri())
    apiServer = await new Promise<Server>(resolve => { const server = app.listen(0,'127.0.0.1',() => resolve(server)) })
    const apiPort = (apiServer.address() as any).port
    const {createServer}=await import('../../client/node_modules/vite/dist/node/index.js')
    vite = await createServer({ root: fileURLToPath(new URL('../../client',import.meta.url)), server:{host:'127.0.0.1',port:0,proxy:{'/api':`http://127.0.0.1:${apiPort}`}} })
    await vite.listen(); base = `http://127.0.0.1:${(vite.httpServer!.address() as any).port}`
    process.env.CLIENT_URL = base
    browser = await chromium.launch({ ...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH}:{}),headless:true })
    page = await browser.newPage()
  },120000)
  afterAll(async () => {
    await browser?.close(); await vite?.close()
    if(apiServer)await new Promise<void>(resolve => apiServer.close(() => resolve()))
    await mongoose.disconnect(); await mongo?.stop()
  })
  it('registers through the existing form, verifies email, and revokes on logout', async () => {
    await page.goto(base+'/register')
    await page.locator('#name').fill('Browser Buyer'); await page.locator('#email').fill('browser@example.com')
    await page.locator('#password').fill('BrowserPassword1!')
    await page.locator('input[type=password]').last().fill('BrowserPassword1!')
    await page.locator('input[type=checkbox]').check()
    await page.locator('form button[type=submit], form button').last().click()
    await page.waitForURL('**/dashboard')
    const token=readTestMailbox().at(-1)!.text.split('#token=')[1]
    await page.goto(base+'/verify-email#token='+token)
    await page.getByRole('button',{name:'Confirm email address'}).click()
    await page.getByRole('status').filter({hasText:'Email verified successfully.'}).waitFor()
    expect((await User.findOne({email:'browser@example.com'}))!.verified).toBe(true)
    expect(page.url()).not.toContain(token)
    await page.goto(base+'/dashboard')
    await page.getByRole('button',{name:'Logout',exact:true}).click()
    await page.waitForURL(base+'/')
    expect(await page.evaluate(()=>sessionStorage.getItem('noteora_token'))).toBeNull()
  },30000)
  it('recovers, resets and logs in using the new password', async () => {
    await page.goto(base+'/forgot-password')
    await page.locator('#email').fill('browser@example.com')
    await page.locator('form button').last().click()
    await page.getByText('If an account exists and delivery is available', {exact:false}).waitFor()
    const token=readTestMailbox().at(-1)!.text.split('#token=')[1]
    await page.goto(base+'/reset-password#token='+token)
    await page.getByLabel('New password').fill('ChangedBrowserPassword1!')
    await page.getByRole('button',{name:'Reset password',exact:true}).click()
    await page.getByRole('status').filter({hasText:'Password reset successful.'}).waitFor()
    await page.goto(base+'/login')
    await page.locator('#email').fill('browser@example.com');await page.locator('#password').fill('ChangedBrowserPassword1!')
    await page.locator('form button').last().click();await page.waitForURL('**/dashboard')
    expect(await page.evaluate(()=>!!sessionStorage.getItem('noteora_token'))).toBe(true)
    await page.reload();await page.getByRole('heading',{name:'Dashboard',exact:true}).waitFor()
  },30000)
})
