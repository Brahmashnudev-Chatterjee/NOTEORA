import 'dotenv/config'
import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash(process.env.DEV_SEED_PASSWORD || 'ChangeMe123!', 12)
  await prisma.user.upsert({
    where: { email: 'admin@noteora.dev' }, update: { role: UserRole.ADMIN, active: true },
    create: { name: 'Noteora Development Admin', email: 'admin@noteora.dev', passwordHash, role: UserRole.ADMIN, verified: true, active: true }
  })
  await prisma.category.createMany({ data: [
    { name: 'Engineering', slug: 'engineering' }, { name: 'Medical', slug: 'medical' },
    { name: 'Commerce', slug: 'commerce' }, { name: 'Law', slug: 'law' }
  ], skipDuplicates: true })
  console.log('Development seed completed')
}

main().catch(error => { console.error(error); process.exit(1) }).finally(() => prisma.$disconnect())
