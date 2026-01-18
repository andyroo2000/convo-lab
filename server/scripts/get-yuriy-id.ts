import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../', '.env.production'), override: true });

const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

const user = await prisma.user.findUnique({
  where: { email: 'nemtsov@gmail.com' },
  select: { id: true }
});

console.log(user?.id);

await prisma.$disconnect();
