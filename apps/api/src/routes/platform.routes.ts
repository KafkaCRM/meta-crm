import { Hono, type Context } from 'hono';
import { eq, and, or, desc, asc, lt, sql, inArray } from 'drizzle-orm';
import { db } from '../db';
import {
  tenants,
  branches,
  verticals,
  users,
  userBranches,
  userVerticals,
  roles,
  userRoles,
  platformUsers,
  platformUserRoles,
  subscriptionPlans,
  tenantPlans,
  capabilityPricing,
  platformAuditLogs,
  pluginRegistry,
  tenantPlugins,
  tenantCapabilities,
  leads,
  inboundEvents,
  integrationConnections,
  pipelineDefinitions,
  pipelineStages,
  pipelineTransitions,
} from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { requirePlatformAdmin } from '../middleware/tenant';
import { hashPassword } from '../lib/crypto';
import { signJwt } from '../lib/jwt';
import type { AppEnv } from '../types/context';

export const platformRouter = new Hono<AppEnv>();

platformRouter.use('*', requireAuth, requirePlatformAdmin);

/* ------------------------------------------------------------------ */
/*  Constants & Helpers                                               */
/* ------------------------------------------------------------------ */

const ALL_PLATFORM_CAPABILITIES = [
  { id: 'capability/appointment', name: 'Appointments & Scheduling', description: 'Schedule and manage client appointments and rooms', industry: 'healthcare' },
  { id: 'capability/billing', name: 'Billing & Invoicing', description: 'Generate invoices, line items, and record payments', industry: 'finance' },
  { id: 'capability/property-listing', name: 'Real Estate & Properties', description: 'Manage properties, units, and real estate inventory', industry: 'real_estate' },
  { id: 'capability/order-management', name: 'Order Management', description: 'Manage orders, fulfillment, and product transactions', industry: 'retail' },
  { id: 'capability/customer-onboarding', name: 'Customer Onboarding', description: 'Track client onboarding checklists and milestones', industry: 'general' },
  { id: 'capability/workspace', name: 'Workspace (Tasks & Notes)', description: 'Collaborative team tasks and contextual notes', industry: 'general' },
  { id: 'capability/academics', name: 'Academics & Education', description: 'Courses, batches, enrollments, exams, and attendance', industry: 'education' },
  { id: 'capability/finance', name: 'Tuition & Fee Plans', description: 'Fee plans, installments, and student scholarships', industry: 'education' },
  { id: 'capability/hr', name: 'HR & People Management', description: 'Departments, employees, leave requests, and payroll', industry: 'general' },
  { id: 'capability/operations', name: 'Operations & Inventory', description: 'Warehouses, stock levels, movements, and fixed assets', industry: 'operations' },
  { id: 'capability/telephony', name: 'Telephony & Call Logs', description: 'Call logging, outcomes, and recording links', industry: 'general' },
];

const INDUSTRY_CAPABILITY_MAP: Record<string, string[]> = {
  healthcare: ['capability/appointment', 'capability/billing', 'capability/workspace', 'capability/telephony'],
  real_estate: ['capability/property-listing', 'capability/appointment', 'capability/billing', 'capability/workspace'],
  education: ['capability/academics', 'capability/finance', 'capability/billing', 'capability/workspace'],
  operations: ['capability/operations', 'capability/order-management', 'capability/billing', 'capability/workspace'],
  retail: ['capability/operations', 'capability/order-management', 'capability/billing', 'capability/customer-onboarding'],
  finance: ['capability/billing', 'capability/finance', 'capability/workspace'],
  general: ['capability/customer-onboarding', 'capability/workspace', 'capability/billing'],
};

async function logPlatformAudit(
  c: Context<AppEnv>,
  action: string,
  targetId: string | null,
  details: Record<string, any> = {},
  reason: string | null = null
) {
  const scope = c.get('scope');
  const actorIp = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || '127.0.0.1';
  const userAgent = c.req.header('user-agent') || 'platform-admin-client';
  await db.insert(platformAuditLogs).values({
    actorId: scope.user_id,
    actorEmail: scope.email || 'platform_admin@meta-crm.internal',
    actorRole: String(scope.platform_role || scope.role || 'platform_admin'),
    action,
    targetId,
    actorIp,
    userAgent,
    details,
    reason,
  });
}

async function buildTenantDetail(tenantId: string) {
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
    with: {
      branches: { columns: { id: true } },
      users: { columns: { id: true } },
    },
  });

  if (!tenant) return null;

  const [tenantPlanRecord, installedPlugins, enabledCaps] = await Promise.all([
    db.query.tenantPlans.findFirst({
      where: eq(tenantPlans.tenantId, tenantId),
      with: { plan: true },
    }),
    db.query.tenantPlugins.findMany({
      where: and(eq(tenantPlugins.tenantId, tenantId), eq(tenantPlugins.enabled, true)),
      with: { pluginRegistry: true },
    }),
    db.query.tenantCapabilities.findMany({
      where: and(eq(tenantCapabilities.tenantId, tenantId), eq(tenantCapabilities.enabled, true)),
    }),
  ]);

  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    industry: tenant.industry,
    status: tenant.status,
    created_at: tenant.createdAt.toISOString(),
    branch_count: tenant.branches?.length || 0,
    user_count: tenant.users?.length || 0,
    plugin_list: installedPlugins.map((p) => p.pluginRegistry?.packageName).filter(Boolean) as string[],
    plugin_ids: installedPlugins.map((p) => p.pluginRegistryId),
    enabled_capabilities: enabledCaps.map((c) => c.capabilityId),
    custom_limits: (tenant.configJson as Record<string, any>)?.custom_limits || {},
    plan: tenantPlanRecord?.plan
      ? {
          id: tenantPlanRecord.plan.id,
          name: tenantPlanRecord.plan.name,
          max_branches: tenantPlanRecord.plan.maxBranches,
          max_users: tenantPlanRecord.plan.maxUsers,
          max_plugins: tenantPlanRecord.plan.maxPlugins,
        }
      : null,
  };
}

/* ------------------------------------------------------------------ */
/*  1. Tenant Operations & Catalog                                    */
/* ------------------------------------------------------------------ */

// GET /platform/tenants/capabilities - Catalog of all available capabilities
platformRouter.get('/tenants/capabilities', async (c) => {
  return c.json(ALL_PLATFORM_CAPABILITIES);
});

// GET /platform/tenants - Paginated tenant list with counts
platformRouter.get('/tenants', async (c) => {
  const cursor = c.req.query('cursor');
  const limit = Math.min(Math.max(Number(c.req.query('limit')) || 50, 1), 100);

  const conditions = [];
  if (cursor) {
    const cursorDate = new Date(cursor);
    if (!isNaN(cursorDate.getTime())) {
      conditions.push(lt(tenants.createdAt, cursorDate));
    }
  }

  const list = await db.query.tenants.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(tenants.createdAt)],
    limit: limit + 1,
    with: {
      branches: { columns: { id: true } },
      users: { columns: { id: true } },
    },
  });

  const hasNext = list.length > limit;
  const items = hasNext ? list.slice(0, limit) : list;
  const nextCursor = hasNext && items.length > 0 ? items[items.length - 1]!.createdAt.toISOString() : undefined;

  const data = items.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    industry: t.industry,
    status: t.status,
    created_at: t.createdAt.toISOString(),
    branch_count: t.branches?.length || 0,
    user_count: t.users?.length || 0,
    case_count: 0,
  }));

  return c.json({
    data,
    next_cursor: nextCursor,
  });
});

// POST /platform/tenants - Provision a new tenant workspace
platformRouter.post('/tenants', async (c) => {
  const scope = c.get('scope');
  const body = await c.req.json().catch(() => ({}));

  const {
    name,
    slug,
    industry,
    plan_id,
    owner,
    capabilities,
    tenant_type,
    operational_mode,
    parent_tenant_id,
    royalty_percentage,
    territory_codes,
  } = body;

  if (!name || !slug || !industry || !owner?.email) {
    return c.json(
      { code: 'VALIDATION_FAILED', message: 'Name, slug, industry, and owner email are required' },
      400
    );
  }

  const existingSlug = await db.query.tenants.findFirst({
    where: eq(tenants.slug, slug),
  });
  if (existingSlug) {
    return c.json({ code: 'SLUG_IN_USE', message: 'Tenant slug is already taken' }, 409);
  }

  const tempPassword = `TempPass!${Math.floor(100000 + Math.random() * 900000)}`;
  const passwordHash = await hashPassword(tempPassword);

  const result = await db.transaction(async (tx) => {
    // 1. Create tenant
    const [newTenant] = await tx
      .insert(tenants)
      .values({
        name,
        slug,
        industry,
        tenantType: (tenant_type as any) || 'independent',
        parentTenantId: parent_tenant_id || null,
        royaltyPercentage: royalty_percentage !== undefined ? Number(royalty_percentage) : 0,
        territoryCodes: territory_codes || [],
        status: 'active',
        configJson: {
          capabilities: capabilities || [],
          enabled_capabilities: capabilities || [],
          operational_mode: operational_mode || (tenant_type === 'franchisor' ? 'franchise' : 'independent'),
        },
      })
      .returning();

    // 2. Create default branch
    const [mainBranch] = await tx
      .insert(branches)
      .values({
        tenantId: newTenant!.id,
        name: `${name} Main Branch`,
      })
      .returning();

    // 2.5 Create default vertical (Anchor Entity)
    const [defaultVertical] = await tx
      .insert(verticals)
      .values({
        tenantId: newTenant!.id,
        branchId: mainBranch!.id,
        name: 'General Services',
      })
      .returning();

    // 2.6 Create default pipeline, stages, and transitions
    const [defaultPipeline] = await tx
      .insert(pipelineDefinitions)
      .values({
        tenantId: newTenant!.id,
        verticalId: defaultVertical!.id, // Tied to the default vertical of main branch
        name: 'Default Pipeline',
        entityType: 'lead',
      })
      .returning();

    const createdStages = await tx
      .insert(pipelineStages)
      .values([
        { pipelineDefinitionId: defaultPipeline!.id, name: 'Lead', order: 0, slaHours: 24, terminalOutcome: null },
        { pipelineDefinitionId: defaultPipeline!.id, name: 'Contacted', order: 1, slaHours: null, terminalOutcome: null },
        { pipelineDefinitionId: defaultPipeline!.id, name: 'Qualified', order: 2, slaHours: null, terminalOutcome: null },
        { pipelineDefinitionId: defaultPipeline!.id, name: 'Proposal Sent', order: 3, slaHours: null, terminalOutcome: null },
        { pipelineDefinitionId: defaultPipeline!.id, name: 'Closed Won', order: 4, slaHours: null, terminalOutcome: 'won' },
        { pipelineDefinitionId: defaultPipeline!.id, name: 'Closed Lost', order: 5, slaHours: null, terminalOutcome: 'lost' },
      ])
      .returning();

    const transitionsToInsert = [];
    for (let i = 0; i < createdStages.length - 2; i++) {
      transitionsToInsert.push({
        pipelineDefinitionId: defaultPipeline!.id,
        fromStageId: createdStages[i]!.id,
        toStageId: createdStages[i + 1]!.id,
      });
    }
    const wonStage = createdStages.find((s) => s.terminalOutcome === 'won');
    const lostStage = createdStages.find((s) => s.terminalOutcome === 'lost');
    if (wonStage && lostStage) {
      transitionsToInsert.push(
        { pipelineDefinitionId: defaultPipeline!.id, fromStageId: createdStages[2]!.id, toStageId: wonStage.id },
        { pipelineDefinitionId: defaultPipeline!.id, fromStageId: createdStages[2]!.id, toStageId: lostStage.id }
      );
    }
    if (transitionsToInsert.length > 0) {
      await tx.insert(pipelineTransitions).values(transitionsToInsert);
    }

    // 3. Create owner user
    const [ownerUser] = await tx
      .insert(users)
      .values({
        tenantId: newTenant!.id,
        branchId: mainBranch!.id,
        name: owner.name || `${name} Admin`,
        email: owner.email,
        passwordHash,
        status: 'active',
      })
      .returning();

    // Link owner to userBranches and userVerticals
    if (ownerUser && mainBranch && defaultVertical) {
      await tx.insert(userBranches).values({
        userId: ownerUser.id,
        branchId: mainBranch.id,
        tenantId: newTenant!.id,
      });
      await tx.insert(userVerticals).values({
        userId: ownerUser.id,
        verticalId: defaultVertical.id,
        tenantId: newTenant!.id,
      });
    }

    // 4. Create admin role & assignment
    const [adminRole] = await tx
      .insert(roles)
      .values({
        tenantId: newTenant!.id,
        name: 'Tenant Admin',
        slug: 'admin',
        displayName: 'Administrator',
        isSystemRole: true,
      })
      .returning();

    if (adminRole && ownerUser) {
      await tx.insert(userRoles).values({
        userId: ownerUser.id,
        roleId: adminRole.id,
        tenantId: newTenant!.id,
      });
    }

    // 5. Assign plan if requested
    if (plan_id) {
      await tx.insert(tenantPlans).values({
        tenantId: newTenant!.id,
        planId: plan_id,
      });
    }

    // 6. Enable capabilities if provided
    if (Array.isArray(capabilities)) {
      for (const capId of capabilities) {
        await tx.insert(tenantCapabilities).values({
          tenantId: newTenant!.id,
          capabilityId: capId,
          enabled: true,
          enabledBy: scope.user_id,
        });
      }
    }

    return {
      tenant: {
        id: newTenant!.id,
        name: newTenant!.name,
        slug: newTenant!.slug,
        industry: newTenant!.industry,
      },
      owner: {
        email: owner.email,
        temporary_password: tempPassword,
      },
    };
  });

  await logPlatformAudit(c, 'tenant_created', result.tenant.id, {
    name,
    slug,
    industry,
    plan_id,
    owner_email: owner.email,
  });

  return c.json(result, 201);
});

// GET /platform/tenants/:id - Tenant details
platformRouter.get('/tenants/:id', async (c) => {
  const id = c.req.param('id');
  const detail = await buildTenantDetail(id);

  if (!detail) {
    return c.json({ code: 'NOT_FOUND', message: 'Tenant not found' }, 404);
  }

  return c.json(detail);
});

// PATCH /platform/tenants/:id - Update tenant name, slug, industry
platformRouter.patch('/tenants/:id', async (c) => {
  const id = c.req.param('id');
  const b = await c.req.json().catch(() => ({}));

  const updateFields: Record<string, any> = {};
  if (b.name !== undefined) updateFields['name'] = b.name;
  if (b.slug !== undefined) updateFields['slug'] = b.slug;
  if (b.industry !== undefined) updateFields['industry'] = b.industry;

  if (b.slug) {
    const existing = await db.query.tenants.findFirst({
      where: and(eq(tenants.slug, b.slug), sql`${tenants.id} != ${id}`),
    });
    if (existing) {
      return c.json({ code: 'SLUG_IN_USE', message: 'Slug already taken' }, 409);
    }
  }

  const [updated] = await db.update(tenants).set(updateFields).where(eq(tenants.id, id)).returning();

  if (!updated) {
    return c.json({ code: 'NOT_FOUND', message: 'Tenant not found' }, 404);
  }

  await logPlatformAudit(c, 'tenant_updated', id, updateFields);
  const detail = await buildTenantDetail(id);
  return c.json(detail);
});

// DELETE /platform/tenants/:id - Soft-archive tenant
platformRouter.delete('/platform/tenants/:id', async (c) => {
  const id = c.req.param('id');
  await db.update(tenants).set({ status: 'archived' }).where(eq(tenants.id, id));
  await logPlatformAudit(c, 'tenant_deleted', id);
  return c.json({ message: 'Tenant deleted successfully' });
});

platformRouter.delete('/tenants/:id', async (c) => {
  const id = c.req.param('id');
  await db.update(tenants).set({ status: 'archived' }).where(eq(tenants.id, id));
  await logPlatformAudit(c, 'tenant_deleted', id);
  return c.json({ message: 'Tenant deleted successfully' });
});

/* ------------------------------------------------------------------ */
/*  Tenant Status Lifecycle Management                                */
/* ------------------------------------------------------------------ */

platformRouter.patch('/tenants/:id/suspend', async (c) => {
  const id = c.req.param('id');
  const { reason } = await c.req.json().catch(() => ({}));
  await db.update(tenants).set({ status: 'suspended' }).where(eq(tenants.id, id));
  await logPlatformAudit(c, 'tenant_suspended', id, {}, reason);
  return c.json({ message: 'Tenant suspended successfully' });
});

platformRouter.patch('/tenants/:id/reactivate', async (c) => {
  const id = c.req.param('id');
  const { reason } = await c.req.json().catch(() => ({}));
  await db.update(tenants).set({ status: 'active' }).where(eq(tenants.id, id));
  await logPlatformAudit(c, 'tenant_reactivated', id, {}, reason);
  return c.json({ message: 'Tenant reactivated successfully' });
});

platformRouter.patch('/tenants/:id/pause', async (c) => {
  const id = c.req.param('id');
  const { reason } = await c.req.json().catch(() => ({}));
  await db.update(tenants).set({ status: 'paused' }).where(eq(tenants.id, id));
  await logPlatformAudit(c, 'tenant_paused', id, {}, reason);
  return c.json({ message: 'Tenant paused successfully' });
});

platformRouter.patch('/tenants/:id/cancel', async (c) => {
  const id = c.req.param('id');
  const { reason } = await c.req.json().catch(() => ({}));
  await db.update(tenants).set({ status: 'cancelled' }).where(eq(tenants.id, id));
  await logPlatformAudit(c, 'tenant_cancelled', id, {}, reason);
  return c.json({ message: 'Tenant cancelled successfully' });
});

platformRouter.patch('/tenants/:id/deactivate', async (c) => {
  const id = c.req.param('id');
  const { reason } = await c.req.json().catch(() => ({}));
  await db.update(tenants).set({ status: 'inactive' }).where(eq(tenants.id, id));
  await logPlatformAudit(c, 'tenant_deactivated', id, {}, reason);
  return c.json({ message: 'Tenant deactivated successfully' });
});

// POST /platform/tenants/:id/apply-template
platformRouter.post('/tenants/:id/apply-template', async (c) => {
  const tenantId = c.req.param('id');
  const scope = c.get('scope');
  const { industry } = await c.req.json().catch(() => ({}));

  if (!industry) {
    return c.json({ code: 'VALIDATION_FAILED', message: 'Industry template name is required' }, 400);
  }

  await db.update(tenants).set({ industry }).where(eq(tenants.id, tenantId));

  const caps = INDUSTRY_CAPABILITY_MAP[industry] || INDUSTRY_CAPABILITY_MAP['general']!;
  for (const capId of caps) {
    const existing = await db.query.tenantCapabilities.findFirst({
      where: and(eq(tenantCapabilities.tenantId, tenantId), eq(tenantCapabilities.capabilityId, capId)),
    });
    if (existing) {
      await db.update(tenantCapabilities).set({ enabled: true }).where(eq(tenantCapabilities.id, existing.id));
    } else {
      await db.insert(tenantCapabilities).values({
        tenantId,
        capabilityId: capId,
        enabled: true,
        enabledBy: scope.user_id,
      });
    }
  }

  await logPlatformAudit(c, 'template_applied', tenantId, { industry, capabilities: caps });
  return c.json({ message: 'Template applied successfully' });
});

// POST /platform/tenants/:id/assign-plan
platformRouter.post('/tenants/:id/assign-plan', async (c) => {
  const tenantId = c.req.param('id');
  const { plan_id } = await c.req.json().catch(() => ({}));

  if (!plan_id) {
    return c.json({ code: 'VALIDATION_FAILED', message: 'plan_id is required' }, 400);
  }

  const plan = await db.query.subscriptionPlans.findFirst({
    where: eq(subscriptionPlans.id, plan_id),
  });

  if (!plan) {
    return c.json({ code: 'NOT_FOUND', message: 'Plan not found' }, 404);
  }

  await db.delete(tenantPlans).where(eq(tenantPlans.tenantId, tenantId));
  await db.insert(tenantPlans).values({
    tenantId,
    planId: plan_id,
  });

  await logPlatformAudit(c, 'plan_assigned', tenantId, { plan_id, plan_name: plan.name });
  return c.json({ message: 'Plan assigned successfully' });
});

// PATCH /platform/tenants/:id/entitlements
platformRouter.patch('/tenants/:id/entitlements', async (c) => {
  const tenantId = c.req.param('id');
  const { plugin_ids } = await c.req.json().catch(() => ({}));

  if (Array.isArray(plugin_ids)) {
    await db.delete(tenantPlugins).where(eq(tenantPlugins.tenantId, tenantId));
    for (const pid of plugin_ids) {
      await db.insert(tenantPlugins).values({
        tenantId,
        pluginRegistryId: pid,
        enabled: true,
      });
    }
  }

  await logPlatformAudit(c, 'entitlements_updated', tenantId, { plugin_ids });
  return c.json({ message: 'Entitlements updated successfully' });
});

// PATCH /platform/tenants/:id/capabilities
platformRouter.patch('/tenants/:id/capabilities', async (c) => {
  const tenantId = c.req.param('id');
  const scope = c.get('scope');
  const { capabilities } = await c.req.json().catch(() => ({}));

  if (Array.isArray(capabilities)) {
    await db
      .update(tenantCapabilities)
      .set({ enabled: false, enabledBy: scope.user_id })
      .where(eq(tenantCapabilities.tenantId, tenantId));

    for (const capId of capabilities) {
      const existing = await db.query.tenantCapabilities.findFirst({
        where: and(eq(tenantCapabilities.tenantId, tenantId), eq(tenantCapabilities.capabilityId, capId)),
      });
      if (existing) {
        await db
          .update(tenantCapabilities)
          .set({ enabled: true, enabledBy: scope.user_id })
          .where(eq(tenantCapabilities.id, existing.id));
      } else {
        await db.insert(tenantCapabilities).values({
          tenantId,
          capabilityId: capId,
          enabled: true,
          enabledBy: scope.user_id,
        });
      }
    }
  }

  await logPlatformAudit(c, 'capabilities_updated', tenantId, { capabilities });
  const detail = await buildTenantDetail(tenantId);
  return c.json(detail);
});

// GET /platform/tenants/:id/capabilities
platformRouter.get('/tenants/:id/capabilities', async (c) => {
  const id = c.req.param('id');
  const enabledRecords = await db.query.tenantCapabilities.findMany({
    where: and(eq(tenantCapabilities.tenantId, id), eq(tenantCapabilities.enabled, true)),
  });
  const enabledSet = new Set(enabledRecords.map((r) => r.capabilityId));

  const result = ALL_PLATFORM_CAPABILITIES.map((cap) => ({
    ...cap,
    enabled: enabledSet.has(cap.id),
  }));

  return c.json(result);
});

// POST /platform/tenants/:id/capabilities/:capabilityId/enable
platformRouter.post('/tenants/:id/capabilities/:capabilityId/enable', async (c) => {
  const tenantId = c.req.param('id');
  const capabilityId = decodeURIComponent(c.req.param('capabilityId'));
  const scope = c.get('scope');

  const existing = await db.query.tenantCapabilities.findFirst({
    where: and(eq(tenantCapabilities.tenantId, tenantId), eq(tenantCapabilities.capabilityId, capabilityId)),
  });

  if (existing) {
    await db
      .update(tenantCapabilities)
      .set({ enabled: true, enabledBy: scope.user_id, enabledAt: new Date() })
      .where(eq(tenantCapabilities.id, existing.id));
  } else {
    await db.insert(tenantCapabilities).values({
      tenantId,
      capabilityId,
      enabled: true,
      enabledBy: scope.user_id,
    });
  }

  await logPlatformAudit(c, 'capability_enabled', tenantId, { capabilityId });
  return c.json({ id: capabilityId, enabled: true });
});

// POST /platform/tenants/:id/capabilities/:capabilityId/disable
platformRouter.post('/tenants/:id/capabilities/:capabilityId/disable', async (c) => {
  const tenantId = c.req.param('id');
  const capabilityId = decodeURIComponent(c.req.param('capabilityId'));
  const scope = c.get('scope');

  await db
    .update(tenantCapabilities)
    .set({ enabled: false, enabledBy: scope.user_id })
    .where(and(eq(tenantCapabilities.tenantId, tenantId), eq(tenantCapabilities.capabilityId, capabilityId)));

  await logPlatformAudit(c, 'capability_disabled', tenantId, { capabilityId });
  return c.json({ id: capabilityId, enabled: false });
});

// GET /platform/tenants/:id/plugins
platformRouter.get('/tenants/:id/plugins', async (c) => {
  const tenantId = c.req.param('id');
  const allPlugins = await db.query.pluginRegistry.findMany({
    orderBy: [desc(pluginRegistry.createdAt)],
  });
  const installedPlugins = await db.query.tenantPlugins.findMany({
    where: and(eq(tenantPlugins.tenantId, tenantId), eq(tenantPlugins.enabled, true)),
  });
  const installedSet = new Set(installedPlugins.map((p) => p.pluginRegistryId));

  const result = allPlugins.map((p) => ({
    id: p.id,
    package_name: p.packageName,
    version: p.version,
    manifest: p.manifest as any,
    status: p.status,
    created_at: p.createdAt.toISOString(),
    installed: installedSet.has(p.id),
  }));

  return c.json(result);
});

// POST /platform/tenants/:id/plugins/:pluginId/install
platformRouter.post('/tenants/:id/plugins/:pluginId/install', async (c) => {
  const tenantId = c.req.param('id');
  const pluginId = c.req.param('pluginId');

  const existing = await db.query.tenantPlugins.findFirst({
    where: and(eq(tenantPlugins.tenantId, tenantId), eq(tenantPlugins.pluginRegistryId, pluginId)),
  });

  if (existing) {
    await db.update(tenantPlugins).set({ enabled: true }).where(eq(tenantPlugins.id, existing.id));
  } else {
    await db.insert(tenantPlugins).values({
      tenantId,
      pluginRegistryId: pluginId,
      enabled: true,
    });
  }

  await logPlatformAudit(c, 'plugin_installed', tenantId, { pluginId });
  return c.json({ id: pluginId, installed: true });
});

// POST /platform/tenants/:id/plugins/:pluginId/uninstall
platformRouter.post('/tenants/:id/plugins/:pluginId/uninstall', async (c) => {
  const tenantId = c.req.param('id');
  const pluginId = c.req.param('pluginId');

  await db
    .delete(tenantPlugins)
    .where(and(eq(tenantPlugins.tenantId, tenantId), eq(tenantPlugins.pluginRegistryId, pluginId)));

  await logPlatformAudit(c, 'plugin_uninstalled', tenantId, { pluginId });
  return c.json({ id: pluginId, installed: false });
});

// GET /platform/tenants/:id/hierarchy
platformRouter.get('/tenants/:id/hierarchy', async (c) => {
  const tenantId = c.req.param('id');
  const branchList = await db.query.branches.findMany({
    where: eq(branches.tenantId, tenantId),
    with: {
      verticals: true,
    },
  });

  const formattedBranches = await Promise.all(
    branchList.map(async (b) => {
      const formattedVerticals = await Promise.all(
        (b.verticals || []).map(async (v) => {
          const [leadCount] = await db
            .select({ count: sql<number>`count(*)` })
            .from(leads)
            .where(and(eq(leads.tenantId, tenantId), eq(leads.verticalId, v.id)));

          const totalLeads = Number(leadCount?.count || 0);

          return {
            id: v.id,
            name: v.name,
            status: 'active',
            stats: {
              total_leads: totalLeads,
              conversion_rate: 0,
            },
          };
        })
      );

      return {
        id: b.id,
        name: b.name,
        city: b.city || null,
        brands: [],
        verticals: formattedVerticals,
      };
    })
  );

  return c.json({ branches: formattedBranches });
});

// PATCH /platform/tenants/:id/reset-owner-password
platformRouter.patch('/tenants/:id/reset-owner-password', async (c) => {
  const tenantId = c.req.param('id');
  const user = await db.query.users.findFirst({
    where: and(eq(users.tenantId, tenantId), eq(users.status, 'active')),
  });

  if (!user) {
    return c.json({ code: 'NOT_FOUND', message: 'No active user found for this tenant' }, 404);
  }

  const temporaryPassword = `TempPass!${Math.floor(100000 + Math.random() * 900000)}`;
  const passwordHash = await hashPassword(temporaryPassword);

  await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));

  await logPlatformAudit(c, 'owner_password_reset', tenantId, { user_id: user.id, email: user.email });

  return c.json({
    email: user.email,
    temporary_password: temporaryPassword,
  });
});

// PATCH /platform/tenants/:id/overrides
platformRouter.patch('/tenants/:id/overrides', async (c) => {
  const tenantId = c.req.param('id');
  const overrides = await c.req.json().catch(() => ({}));

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
  });

  if (!tenant) {
    return c.json({ code: 'NOT_FOUND', message: 'Tenant not found' }, 404);
  }

  const currentConfig = (tenant.configJson as Record<string, any>) || {};
  const updatedConfig = {
    ...currentConfig,
    custom_limits: {
      ...(currentConfig.custom_limits || {}),
      ...overrides,
    },
  };

  await db.update(tenants).set({ configJson: updatedConfig }).where(eq(tenants.id, tenantId));

  await logPlatformAudit(c, 'tenant_overrides_updated', tenantId, overrides);

  const detail = await buildTenantDetail(tenantId);
  return c.json(detail);
});

// POST /platform/tenants/:id/impersonate - Support Impersonation
platformRouter.post('/tenants/:id/impersonate', async (c) => {
  const tenantId = c.req.param('id');
  const scope = c.get('scope');

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
  });

  if (!tenant) {
    return c.json({ code: 'NOT_FOUND', message: 'Tenant not found' }, 404);
  }

  const tenantUser = await db.query.users.findFirst({
    where: and(eq(users.tenantId, tenantId), eq(users.status, 'active')),
  });

  if (!tenantUser) {
    return c.json({ code: 'PRECONDITION_FAILED', message: 'Tenant has no active users to impersonate' }, 400);
  }

  const impersonationToken = signJwt({
    sub: tenantUser.id,
    tenant_id: tenant.id,
    email: tenantUser.email || undefined,
    role: 'admin',
    is_impersonating: true,
    admin_user_id: scope.user_id,
    vertical_ids: [],
    assignment_ids: [],
  });

  await logPlatformAudit(
    c,
    'support_impersonation',
    tenant.id,
    {
      impersonated_user_id: tenantUser.id,
      impersonated_user_email: tenantUser.email,
      tenant_slug: tenant.slug,
    },
    'Support Session'
  );

  return c.json({
    access_token: impersonationToken,
    tenant_slug: tenant.slug,
    user: {
      id: tenantUser.id,
      name: tenantUser.name,
      email: tenantUser.email || '',
      role: 'admin',
      assignment_ids: [],
    },
  });
});

/* ------------------------------------------------------------------ */
/*  2. Subscription Plans                                              */
/* ------------------------------------------------------------------ */

// GET /platform/plans
platformRouter.get('/plans', async (c) => {
  const plans = await db.query.subscriptionPlans.findMany({
    orderBy: [subscriptionPlans.createdAt],
  });

  const formatted = plans.map((p) => ({
    id: p.id,
    name: p.name,
    max_branches: p.maxBranches,
    max_users: p.maxUsers,
    max_plugins: p.maxPlugins,
    price_monthly: p.priceMonthly,
    created_at: p.createdAt.toISOString(),
  }));

  return c.json(formatted);
});

// POST /platform/plans
platformRouter.post('/plans', async (c) => {
  const b = await c.req.json().catch(() => ({}));

  if (!b.name || b.max_branches === undefined || b.max_users === undefined || b.max_plugins === undefined) {
    return c.json({ code: 'VALIDATION_FAILED', message: 'name, max_branches, max_users, max_plugins required' }, 400);
  }

  const [created] = await db
    .insert(subscriptionPlans)
    .values({
      name: b.name,
      maxBranches: Number(b.max_branches),
      maxUsers: Number(b.max_users),
      maxPlugins: Number(b.max_plugins),
      priceMonthly: b.price_monthly !== undefined ? Number(b.price_monthly) : null,
      capabilities: Array.isArray(b.capabilities) ? b.capabilities : [],
    })
    .returning();

  await logPlatformAudit(c, 'plan_created', created!.id, b);

  return c.json(
    {
      id: created!.id,
      name: created!.name,
      max_branches: created!.maxBranches,
      max_users: created!.maxUsers,
      max_plugins: created!.maxPlugins,
      price_monthly: created!.priceMonthly,
      created_at: created!.createdAt.toISOString(),
    },
    201
  );
});

// PATCH /platform/plans/:id
platformRouter.patch('/plans/:id', async (c) => {
  const id = c.req.param('id');
  const b = await c.req.json().catch(() => ({}));

  const updateFields: Record<string, any> = {};
  if (b.name !== undefined) updateFields['name'] = b.name;
  if (b.max_branches !== undefined) updateFields['maxBranches'] = Number(b.max_branches);
  if (b.max_users !== undefined) updateFields['maxUsers'] = Number(b.max_users);
  if (b.max_plugins !== undefined) updateFields['maxPlugins'] = Number(b.max_plugins);
  if (b.price_monthly !== undefined) updateFields['priceMonthly'] = Number(b.price_monthly);
  if (b.capabilities !== undefined) updateFields['capabilities'] = b.capabilities;

  const [updated] = await db.update(subscriptionPlans).set(updateFields).where(eq(subscriptionPlans.id, id)).returning();

  if (!updated) {
    return c.json({ code: 'NOT_FOUND', message: 'Plan not found' }, 404);
  }

  await logPlatformAudit(c, 'plan_updated', id, updateFields);

  return c.json({
    id: updated.id,
    name: updated.name,
    max_branches: updated.maxBranches,
    max_users: updated.maxUsers,
    max_plugins: updated.maxPlugins,
    price_monthly: updated.priceMonthly,
    created_at: updated.createdAt.toISOString(),
  });
});

/* ------------------------------------------------------------------ */
/*  3. Capability Pricing                                             */
/* ------------------------------------------------------------------ */

// GET /platform/capabilities/pricing
platformRouter.get('/capabilities/pricing', async (c) => {
  const items = await db.query.capabilityPricing.findMany({
    orderBy: [asc(capabilityPricing.name)],
  });

  const formatted = items.map((cp) => ({
    id: cp.id,
    capability_id: cp.capabilityId,
    name: cp.name,
    description: cp.description,
    price_monthly: cp.priceMonthly,
    price_per_user: cp.pricePerUser,
  }));

  return c.json(formatted);
});

// PUT /platform/capabilities/pricing/:capabilityId
platformRouter.put('/capabilities/pricing/:capabilityId', async (c) => {
  const capabilityId = decodeURIComponent(c.req.param('capabilityId'));
  const b = await c.req.json().catch(() => ({}));

  const existing = await db.query.capabilityPricing.findFirst({
    where: eq(capabilityPricing.capabilityId, capabilityId),
  });

  const capMeta = ALL_PLATFORM_CAPABILITIES.find((cap) => cap.id === capabilityId);
  const name = capMeta?.name || capabilityId;
  const description = capMeta?.description || null;

  let result;
  if (existing) {
    const [updated] = await db
      .update(capabilityPricing)
      .set({
        priceMonthly: Number(b.price_monthly) || 0,
        pricePerUser: Number(b.price_per_user) || 0,
      })
      .where(eq(capabilityPricing.id, existing.id))
      .returning();
    result = updated!;
  } else {
    const [inserted] = await db
      .insert(capabilityPricing)
      .values({
        capabilityId,
        name,
        description,
        priceMonthly: Number(b.price_monthly) || 0,
        pricePerUser: Number(b.price_per_user) || 0,
      })
      .returning();
    result = inserted!;
  }

  await logPlatformAudit(c, 'capability_pricing_upserted', result.id, b);

  return c.json({
    id: result.id,
    capability_id: result.capabilityId,
    name: result.name,
    description: result.description,
    price_monthly: result.priceMonthly,
    price_per_user: result.pricePerUser,
  });
});

// DELETE /platform/capabilities/pricing/:capabilityId
platformRouter.delete('/capabilities/pricing/:capabilityId', async (c) => {
  const capabilityId = decodeURIComponent(c.req.param('capabilityId'));
  await db.delete(capabilityPricing).where(eq(capabilityPricing.capabilityId, capabilityId));
  await logPlatformAudit(c, 'capability_pricing_deleted', null, { capabilityId });
  return c.json({ message: 'Capability pricing deleted successfully' });
});

/* ------------------------------------------------------------------ */
/*  4. Plugin Registry Management                                      */
/* ------------------------------------------------------------------ */

// GET /platform/plugins
platformRouter.get('/plugins', async (c) => {
  const plugins = await db.query.pluginRegistry.findMany({
    orderBy: [desc(pluginRegistry.createdAt)],
  });

  const formatted = plugins.map((p) => ({
    id: p.id,
    package_name: p.packageName,
    version: p.version,
    manifest: p.manifest as any,
    status: p.status,
    created_at: p.createdAt.toISOString(),
  }));

  return c.json(formatted);
});

// POST /platform/plugins
platformRouter.post('/plugins', async (c) => {
  const b = await c.req.json().catch(() => ({}));

  if (!b.package_name || !b.version || !b.manifest) {
    return c.json({ code: 'VALIDATION_FAILED', message: 'package_name, version, manifest required' }, 400);
  }

  const [created] = await db
    .insert(pluginRegistry)
    .values({
      packageName: b.package_name,
      version: b.version,
      manifest: b.manifest,
      status: 'active',
    })
    .returning();

  await logPlatformAudit(c, 'plugin_registered', created!.id, { package_name: b.package_name });

  return c.json(
    {
      id: created!.id,
      package_name: created!.packageName,
      version: created!.version,
      manifest: created!.manifest as any,
      status: created!.status,
      created_at: created!.createdAt.toISOString(),
    },
    201
  );
});

// GET /platform/plugins/:id
platformRouter.get('/plugins/:id', async (c) => {
  const id = c.req.param('id');
  const plugin = await db.query.pluginRegistry.findFirst({
    where: eq(pluginRegistry.id, id),
  });

  if (!plugin) {
    return c.json({ code: 'NOT_FOUND', message: 'Plugin not found' }, 404);
  }

  const [tenantStat] = await db
    .select({ count: sql<number>`count(distinct ${tenantPlugins.tenantId})` })
    .from(tenantPlugins)
    .where(and(eq(tenantPlugins.pluginRegistryId, id), eq(tenantPlugins.enabled, true)));

  return c.json({
    id: plugin.id,
    package_name: plugin.packageName,
    version: plugin.version,
    manifest: plugin.manifest as any,
    status: plugin.status,
    created_at: plugin.createdAt.toISOString(),
    tenant_count: Number(tenantStat?.count || 0),
  });
});

// PATCH /platform/plugins/:id/deprecate
platformRouter.patch('/plugins/:id/deprecate', async (c) => {
  const id = c.req.param('id');
  await db.update(pluginRegistry).set({ status: 'deprecated' }).where(eq(pluginRegistry.id, id));
  await logPlatformAudit(c, 'plugin_deprecated', id);
  return c.json({ message: 'Plugin marked as deprecated' });
});

// PATCH /platform/plugins/:id/disable
platformRouter.patch('/plugins/:id/disable', async (c) => {
  const id = c.req.param('id');
  await db.update(pluginRegistry).set({ status: 'disabled' }).where(eq(pluginRegistry.id, id));
  await logPlatformAudit(c, 'plugin_disabled', id);
  return c.json({ message: 'Plugin disabled successfully' });
});

/* ------------------------------------------------------------------ */
/*  5. Platform Team Management                                       */
/* ------------------------------------------------------------------ */

// GET /platform/team
platformRouter.get('/team', async (c) => {
  const teamUsers = await db.query.platformUsers.findMany({
    orderBy: [desc(platformUsers.createdAt)],
  });

  const rolesList = await db.query.platformUserRoles.findMany();
  const rolesByUserId = new Map<string, string>();
  rolesList.forEach((r) => rolesByUserId.set(r.platformUserId, r.role));

  const formatted = teamUsers.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: rolesByUserId.get(u.id) || 'platform_admin',
    status: u.status,
    created_at: u.createdAt.toISOString(),
  }));

  return c.json(formatted);
});

// POST /platform/team/invite
platformRouter.post('/team/invite', async (c) => {
  const b = await c.req.json().catch(() => ({}));

  if (!b.name || !b.email || !b.role) {
    return c.json({ code: 'VALIDATION_FAILED', message: 'Name, email, and role are required' }, 400);
  }

  const existing = await db.query.platformUsers.findFirst({
    where: eq(platformUsers.email, b.email),
  });
  if (existing) {
    return c.json({ code: 'EMAIL_IN_USE', message: 'Platform user email already registered' }, 409);
  }

  const tempPassword = `Platform!${Math.floor(100000 + Math.random() * 900000)}`;
  const passwordHash = await hashPassword(tempPassword);

  const [newUser] = await db
    .insert(platformUsers)
    .values({
      name: b.name,
      email: b.email,
      passwordHash,
      status: 'active',
    })
    .returning();

  await db.insert(platformUserRoles).values({
    platformUserId: newUser!.id,
    role: b.role,
  });

  await logPlatformAudit(c, 'platform_user_invited', newUser!.id, { email: b.email, role: b.role });

  return c.json(
    {
      id: newUser!.id,
      name: newUser!.name,
      email: newUser!.email,
      role: b.role,
      status: newUser!.status,
      created_at: newUser!.createdAt.toISOString(),
    },
    201
  );
});

// PATCH /platform/team/:userId/role
platformRouter.patch('/team/:userId/role', async (c) => {
  const userId = c.req.param('userId');
  const { role } = await c.req.json().catch(() => ({}));

  if (!role) {
    return c.json({ code: 'VALIDATION_FAILED', message: 'Role is required' }, 400);
  }

  await db.delete(platformUserRoles).where(eq(platformUserRoles.platformUserId, userId));
  await db.insert(platformUserRoles).values({
    platformUserId: userId,
    role,
  });

  await logPlatformAudit(c, 'platform_user_role_updated', userId, { role });
  return c.json({ message: 'Platform user role updated successfully' });
});

// DELETE /platform/team/:userId
platformRouter.delete('/team/:userId', async (c) => {
  const userId = c.req.param('userId');
  await db.update(platformUsers).set({ status: 'inactive' }).where(eq(platformUsers.id, userId));
  await logPlatformAudit(c, 'platform_user_deactivated', userId);
  return c.json({ message: 'Platform user deactivated successfully' });
});

/* ------------------------------------------------------------------ */
/*  6. Platform Reports & System Metrics                              */
/* ------------------------------------------------------------------ */

// GET /platform/reports/tenant-count
platformRouter.get('/reports/tenant-count', async (c) => {
  const allTenants = await db.query.tenants.findMany({
    columns: { industry: true },
  });

  const indMap: Record<string, number> = {};
  allTenants.forEach((t) => {
    indMap[t.industry] = (indMap[t.industry] || 0) + 1;
  });

  return c.json({
    total: allTenants.length,
    by_industry: Object.entries(indMap).map(([industry, count]) => ({ industry, count })),
  });
});

// GET /platform/reports/mau
platformRouter.get('/reports/mau', async (c) => {
  const userCounts = await db
    .select({
      tenantId: users.tenantId,
      activeUsers: sql<number>`count(${users.id})`,
    })
    .from(users)
    .where(eq(users.status, 'active'))
    .groupBy(users.tenantId);

  return c.json({
    monthly_active: userCounts.map((u) => ({
      tenant_id: u.tenantId,
      active_users: Number(u.activeUsers || 0),
    })),
  });
});

// GET /platform/reports/cases-per-day
platformRouter.get('/reports/cases-per-day', async (c) => {
  const recentLeads = await db
    .select({
      dateStr: sql<string>`to_char(${leads.createdAt}, 'YYYY-MM-DD')`,
      count: sql<number>`count(${leads.id})`,
    })
    .from(leads)
    .groupBy(sql`to_char(${leads.createdAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${leads.createdAt}, 'YYYY-MM-DD') desc`)
    .limit(30);

  return c.json({
    daily: recentLeads.map((r) => ({
      date: r.dateStr,
      count: Number(r.count || 0),
    })),
  });
});

// GET /platform/reports/plugin-usage
platformRouter.get('/reports/plugin-usage', async (c) => {
  const usage = await db
    .select({
      packageName: pluginRegistry.packageName,
      count: sql<number>`count(distinct ${tenantPlugins.tenantId})`,
    })
    .from(tenantPlugins)
    .innerJoin(pluginRegistry, eq(tenantPlugins.pluginRegistryId, pluginRegistry.id))
    .where(eq(tenantPlugins.enabled, true))
    .groupBy(pluginRegistry.packageName);

  return c.json({
    plugins: usage.map((u) => ({
      plugin_package: u.packageName,
      tenant_count: Number(u.count || 0),
    })),
  });
});

/* ------------------------------------------------------------------ */
/*  7. Queue Monitors & Webhooks Dead-Letter Replay                   */
/* ------------------------------------------------------------------ */

// GET /platform/system/queue/status
platformRouter.get('/system/queue/status', async (c) => {
  return c.json({
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
    delayed: 0,
    processing_rate: 100,
    paused: false,
  });
});

// GET /platform/system/queue/failed
platformRouter.get('/system/queue/failed', async (c) => {
  return c.json([]);
});

// POST /platform/system/queue/failed/:jobId/retry
platformRouter.post('/system/queue/failed/:jobId/retry', async (c) => {
  return c.json({ message: 'Job scheduled for retry' });
});

// POST /platform/system/queue/pause
platformRouter.post('/system/queue/pause', async (c) => {
  await logPlatformAudit(c, 'queue_paused', null);
  return c.json({ message: 'Queue workers paused successfully' });
});

// POST /platform/system/queue/resume
platformRouter.post('/system/queue/resume', async (c) => {
  await logPlatformAudit(c, 'queue_resumed', null);
  return c.json({ message: 'Queue workers resumed successfully' });
});

// GET /platform/system/webhooks/failures
platformRouter.get('/system/webhooks/failures', async (c) => {
  const failedEvents = await db
    .select({
      event: inboundEvents,
      connection: integrationConnections,
    })
    .from(inboundEvents)
    .innerJoin(integrationConnections, eq(inboundEvents.connectionId, integrationConnections.id))
    .where(eq(inboundEvents.status, 'failed'))
    .orderBy(desc(inboundEvents.receivedAt))
    .limit(50);

  const formatted = failedEvents.map(({ event, connection }) => ({
    id: event.id,
    tenant_id: connection.tenantId,
    event_type: event.eventType,
    last_error: event.errorMessage || 'Webhook processing failed',
    attempts: 1,
    failed_at: (event.processedAt || event.receivedAt).toISOString(),
  }));

  return c.json(formatted);
});

// POST /platform/system/webhooks/failures/:failureId/retry
platformRouter.post('/system/webhooks/failures/:failureId/retry', async (c) => {
  const failureId = c.req.param('failureId');

  const [updated] = await db
    .update(inboundEvents)
    .set({
      status: 'received',
      errorMessage: null,
      processedAt: null,
    })
    .where(eq(inboundEvents.id, failureId))
    .returning();

  if (!updated) {
    return c.json({ code: 'NOT_FOUND', message: 'Webhook event not found' }, 404);
  }

  await logPlatformAudit(c, 'webhook_failure_retried', failureId);
  return c.json({ message: 'Webhook replayed successfully' });
});

/* ------------------------------------------------------------------ */
/*  8. Platform Audit Logs                                            */
/* ------------------------------------------------------------------ */

// GET /platform/audit-logs
platformRouter.get('/audit-logs', async (c) => {
  const cursor = c.req.query('cursor');
  const limit = Math.min(Math.max(Number(c.req.query('limit')) || 50, 1), 100);

  const conditions = [];
  if (cursor) {
    const cursorDate = new Date(cursor);
    if (!isNaN(cursorDate.getTime())) {
      conditions.push(lt(platformAuditLogs.createdAt, cursorDate));
    }
  }

  const logs = await db.query.platformAuditLogs.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(platformAuditLogs.createdAt)],
    limit: limit + 1,
  });

  const hasNext = logs.length > limit;
  const items = hasNext ? logs.slice(0, limit) : logs;
  const nextCursor = hasNext && items.length > 0 ? items[items.length - 1]!.createdAt.toISOString() : undefined;

  const data = items.map((l) => ({
    id: l.id,
    actor_id: l.actorId,
    actor_email: l.actorEmail,
    actor_role: l.actorRole,
    action: l.action,
    target_id: l.targetId,
    actor_ip: l.actorIp,
    user_agent: l.userAgent,
    details: l.details,
    reason: l.reason,
    created_at: l.createdAt.toISOString(),
  }));

  return c.json({
    data,
    next_cursor: nextCursor,
  });
});
