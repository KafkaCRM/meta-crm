import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

if (!process.env.DATABASE_URL) {
  const { readFileSync } = require('fs');
  const { resolve } = require('path');
  const envContent = readFileSync(resolve(__dirname, '../.env'), 'utf-8');
  const match = envContent.match(/DATABASE_URL\s*=\s*["']?([^"'\r\n\s]+)["']?/);
  if (match) {
    process.env.DATABASE_URL = match[1].trim();
  }
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Querying Platform Users...');
  const users = await prisma.platformUser.findMany();
  console.log('Users in DB:', JSON.stringify(users, null, 2));

  console.log('Querying Platform User Roles...');
  const roles = await prisma.platformUserRole.findMany();
  console.log('Roles in DB:', JSON.stringify(roles, null, 2));
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
