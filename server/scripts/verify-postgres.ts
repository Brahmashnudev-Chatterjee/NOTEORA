import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const counts = {
    users: await prisma.user.count(), sessions: await prisma.session.count(),
    activityLogs: await prisma.activityLog.count(), categories: await prisma.category.count(),
    materials: await prisma.material.count(), orders: await prisma.order.count(),
    sellerLedgers: await prisma.sellerLedger.count()
  }
  const integrity = await prisma.$queryRawUnsafe<Array<{ violations: bigint }>>('SELECT COUNT(*) AS violations FROM marketplace."Order" o LEFT JOIN marketplace."User" u ON u.id = o."userId" WHERE u.id IS NULL')
  console.log(JSON.stringify({ counts, orderBuyerViolations: Number(integrity[0]?.violations || 0) }, null, 2))
}

main().catch(error => { console.error(error); process.exit(1) }).finally(() => prisma.$disconnect())
