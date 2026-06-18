import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

import { PLUGIN_CATALOGUE } from '../src/plugins/registry/plugin-catalogue';


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

  // Create test tenant with default capability
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'acme-corp' },
    update: {
      config_json: { enabled_capabilities: ['capability/appointment'] }
    },
    create: {
      name: 'Acme Corp',
      slug: 'acme-corp',
      industry: 'healthcare',
      status: 'active',
      config_json: { enabled_capabilities: ['capability/appointment'] },
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
      slug: 'tenant_admin',
      is_system_role: true,
      description: 'Tenant administrator',
    },
  });

  // Assign role to tenant user
  const existingRole = await prisma.userRole.findFirst({
    where: { user_id: tenantUser.id, role_id: role.id },
  });
  if (!existingRole) {
    await prisma.userRole.create({
      data: {
        user: { connect: { id: tenantUser.id } },
        role: { connect: { id: role.id } },
        tenant: { connect: { id: tenant.id } },
      },
    });
  }
  console.log(`Tenant user: ${tenantUser.name} (${tenantUser.email})`);
  console.log(`Password: ${tenantPassword}`);

  // Seed standard plugin catalog registries and entitle compatible/universal ones to Acme Corp
  console.log('Seeding standard plugin registries...');
  for (const entry of PLUGIN_CATALOGUE) {
    let reg = await prisma.pluginRegistry.findFirst({
      where: { package_name: entry.package_name },
    });

    if (!reg) {
      reg = await prisma.pluginRegistry.create({
        data: {
          package_name: entry.package_name,
          version: entry.version,
          manifest: {
            ...entry.manifest,
            category: entry.category,
            icon: entry.icon,
          } as any,
          status: 'active',
        },
      });
    } else {
      await prisma.pluginRegistry.update({
        where: { id: reg.id },
        data: {
          version: entry.version,
          manifest: {
            ...entry.manifest,
            category: entry.category,
            icon: entry.icon,
          } as any,
        },
      });
    }

    const isCompatible = entry.manifest.compatible_industries.includes('*') ||
      entry.manifest.compatible_industries.includes('healthcare');

    if (isCompatible) {
      const existingLink = await prisma.tenantPlugin.findFirst({
        where: {
          tenant_id: tenant.id,
          plugin_registry_id: reg.id,
        },
      });

      if (!existingLink) {
        await prisma.tenantPlugin.create({
          data: {
            tenant_id: tenant.id,
            plugin_registry_id: reg.id,
            enabled: true,
          },
        });
      }
    }
  }

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
