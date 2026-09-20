import { PrismaClient } from "@prisma/client";

// standard Next.js dev-mode singleton, avoids exhausting Postgres connections
// on every hot-reload
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
