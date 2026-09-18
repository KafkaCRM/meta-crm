import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { eq, and } from 'drizzle-orm';
import { db, pool } from './index';
import {
  subscriptionPlans,
  platformUsers,
  platformUserRoles,
  tenants,
  tenantPlans,
  branches,
  verticals,
  users,
  roles,
  userRoles,
  pluginRegistry,
  tenantPlugins,
  pipelineDefinitions,
  pipelineStages,
  pipelineTransitions,
} from './schema';
import { hashPassword } from '../lib/crypto';
import { PLUGIN_CATALOGUE } from '../plugins/registry/plugin-catalogue';

dotenv.config({ path: resolve(__dirname, '../../../.env') });
dotenv.config();

async function main() {
  console.log('🌱 Seeding Meta CRM Database with Drizzle...');

  // 1. Subscription plan
  const plan = await db.query.subscriptionPlans.findFirst({
    where: eq(subscriptionPlans.name, 'Enterprise'),
  });

  let planId = plan?.id;
  if (!plan) {
    const [newPlan] = await db
      .insert(subscriptionPlans)
      .values({
        name: 'Enterprise',
        maxBranches: 50,
        maxUsers: 200,
        maxPlugins: 25,
        priceMonthly: 499.0,
      })
      .returning();
    planId = newPlan!.id;
  }
  console.log(`✓ Subscription Plan: Enterprise (${planId})`);

  // 2. Platform Owner
  const ownerEmail = 'admin@meta-crm.local';
  const ownerPassword = 'Admin123!';
  const passwordHash = await hashPassword(ownerPassword);

  let pUser = await db.query.platformUsers.findFirst({
    where: eq(platformUsers.email, ownerEmail),
  });

  if (!pUser) {
    const [newUser] = await db
      .insert(platformUsers)
      .values({
        name: 'Platform Owner',
        email: ownerEmail,
        passwordHash,
        status: 'active',
      })
      .returning();
    pUser = newUser;

    await db.insert(platformUserRoles).values({
      platformUserId: pUser!.id,
      role: 'platform_owner',
    });
  }
  console.log(`✓ Platform Owner: ${pUser!.name} (${pUser!.email}) / ${ownerPassword}`);

  // 3. Test Tenant
  let tenant = await db.query.tenants.findFirst({
    where: eq(tenants.slug, 'acme-corp'),
  });

  if (!tenant) {
    const [newTenant] = await db
      .insert(tenants)
      .values({
        name: 'Acme Corp',
        slug: 'acme-corp',
        industry: 'healthcare',
        status: 'active',
        configJson: {
          enabled_capabilities: [
            'capability/appointment',
            'capability/billing',
            'capability/workspace',
          ],
        },
      })
      .returning();
    tenant = newTenant;

    await db.insert(tenantPlans).values({
      tenantId: tenant!.id,
      planId: planId!,
    });
  }
  console.log(`✓ Tenant: ${tenant!.name} (${tenant!.slug})`);

  // 4. Default Branch & Vertical for Tenant
  let branch = await db.query.branches.findFirst({
    where: eq(branches.tenantId, tenant!.id),
  });
  if (!branch) {
    const [b] = await db
      .insert(branches)
      .values({
        tenantId: tenant!.id,
        name: 'Headquarters',
        city: 'New York',
      })
      .returning();
    branch = b;
  }

  let vertical = await db.query.verticals.findFirst({
    where: eq(verticals.tenantId, tenant!.id),
  });
  if (!vertical) {
    const [v] = await db
      .insert(verticals)
      .values({
        tenantId: tenant!.id,
        branchId: branch!.id,
        name: 'Healthcare Clinic',
      })
      .returning();
    vertical = v;
  }

  // 5. Tenant User
  const tenantEmail = 'user@acme.local';
  const tenantPassword = 'User123!';
  const tenantPasswordHash = await hashPassword(tenantPassword);

  let tUser = await db.query.users.findFirst({
    where: and(eq(users.tenantId, tenant!.id), eq(users.email, tenantEmail)),
  });

  if (!tUser) {
    const [newUser] = await db
      .insert(users)
      .values({
        tenantId: tenant!.id,
        branchId: branch!.id,
        name: 'Tenant Admin',
        email: tenantEmail,
        phoneNumber: '+15550199',
        passwordHash: tenantPasswordHash,
        status: 'active',
      })
      .returning();
    tUser = newUser;
  }
  console.log(`✓ Tenant User: ${tUser!.name} (${tenantEmail}) / ${tenantPassword}`);

  // 6. Default Admin Role
  let role = await db.query.roles.findFirst({
    where: and(eq(roles.tenantId, tenant!.id), eq(roles.slug, 'tenant_admin')),
  });

  if (!role) {
    const [newRole] = await db
      .insert(roles)
      .values({
        tenantId: tenant!.id,
        name: 'admin',
        slug: 'tenant_admin',
        displayName: 'Administrator',
        isSystemRole: true,
        description: 'Tenant administrator with full access',
      })
      .returning();
    role = newRole;

    await db.insert(userRoles).values({
      userId: tUser!.id,
      roleId: role!.id,
      tenantId: tenant!.id,
    });
  }

  // 7. Default Pipeline
  let pipe = await db.query.pipelineDefinitions.findFirst({
    where: eq(pipelineDefinitions.tenantId, tenant!.id),
  });

  if (!pipe) {
    const [newPipe] = await db
      .insert(pipelineDefinitions)
      .values({
        tenantId: tenant!.id,
        name: 'Default Pipeline',
        entityType: 'lead',
        verticalId: vertical!.id,
      })
      .returning();

    const stages = await db
      .insert(pipelineStages)
      .values([
        { pipelineDefinitionId: newPipe!.id, name: 'Lead', order: 0, slaHours: 24 },
        { pipelineDefinitionId: newPipe!.id, name: 'Contacted', order: 1 },
        { pipelineDefinitionId: newPipe!.id, name: 'Qualified', order: 2 },
        { pipelineDefinitionId: newPipe!.id, name: 'Proposal Sent', order: 3 },
        { pipelineDefinitionId: newPipe!.id, name: 'Closed Won', order: 4, terminalOutcome: 'won' },
        { pipelineDefinitionId: newPipe!.id, name: 'Closed Lost', order: 5, terminalOutcome: 'lost' },
      ])
      .returning();

    // Add transitions
    const transitions = [];
    for (let i = 0; i < stages.length - 2; i++) {
      transitions.push({
        pipelineDefinitionId: newPipe!.id,
        fromStageId: stages[i]!.id,
        toStageId: stages[i + 1]!.id,
      });
    }
    const wonStage = stages.find((s) => s.terminalOutcome === 'won');
    const lostStage = stages.find((s) => s.terminalOutcome === 'lost');
    if (wonStage && lostStage) {
      transitions.push(
        { pipelineDefinitionId: newPipe!.id, fromStageId: stages[2]!.id, toStageId: wonStage.id },
        { pipelineDefinitionId: newPipe!.id, fromStageId: stages[2]!.id, toStageId: lostStage.id }
      );
    }
    await db.insert(pipelineTransitions).values(transitions);
    console.log(`✓ Default Pipeline and Stages seeded`);
  }

  // 8. Plugin Registry
  console.log('✓ Seeding plugin catalogue...');
  for (const entry of PLUGIN_CATALOGUE) {
    const existing = await db.query.pluginRegistry.findFirst({
      where: eq(pluginRegistry.packageName, entry.package_name),
    });

    let regId = existing?.id;
    if (!existing) {
      const [reg] = await db
        .insert(pluginRegistry)
        .values({
          packageName: entry.package_name,
          version: entry.version,
          manifest: {
            ...entry.manifest,
            category: entry.category,
            icon: entry.icon,
          },
          status: 'active',
        })
        .returning();
      regId = reg!.id;
    }

    const isCompatible =
      entry.manifest.compatible_industries.includes('*') ||
      entry.manifest.compatible_industries.includes('healthcare');

    if (isCompatible && regId) {
      const existingLink = await db.query.tenantPlugins.findFirst({
        where: and(eq(tenantPlugins.tenantId, tenant!.id), eq(tenantPlugins.pluginRegistryId, regId)),
      });

      if (!existingLink) {
        await db.insert(tenantPlugins).values({
          tenantId: tenant!.id,
          pluginRegistryId: regId,
          enabled: true,
        });
      }
    }
  }

  console.log('✅ Seeding complete!');
  await pool.end();
}

main().catch((e) => {
  console.error('❌ Seeding failed:', e);
  process.exit(1);
});
