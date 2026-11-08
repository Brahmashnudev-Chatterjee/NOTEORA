import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { noteoraPrisma?: PrismaClient }

export const prisma = globalForPrisma.noteoraPrisma || new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'] })
if (process.env.NODE_ENV !== 'production') globalForPrisma.noteoraPrisma = prisma

export async function postgresPing(): Promise<boolean> {
  try { await prisma.$queryRawUnsafe('SELECT 1'); return true } catch { return false }
}

export async function closePostgres() {
  await prisma.$disconnect()
}
