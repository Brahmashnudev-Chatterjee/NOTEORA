import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import PrismaPkg from '@prisma/client'
const { PrismaClient } = PrismaPkg

const exportDir = process.argv.find(a => a.startsWith('--input='))?.split('=')[1] || (path.basename(process.cwd()) === 'server' ? '../database/export' : 'database/export')
const dryRun = process.argv.includes('--dry-run') || !process.env.DATABASE_URL
const reportPath = process.argv.find(a => a.startsWith('--report='))?.split('=')[1] || (path.basename(process.cwd()) === 'server' ? '../database/migration-report.json' : 'database/migration-report.json')
const prisma = dryRun ? null : new PrismaClient()

const uuidFor = value => {
  const hex = crypto.createHash('sha256').update(String(value)).digest('hex')
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`
}
const read = name => {
  const file = path.resolve(exportDir, `${name}.json`)
  if (!fs.existsSync(file)) return []
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}
const oid = value => value && typeof value === 'object' && '$oid' in value ? value.$oid : String(value || '')
const date = value => value ? new Date(value?.$date || value) : null
const decimal = value => Number.isFinite(Number(value)) ? Number(value).toFixed(2) : '0.00'
const commissionRate = value => {
  const rate = Number(value || 0)
  if (!Number.isFinite(rate)) return 0
  return Number((rate > 1 ? rate / 100 : rate).toFixed(4))
}

const collections = {
  users: read('users'), categories: read('categories'), materials: read('materials'), carts: read('carts'),
  orders: read('orders'), paymentwebhookevents: read('paymentwebhookevents'), reviews: read('reviews'),
  sellerledgers: read('sellerledgers'), subscriptionplans: read('subscriptionplans'), subscriptions: read('subscriptions'),
  notifications: read('notifications'), adminaudits: read('adminaudits'), supporttickets: read('supporttickets'),
  usersessions: read('usersessions'), activitylogs: read('activitylogs'), refunds: read('refunds')
}

const report = { dryRun, startedAt: new Date().toISOString(), source: path.resolve(exportDir), collections: {}, errors: [], financial: {}, referentialIntegrity: {} }
for (const [name, rows] of Object.entries(collections)) report.collections[name] = { exported: rows.length }

const validators = []
const validate = (condition, message, collection, index) => { if (!condition) report.errors.push({ collection, index, message }) }
collections.users.forEach((u, i) => validate(u.email && u.password && u.name, 'User requires name, email and password', 'users', i))
collections.materials.forEach((m, i) => { validate(m.title && m.price !== undefined && m.seller, 'Material requires title, price and seller', 'materials', i); validate(Number(m.price) >= 0 && Number(m.price) <= 150, 'Material price outside approved range', 'materials', i) })
collections.orders.forEach((o, i) => { validate(o.internalOrderId && o.user && o.total !== undefined, 'Order requires internal order ID, buyer and total', 'orders', i) })

const userIds = new Set(collections.users.map(u => oid(u._id)))
collections.materials.forEach((m, i) => validate(userIds.has(oid(m.seller)), `Missing seller ${oid(m.seller)}`, 'materials', i))
collections.orders.forEach((o, i) => validate(userIds.has(oid(o.user)), `Missing buyer ${oid(o.user)}`, 'orders', i))
report.referentialIntegrity = { usersReferencedByMaterials: collections.materials.filter(m => !userIds.has(oid(m.seller))).length, usersReferencedByOrders: collections.orders.filter(o => !userIds.has(oid(o.user))).length }

const mongoLedger = collections.sellerledgers.reduce((sum, row) => sum + Number(row.customerPayment || 0), 0)
const postgresExpectedLedger = collections.orders.filter(o => o.paymentStatus === 'PAID').reduce((sum, row) => sum + Number(row.total || 0), 0)
report.financial = { mongodbLedgerCustomerPayments: mongoLedger.toFixed(2), paidOrderTotals: postgresExpectedLedger.toFixed(2) }

if (!dryRun) {
  try {
    await prisma.$transaction(async tx => {
      for (const u of collections.users) {
        await tx.user.upsert({ where: { email: String(u.email).toLowerCase() }, update: { name: u.name, active: u.active !== false, verified: !!u.verified, role: ['USER','MODERATOR','ADMIN','SUPER_ADMIN'].includes(u.role) ? u.role : 'USER', plan: u.plan || 'FREE' }, create: { id: uuidFor(oid(u._id)), legacyId: oid(u._id), name: u.name, email: String(u.email).toLowerCase(), passwordHash: u.password, role: ['USER','MODERATOR','ADMIN','SUPER_ADMIN'].includes(u.role) ? u.role : 'USER', active: u.active !== false, verified: !!u.verified, plan: u.plan || 'FREE', createdAt: date(u.createdAt) || new Date(), updatedAt: date(u.updatedAt) || new Date() } })
      }

      for (const c of collections.categories) {
        await tx.category.upsert({ where: { slug: c.slug }, update: { name: c.name }, create: { id: uuidFor(oid(c._id)), legacyId: oid(c._id), name: c.name, slug: c.slug } })
      }

      for (const m of collections.materials) {
        await tx.material.upsert({ where: { legacyId: oid(m._id) }, update: {}, create: { id: uuidFor(oid(m._id)), legacyId: oid(m._id), sellerId: uuidFor(oid(m.seller)), categoryId: m.category ? uuidFor(oid(m.category)) : null, title: m.title, description: m.description, academicLevel: m.academicLevel, subject: m.subject, tags: m.tags || [], price: decimal(m.price), pdfObjectKey: m.pdfPath || null, coverObjectKey: m.coverImage || null, status: ['PENDING','APPROVED','REJECTED'].includes(m.status) ? m.status : 'PENDING', views: m.views || 0, sales: m.sales || 0, moderationNote: m.moderationNote, createdAt: date(m.createdAt) || new Date(), updatedAt: date(m.updatedAt) || new Date() } })
      }

      for (const o of collections.orders) {
        const orderId = uuidFor(oid(o._id))
        await tx.order.upsert({ where: { internalOrderId: o.internalOrderId }, update: {}, create: { id: orderId, legacyId: oid(o._id), internalOrderId: o.internalOrderId, clientOrderId: o.clientOrderId || o.internalOrderId, gatewayOrderId: o.gatewayOrderId || null, userId: uuidFor(oid(o.user)), subtotal: decimal(o.subtotal), gst: decimal(o.gst || 0), discount: decimal(o.discount || 0), total: decimal(o.total), currency: o.currency || 'INR', environment: String(o.environment).toUpperCase() === 'LIVE' ? 'LIVE' : 'SANDBOX', paymentStatus: ['CREATED','PENDING','UNDER_REVIEW','PAID','FAILED','EXPIRED','REFUNDING','REFUNDED','PARTIALLY_REFUNDED'].includes(o.paymentStatus) ? o.paymentStatus : 'CREATED', gatewayEventSequence: o.gatewayEventSequence || 0, paymentUrl: o.paymentUrl, upiIntent: o.upiIntent, paymentExpiresAt: date(o.paymentExpiresAt), paidAt: date(o.paidAt), createdAt: date(o.createdAt) || new Date(), updatedAt: date(o.updatedAt) || new Date() } })
        for (const item of o.items || []) {
          await tx.orderItem.create({ data: { orderId, materialId: uuidFor(oid(item.material)), title: item.title || 'Migrated material', unitPrice: decimal(item.unitPrice), sellerId: uuidFor(oid(item.seller)) } })
        }
      }

      for (const o of collections.orders) {
        if (!['PAID','FAILED','REFUNDED','PARTIALLY_REFUNDING','REFUNDING','EXPIRED'].includes(String(o.paymentStatus || '').toUpperCase())) continue
        await tx.payment.upsert({ where: { legacyId: oid(o._id) }, update: {}, create: { legacyId: oid(o._id), orderId: uuidFor(oid(o._id)), gatewayOrderId: o.gatewayOrderId || null, providerReference: o.gatewayOrderId || null, amount: decimal(o.total || 0), currency: o.currency || 'INR', environment: String(o.environment).toUpperCase() === 'LIVE' ? 'LIVE' : 'SANDBOX', status: ['PAID','FAILED','REFUNDING','REFUNDED','PARTIALLY_REFUNDING','PARTIALLY_REFUNDED','EXPIRED'].includes(String(o.paymentStatus || '').toUpperCase()) ? String(o.paymentStatus).toUpperCase().replace('PARTIALLY_REFUNDING','PARTIALLY_REFUNDED') : 'FAILED', verifiedAt: String(o.paymentStatus || '').toUpperCase() === 'PAID' ? date(o.paidAt) || date(o.updatedAt) : null, failedAt: String(o.paymentStatus || '').toUpperCase() === 'FAILED' ? date(o.updatedAt) : null } })
      }

      for (const r of collections.reviews) {
        await tx.review.create({ data: { legacyId: oid(r._id), materialId: uuidFor(oid(r.material)), userId: uuidFor(oid(r.user)), orderId: uuidFor(oid(r.order)), rating: r.rating, comment: r.comment, reported: !!r.reported, helpfulUserIds: (r.helpful || []).map(v => uuidFor(oid(v))), createdAt: date(r.createdAt) || new Date(), updatedAt: date(r.updatedAt) || new Date() } })
      }

      for (const l of collections.sellerledgers) {
        await tx.sellerLedger.create({ data: { legacyId: oid(l._id), sellerId: uuidFor(oid(l.seller)), orderId: uuidFor(oid(l.order)), originalPrice: decimal(l.originalPrice), discount: decimal(l.discount), gst: decimal(l.gst), customerPayment: decimal(l.customerPayment), commission: decimal(l.commission), gatewayCost: decimal(l.gatewayCost || 0), sellerPayable: decimal(l.sellerPayable), refundAmount: decimal(l.refundAmount || 0), platformRevenue: decimal(l.platformRevenue), settlementStatus: ['PENDING','READY','PAID'].includes(l.settlementStatus) ? l.settlementStatus : 'PENDING', createdAt: date(l.createdAt) || new Date(), updatedAt: date(l.updatedAt) || new Date() } })
      }

      for (const p of collections.subscriptionplans) {
        await tx.subscriptionPlan.upsert({ where: { name: p.name }, update: {}, create: { legacyId: oid(p._id), name: p.name, price: decimal(p.price || 0), activeListings: p.activeListings || 0, commissionRate: commissionRate(p.commissionRate), featured: !!p.featured, features: p.features || [] } })
      }
      for (const s of collections.subscriptions) {
        await tx.subscription.create({ data: { legacyId: oid(s._id), userId: uuidFor(oid(s.user)), planName: s.plan || 'FREE', active: !!s.active, expiresAt: date(s.expiresAt), createdAt: date(s.createdAt) || new Date(), updatedAt: date(s.updatedAt) || new Date() } })
      }
      for (const n of collections.notifications) {
        await tx.notification.create({ data: { legacyId: oid(n._id), userId: uuidFor(oid(n.user)), title: n.title || '', message: n.message || '', read: !!n.read, type: n.type, createdAt: date(n.createdAt) || new Date() } })
      }
      for (const s of collections.usersessions) {
        await tx.session.create({ data: { userId: uuidFor(oid(s.user)), refreshTokenHash: `mongo-session-${oid(s._id)}`, ip: s.ip, userAgent: s.userAgent, loginAt: date(s.loginAt) || new Date(), logoutAt: date(s.logoutAt), expiresAt: date(s.logoutAt) || new Date('1970-01-01T00:00:00Z') } })
      }
      for (const a of collections.activitylogs) {
        await tx.activityLog.create({ data: { legacyId: oid(a._id), userId: a.user ? uuidFor(oid(a.user)) : null, actorRole: a.actorRole, action: a.action, entity: a.entity, entityId: a.entityId, details: a.details || null, ip: a.ip, createdAt: date(a.createdAt) || new Date() } })
      }
      for (const t of collections.supporttickets) {
        await tx.supportTicket.create({ data: { legacyId: oid(t._id), userId: t.user ? uuidFor(oid(t.user)) : null, subject: t.subject || '', message: t.message || '', status: t.status || 'OPEN', createdAt: date(t.createdAt) || new Date(), updatedAt: date(t.updatedAt) || new Date() } })
      }
      for (const r of collections.refunds) {
        await tx.refund.create({ data: { legacyId: oid(r._id), orderId: uuidFor(oid(r.order)), requestedById: uuidFor(oid(r.requestedBy)), amount: decimal(r.amount || 0), reason: r.reason, status: r.status || 'REQUESTED', providerRefundId: null, providerConfirmed: false, createdAt: date(r.createdAt) || new Date(), updatedAt: date(r.updatedAt) || new Date() } })
      }
      for (const a of collections.adminaudits) {
        await tx.adminAudit.create({ data: { legacyId: oid(a._id), actorId: a.actor ? uuidFor(oid(a.actor)) : null, action: a.action || '', entity: a.entity, entityId: a.entityId, details: a.details || null, ip: a.ip, createdAt: date(a.createdAt) || new Date() } })
      }
    }, { timeout: 120000 })
  } catch (error) {
    report.errors.push({ collection: 'transaction', message: error instanceof Error ? error.message : String(error) })
  }
}

report.completedAt = new Date().toISOString()
report.success = report.errors.length === 0
fs.mkdirSync(path.dirname(path.resolve(reportPath)), { recursive: true })
fs.writeFileSync(path.resolve(reportPath), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
await prisma?.$disconnect()
if (!report.success) process.exitCode = 2
