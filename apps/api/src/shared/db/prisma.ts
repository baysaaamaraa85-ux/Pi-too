import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../../generated/prisma/client.js";
import { env } from "../../config/env.js";

// Аппликейшн pitoo_app хэрэглэгчээр холбогдоно, superuser-ээр биш (ФБШ-24).
const adapter = new PrismaPg({ connectionString: env.APP_DATABASE_URL });

export const prisma = new PrismaClient({ adapter });

// Транзакц дотор дуудагдах модулийн функцүүд энэ төрлийг авна (CLAUDE.md 6.3).
export type Tx = Prisma.TransactionClient;
