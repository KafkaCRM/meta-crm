import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

interface CatalogueEntry {
  package_name: string;
  version: string;
  manifest: {
    id: string;
    name: string;
    description: string;
    compatible_industries: string[];
    hooks: string[];
    extends: string[];
    requires_plan?: string;
  };
}

const PLUGIN_CATALOGUE: CatalogueEntry[] = [
  {
    package_name: '@meta-crm/plugin-email-campaigns',
    version: '1.0.0',
    manifest: {
      id: 'email-campaigns',
      name: 'Email Campaigns',
      description: 'Send bulk email campaigns to contacts, track opens and clicks, and manage unsubscribes.',
      compatible_industries: ['*'],
      hooks: ['contact:created', 'case:closed'],
      extends: ['Contact', 'Dashboard'],
    },
  },
  {
    package_name: '@meta-crm/plugin-sms-notifications',
    version: '1.0.0',
    manifest: {
      id: 'sms-notifications',
      name: 'SMS Notifications',
      description: 'Send automated SMS alerts for case updates, appointment reminders, and custom triggers.',
      compatible_industries: ['*'],
      hooks: ['case:stage_changed', 'case:created', 'case:assigned'],
      extends: ['Case'],
    },
  },
  {
    package_name: '@meta-crm/plugin-whatsapp',
    version: '1.0.0',
    manifest: {
      id: 'whatsapp-integration',
      name: 'WhatsApp Integration',
      description: 'Two-way WhatsApp messaging from within cases. Auto-route inbound messages to open cases.',
      compatible_industries: ['*'],
      requires_plan: 'Growth',
      hooks: ['case:created', 'case:stage_changed', 'case:closed'],
      extends: ['Case', 'Contact'],
    },
  },
  {
    package_name: '@meta-crm/plugin-zapier',
    version: '1.0.0',
    manifest: {
      id: 'zapier-integration',
      name: 'Zapier Integration',
      description: 'Connect Meta CRM events to 5000+ apps via Zapier triggers and actions.',
      compatible_industries: ['*'],
      requires_plan: 'Growth',
      hooks: ['case:created', 'case:closed', 'contact:created'],
      extends: ['Settings'],
    },
  },
  {
    package_name: '@meta-crm/plugin-analytics-dashboard',
    version: '1.0.0',
    manifest: {
      id: 'analytics-dashboard',
      name: 'Advanced Analytics',
      description: 'Rich charts and KPI dashboards for cases, contacts, SLA performance, and team productivity.',
      compatible_industries: ['*'],
      requires_plan: 'Growth',
      hooks: [],
      extends: ['Dashboard'],
    },
  },
  {
    package_name: '@meta-crm/plugin-knowledge-base',
    version: '1.0.0',
    manifest: {
      id: 'knowledge-base',
      name: 'Knowledge Base',
      description: 'Internal wiki for agents — articles, FAQs, and resolution playbooks linked to case categories.',
      compatible_industries: ['*'],
      hooks: ['case:created'],
      extends: ['Case', 'Dashboard'],
    },
  },
  {
    package_name: '@meta-crm/plugin-appointment-scheduler',
    version: '1.0.0',
    manifest: {
      id: 'appointment-scheduler',
      name: 'Appointment Scheduler',
      description: 'Calendar-based appointment booking for patients. Sends reminders 24h before via SMS or WhatsApp.',
      compatible_industries: ['healthcare'],
      hooks: ['case:created', 'case:stage_changed'],
      extends: ['Case', 'Contact', 'Dashboard'],
    },
  },
  {
    package_name: '@meta-crm/plugin-prescription-tracker',
    version: '1.0.0',
    manifest: {
      id: 'prescription-tracker',
      name: 'Prescription Tracker',
      description: 'Track medication prescriptions linked to patient cases with refill reminders.',
      compatible_industries: ['healthcare'],
      requires_plan: 'Growth',
      hooks: ['case:closed'],
      extends: ['Case'],
    },
  },
  {
    package_name: '@meta-crm/plugin-product-catalog',
    version: '1.0.0',
    manifest: {
      id: 'product-catalog',
      name: 'Product Catalog',
      description: 'Link SKUs and products to cases. Agents can browse and attach products to support tickets.',
      compatible_industries: ['retail'],
      hooks: ['case:created'],
      extends: ['Case'],
    },
  },
  {
    package_name: '@meta-crm/plugin-returns-management',
    version: '1.0.0',
    manifest: {
      id: 'returns-management',
      name: 'Returns Management',
      description: 'Structured return and refund workflow with approval stages and auto-notifications to customers.',
      compatible_industries: ['retail'],
      requires_plan: 'Growth',
      hooks: ['case:stage_changed', 'case:closed'],
      extends: ['Case'],
    },
  },
  {
    package_name: '@meta-crm/plugin-invoice-generator',
    version: '1.0.0',
    manifest: {
      id: 'invoice-generator',
      name: 'Invoice Generator',
      description: 'Generate and send PDF invoices from cases. Track payment status and send reminders.',
      compatible_industries: ['finance'],
      requires_plan: 'Growth',
      hooks: ['case:closed'],
      extends: ['Case', 'Contact'],
    },
  },
  {
    package_name: '@meta-crm/plugin-compliance-audit',
    version: '1.0.0',
    manifest: {
      id: 'compliance-audit',
      name: 'Compliance Audit Log',
      description: 'Immutable audit trail for all case actions — required for financial regulatory compliance.',
      compatible_industries: ['finance'],
      requires_plan: 'Enterprise',
      hooks: ['case:created', 'case:stage_changed', 'case:closed', 'case:assigned'],
      extends: ['Case', 'Settings'],
    },
  },
  {
    package_name: '@meta-crm/plugin-property-listings',
    version: '1.0.0',
    manifest: {
      id: 'property-listings',
      name: 'Property Listings',
      description: 'Attach property listings to contacts and cases. Track viewing history and offers.',
      compatible_industries: ['real-estate', 'real_estate'],
      hooks: ['case:created', 'contact:created'],
      extends: ['Case', 'Contact'],
    },
  },
  {
    package_name: '@meta-crm/plugin-document-signing',
    version: '1.0.0',
    manifest: {
      id: 'document-signing',
      name: 'Document E-Signing',
      description: 'Send lease agreements and contracts for e-signature directly from cases.',
      compatible_industries: ['real-estate', 'real_estate'],
      requires_plan: 'Growth',
      hooks: ['case:stage_changed'],
      extends: ['Case'],
    },
  },
  {
    package_name: '@meta-crm/plugin-enrollment-manager',
    version: '1.0.0',
    manifest: {
      id: 'enrollment-manager',
      name: 'Enrollment Manager',
      description: 'Track student enrollment inquiries, applications, and acceptance workflows as cases.',
      compatible_industries: ['education'],
      hooks: ['case:created', 'case:stage_changed', 'case:closed'],
      extends: ['Case', 'Contact', 'Dashboard'],
    },
  },
  {
    package_name: '@meta-crm/plugin-course-catalog',
    version: '1.0.0',
    manifest: {
      id: 'course-catalog',
      name: 'Course Catalog',
      description: 'Link courses and programmes to cases and contacts. Track interest and conversion.',
      compatible_industries: ['education'],
      hooks: ['contact:created'],
      extends: ['Case', 'Contact'],
    },
  },
  {
    package_name: '@meta-crm/plugin-reservation-manager',
    version: '1.0.0',
    manifest: {
      id: 'reservation-manager',
      name: 'Reservation Manager',
      description: 'Manage hotel or venue reservations linked to guest profiles. Handle modifications and cancellations.',
      compatible_industries: ['hospitality'],
      hooks: ['case:created', 'case:stage_changed', 'case:closed'],
      extends: ['Case', 'Contact'],
    },
  },
  {
    package_name: '@meta-crm/plugin-guest-feedback',
    version: '1.0.0',
    manifest: {
      id: 'guest-feedback',
      name: 'Guest Feedback & Reviews',
      description: 'Collect post-stay reviews, track NPS scores, and auto-escalate negative feedback as cases.',
      compatible_industries: ['hospitality'],
      hooks: ['case:closed'],
      extends: ['Case', 'Dashboard'],
    },
  },
];

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
          manifest: entry.manifest as any,
          status: 'active',
        },
      });
    } else {
      await prisma.pluginRegistry.update({
        where: { id: reg.id },
        data: {
          version: entry.version,
          manifest: entry.manifest as any,
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
