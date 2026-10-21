import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../../generated/prisma/client.js";
import { env } from "../../config/env.js";

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });

// Транзакц дотор дуудагдах модулийн функцүүд энэ төрлийг авна (CLAUDE.md 6.3).
export type Tx = Prisma.TransactionClient;
