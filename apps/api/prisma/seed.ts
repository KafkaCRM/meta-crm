import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

// Load DATABASE_URL from root .env
if (!process.env.DATABASE_URL) {
  const { readFileSync } = require('fs');
  const { resolve } = require('path');
  const envContent = readFileSync(resolve(__dirname, '../../../.env'), 'utf-8');
  const match = envContent.match(/DATABASE_URL\s*=\s*(.+)/);
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
  console.log('Seeding database...');

  // Create default subscription plan
  const plan = await prisma.subscriptionPlan.upsert({
    where: { name: 'Enterprise' },
    update: {},
    create: {
      name: 'Enterprise',
      max_branches: 50,
      max_users: 200,
      max_plugins: 25,
      price_monthly: 499.0,
    },
  });
  console.log(`Plan: ${plan.name}`);

  // Create platform owner
  const ownerEmail = 'admin@meta-crm.local';
  const ownerPassword = 'Admin123!';
  const passwordHash = await bcrypt.hash(ownerPassword, 12);

  const platformUser = await prisma.platformUser.upsert({
    where: { email: ownerEmail },
    update: {},
    create: {
      name: 'Platform Owner',
      email: ownerEmail,
      password_hash: passwordHash,
      status: 'active',
    },
  });

  // Assign platform_owner role
  await prisma.platformUserRole.upsert({
    where: {
      platform_user_id_role: {
        platform_user_id: platformUser.id,
        role: 'platform_owner',
      },
    },
    update: {},
    create: {
      platform_user_id: platformUser.id,
      role: 'platform_owner',
    },
  });
  console.log(`Platform user: ${platformUser.name} (${platformUser.email})`);
  console.log(`Password: ${ownerPassword}`);

  // Create test tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'acme-corp' },
    update: {},
    create: {
      name: 'Acme Corp',
      slug: 'acme-corp',
      industry: 'healthcare',
      status: 'active',
    },
  });

  // Assign plan to tenant
  await prisma.tenantPlan.upsert({
    where: { tenant_id: tenant.id },
    update: {},
    create: {
      tenant_id: tenant.id,
      plan_id: plan.id,
    },
  });
  console.log(`Tenant: ${tenant.name} (${tenant.slug})`);

  // Create test tenant user
  const tenantEmail = 'user@acme.local';
  const tenantPassword = 'User123!';
  const tenantPasswordHash = await bcrypt.hash(tenantPassword, 12);

  const tenantUser = await prisma.user.upsert({
    where: {
      email_tenant_id: {
        email: tenantEmail,
        tenant_id: tenant.id,
      },
    },
    update: {},
    create: {
      tenant_id: tenant.id,
      name: 'Tenant User',
      email: tenantEmail,
      password_hash: tenantPasswordHash,
      status: 'active',
    },
  });

  // Create default role for tenant
  const role = await prisma.role.upsert({
    where: {
      tenant_id_name: {
        tenant_id: tenant.id,
        name: 'admin',
      },
    },
    update: {},
    create: {
      tenant_id: tenant.id,
      name: 'admin',
      slug: 'admin',
      description: 'Tenant administrator',
    },
  });

  // Assign role to tenant user
  await prisma.userRole.upsert({
    where: {
      user_id_role_id: {
        user_id: tenantUser.id,
        role_id: role.id,
      },
    },
    update: {},
    create: {
      user: { connect: { id: tenantUser.id } },
      role: { connect: { id: role.id } },
      tenant: { connect: { id: tenant.id } },
    },
  });
  console.log(`Tenant user: ${tenantUser.name} (${tenantUser.email})`);
  console.log(`Password: ${tenantPassword}`);

  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
