import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'
import type { Prisma } from '@prisma/client'

const databaseUrl = process.env.TEST_DATABASE_URL || 'postgresql://noteora_app:noteora_app_dev_password@127.0.0.1:5432/noteora?schema=marketplace'
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } })
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`
const ids: { users: string[]; categories: string[]; materials: string[]; orders: string[] } = { users: [], categories: [], materials: [], orders: [] }

beforeAll(async () => { await prisma.$queryRawUnsafe('SELECT 1') })
afterAll(async () => {
  await prisma.orderItem.deleteMany({ where: { order: { clientOrderId: { contains: suffix } } } }).catch(() => undefined)
  await prisma.sellerLedger.deleteMany({ where: { order: { clientOrderId: { contains: suffix } } } }).catch(() => undefined)
  await prisma.review.deleteMany({ where: { comment: { contains: suffix } } }).catch(() => undefined)
  await prisma.order.deleteMany({ where: { clientOrderId: { contains: suffix } } }).catch(() => undefined)
  await prisma.material.deleteMany({ where: { id: { in: ids.materials } } }).catch(() => undefined)
  await prisma.category.deleteMany({ where: { id: { in: ids.categories } } }).catch(() => undefined)
  await prisma.user.deleteMany({ where: { id: { in: ids.users } } }).catch(() => undefined)
  await prisma.$disconnect()
})

describe.sequential('PostgreSQL integration', () => {
  it('connects and performs user registration relationships', async () => {
    const buyer = await prisma.user.create({ data: { name: 'Buyer', email: `buyer-${suffix}@example.com`, passwordHash: 'test-only-hash', role: 'USER' } })
    const seller = await prisma.user.create({ data: { name: 'Seller', email: `seller-${suffix}@example.com`, passwordHash: 'test-only-hash', role: 'USER' } })
    ids.users.push(buyer.id, seller.id)
    expect(await prisma.user.count({ where: { email: { in: [buyer.email, seller.email] } } })).toBe(2)
  })

  it('enforces duplicate email and creates material/category ownership', async () => {
    const buyerEmail = `buyer-${suffix}@example.com`
    await expect(prisma.user.create({ data: { name: 'Duplicate', email: buyerEmail, passwordHash: 'hash' } })).rejects.toBeTruthy()
    const seller = await prisma.user.findUniqueOrThrow({ where: { email: `seller-${suffix}@example.com` } })
    const category = await prisma.category.create({ data: { name: `Engineering-${suffix}`, slug: `engineering-${suffix}` } })
    ids.categories.push(category.id)
    const material = await prisma.material.create({ data: { sellerId: seller.id, categoryId: category.id, title: `Finance Notes ${suffix}`, price: '100.00', status: 'APPROVED' } })
    ids.materials.push(material.id)
    const owned = await prisma.material.findUnique({ where: { id: material.id }, include: { category: true, seller: true } })
    expect(owned?.seller.id).toBe(seller.id)
    expect(owned?.category?.id).toBe(category.id)
  })

  it('creates an order, item and consistent seller ledger', async () => {
    const buyer = await prisma.user.findUniqueOrThrow({ where: { email: `buyer-${suffix}@example.com` } })
    const seller = await prisma.user.findUniqueOrThrow({ where: { email: `seller-${suffix}@example.com` } })
    const material = await prisma.material.findFirstOrThrow({ where: { id: { in: ids.materials } } })
    const clientOrderId = `client-${suffix}`
    const order = await prisma.order.create({ data: { internalOrderId: `internal-${suffix}`, clientOrderId, userId: buyer.id, subtotal: '100.00', gst: '18.00', discount: '0.00', total: '118.00', paymentStatus: 'PAID' } })
    ids.orders.push(order.id)
    await prisma.orderItem.create({ data: { orderId: order.id, materialId: material.id, title: material.title, unitPrice: '100.00', sellerId: seller.id } })
    await prisma.sellerLedger.create({ data: { sellerId: seller.id, orderId: order.id, originalPrice: '100.00', discount: '0.00', gst: '18.00', customerPayment: '118.00', commission: '20.00', gatewayCost: '0.00', sellerPayable: '80.00', refundAmount: '0.00', platformRevenue: '20.00' } })
    expect(await prisma.sellerLedger.count({ where: { orderId: order.id } })).toBe(1)
  })

  it('rolls back failed transactions', async () => {
    const email = `rollback-${suffix}@example.com`
    await expect(prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.user.create({ data: { name: 'Rollback', email, passwordHash: 'hash' } })
      throw new Error('forced rollback')
    })).rejects.toThrow('forced rollback')
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull()
  })

  it('rejects duplicate ledger and order requests and supports concurrent updates', async () => {
    const order = await prisma.order.findFirstOrThrow({ where: { id: { in: ids.orders } } })
    const seller = await prisma.user.findUniqueOrThrow({ where: { email: `seller-${suffix}@example.com` } })
    await expect(prisma.sellerLedger.create({ data: { sellerId: seller.id, orderId: order.id, originalPrice: '100', discount: '0', gst: '18', customerPayment: '118', commission: '20', sellerPayable: '80', platformRevenue: '20' } })).rejects.toBeTruthy()
    await expect(prisma.order.create({ data: { internalOrderId: order.internalOrderId, clientOrderId: `other-${suffix}`, userId: order.userId, subtotal: '1', gst: '0', total: '1' } })).rejects.toBeTruthy()
    const material = await prisma.material.findFirstOrThrow({ where: { id: { in: ids.materials } } })
    await Promise.all([1, 2].map(() => prisma.material.update({ where: { id: material.id }, data: { views: { increment: 1 } } })))
    expect((await prisma.material.findUniqueOrThrow({ where: { id: material.id } })).views).toBe(2)
  })
})
