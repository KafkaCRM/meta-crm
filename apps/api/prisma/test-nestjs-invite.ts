import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { UserService } from '../src/core/user/user.service';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

function loadEnv() {
  const envPath = path.resolve(__dirname, '../../../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.slice(1, -1);
        }
        process.env[key] = value.trim();
      }
    }
  }
}

loadEnv();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Find a tenant
  const tenant = await prisma.tenant.findFirst({
    orderBy: { created_at: 'desc' },
  });
  if (!tenant) {
    console.error('No tenants found');
    return;
  }
  console.log(`Using tenant: ${tenant.name} (${tenant.id})`);

  const roles = await prisma.role.findMany({
    where: { tenant_id: tenant.id },
  });
  if (roles.length === 0) {
    console.error('No roles found for tenant');
    return;
  }
  const roleId = roles[0].id;
  console.log(`Using role: ${roles[0].name} (${roleId})`);

  console.log('Bootstrapping NestJS context...');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  const userService = app.get(UserService);

  const phone = '+1555' + Math.floor(1000000 + Math.random() * 9000000);
  const email = `operator_${Math.floor(Math.random() * 100000)}@test.com`;

  console.log(`Attempting to invite user with phone: ${phone}, email: ${email}...`);
  try {
    const result = await userService.invite(tenant.id, {
      name: 'Test Operator',
      email,
      phone_number: phone,
      role_ids: [roleId],
    });
    console.log('Success!', result);
  } catch (err: any) {
    console.error('Error occurred in UserService.invite:');
    console.error(err);
    if (err.response) {
      console.error('Response details:', JSON.stringify(err.response, null, 2));
    }
  } finally {
    await app.close();
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
