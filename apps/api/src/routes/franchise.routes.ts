import { Hono } from 'hono';
import { eq, and, desc, sql, inArray, gte, lte } from 'drizzle-orm';
import { db } from '../db';
import {
  tenants,
  branches,
  users,
  roles,
  userRoles,
  invoices,
  franchiseRoyaltyStatements,
} from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import { hashPassword } from '../lib/crypto';
import type { AppEnv } from '../types/context';

export const franchiseRouter = new Hono<AppEnv>();

franchiseRouter.use('*', requireAuth, requireTenant);

/**
 * GET /status - Returns franchise role and hierarchy info for current workspace
 */
franchiseRouter.get('/status', async (c) => {
  const scope = c.get('scope');

  const current = await db.query.tenants.findFirst({
    where: eq(tenants.id, scope.tenant_id),
    with: {
      parent: { columns: { id: true, name: true, slug: true, industry: true } },
      franchisees: { columns: { id: true, name: true, slug: true, status: true } },
    },
  });

  if (!current) {
    return c.json({ code: 'NOT_FOUND', message: 'Tenant not found' }, 404);
  }

  return c.json({
    tenant_id: current.id,
    tenant_name: current.name,
    tenant_slug: current.slug,
    tenant_type: current.tenantType,
    is_franchisor: current.tenantType === 'franchisor' || (current.franchisees && current.franchisees.length > 0),
    is_franchisee: current.tenantType === 'franchisee' || Boolean(current.parentTenantId),
    parent_franchisor: current.parent || null,
    royalty_percentage: current.royaltyPercentage,
    territory_codes: current.territoryCodes,
    franchisee_count: current.franchisees?.length || 0,
  });
});

/**
 * GET /franchisees - List child franchisees (Franchisor view)
 */
franchiseRouter.get('/franchisees', async (c) => {
  const scope = c.get('scope');

  const list = await db.query.tenants.findMany({
    where: eq(tenants.parentTenantId, scope.tenant_id),
    orderBy: [desc(tenants.createdAt)],
    with: {
      branches: { columns: { id: true, name: true, city: true } },
      users: { columns: { id: true, name: true, email: true } },
    },
  });

  const formatted = list.map((f) => ({
    id: f.id,
    name: f.name,
    slug: f.slug,
    status: f.status,
    royalty_percentage: f.royaltyPercentage,
    territory_codes: f.territoryCodes,
    branch_count: f.branches?.length || 0,
    user_count: f.users?.length || 0,
    branches: f.branches,
    created_at: f.createdAt.toISOString(),
  }));

  return c.json(formatted);
});

/**
 * POST /franchisees - Provision a new Franchisee store under current Franchisor
 */
franchiseRouter.post('/franchisees', async (c) => {
  const scope = c.get('scope');
  const b = await c.req.json().catch(() => ({}));

  if (!b.name || !b.slug) {
    return c.json({ code: 'VALIDATION_FAILED', message: 'Franchisee name and slug are required' }, 400);
  }

  const currentFranchisor = await db.query.tenants.findFirst({
    where: eq(tenants.id, scope.tenant_id),
  });

  if (!currentFranchisor) {
    return c.json({ code: 'NOT_FOUND', message: 'Current franchisor workspace not found' }, 404);
  }

  // Ensure current tenant is tagged as franchisor
  if (currentFranchisor.tenantType !== 'franchisor') {
    await db.update(tenants).set({ tenantType: 'franchisor' }).where(eq(tenants.id, scope.tenant_id));
  }

  // Check slug availability
  const existing = await db.query.tenants.findFirst({
    where: eq(tenants.slug, b.slug),
  });
  if (existing) {
    return c.json({ code: 'SLUG_IN_USE', message: 'Slug already taken by another workspace' }, 409);
  }

  const result = await db.transaction(async (tx) => {
    // 1. Create child franchisee tenant
    const [newFranchisee] = await tx
      .insert(tenants)
      .values({
        name: b.name,
        slug: b.slug,
        industry: currentFranchisor.industry,
        tenantType: 'franchisee',
        parentTenantId: currentFranchisor.id,
        royaltyPercentage: Number(b.royalty_percentage) || currentFranchisor.royaltyPercentage || 5.0,
        territoryCodes: Array.isArray(b.territory_codes) ? b.territory_codes : [],
        configJson: currentFranchisor.configJson, // Inherit base capabilities
        status: 'active',
      })
      .returning();

    // 2. Create primary store branch for the franchisee
    const [mainBranch] = await tx
      .insert(branches)
      .values({
        tenantId: newFranchisee!.id,
        name: b.branch_name || `${b.name} - Store #1`,
        city: b.city || null,
        address: b.address || null,
      })
      .returning();

    // 3. Create Franchisee Administrator account if owner info provided
    let ownerUser = null;
    if (b.owner?.email) {
      const initialPassword = b.owner.password || 'Franchise@123';
      const pwHash = await hashPassword(initialPassword);

      const [createdUser] = await tx
        .insert(users)
        .values({
          tenantId: newFranchisee!.id,
          branchId: mainBranch!.id,
          name: b.owner.name || `${b.name} Manager`,
          email: b.owner.email,
          passwordHash: pwHash,
          status: 'active',
        })
        .returning();

      ownerUser = createdUser;

      // Assign admin role
      const [adminRole] = await tx
        .insert(roles)
        .values({
          tenantId: newFranchisee!.id,
          name: 'Franchise Admin',
          slug: 'franchise_admin',
          displayName: 'Franchise Administrator',
          isSystemRole: true,
        })
        .returning();

      if (adminRole && createdUser) {
        await tx.insert(userRoles).values({
          userId: createdUser.id,
          roleId: adminRole.id,
          tenantId: newFranchisee!.id,
        });
      }
    }

    return {
      franchisee: newFranchisee,
      branch: mainBranch,
      owner: ownerUser
        ? {
            id: ownerUser.id,
            name: ownerUser.name,
            email: ownerUser.email,
          }
        : null,
    };
  });

  return c.json(result, 201);
});

/**
 * PATCH /franchisees/:id - Update franchisee agreement settings (territory, royalties)
 */
franchiseRouter.patch('/franchisees/:id', async (c) => {
  const scope = c.get('scope');
  const franchiseeId = c.req.param('id');
  const b = await c.req.json().catch(() => ({}));

  const updateFields: Record<string, any> = {};
  if (b.name !== undefined) updateFields['name'] = b.name;
  if (b.royalty_percentage !== undefined) updateFields['royaltyPercentage'] = Number(b.royalty_percentage);
  if (b.territory_codes !== undefined) updateFields['territoryCodes'] = b.territory_codes;
  if (b.status !== undefined) updateFields['status'] = b.status;

  const [updated] = await db
    .update(tenants)
    .set(updateFields)
    .where(and(eq(tenants.id, franchiseeId), eq(tenants.parentTenantId, scope.tenant_id)))
    .returning();

  if (!updated) {
    return c.json({ code: 'NOT_FOUND', message: 'Franchisee not found under your management' }, 404);
  }

  return c.json(updated);
});

/**
 * POST /royalties/calculate - Calculate royalties across child franchisees
 */
franchiseRouter.post('/royalties/calculate', async (c) => {
  const scope = c.get('scope');
  const b = await c.req.json().catch(() => ({}));

  const periodStart = b.period_start ? new Date(b.period_start) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const periodEnd = b.period_end ? new Date(b.period_end) : new Date();

  const franchiseeConditions = [eq(tenants.parentTenantId, scope.tenant_id)];
  if (b.franchisee_id) {
    franchiseeConditions.push(eq(tenants.id, b.franchisee_id));
  }

  const childFranchisees = await db.query.tenants.findMany({
    where: and(...franchiseeConditions),
  });

  if (childFranchisees.length === 0) {
    return c.json({ message: 'No franchisees found to calculate royalties for', statements: [] });
  }

  const createdStatements = [];

  for (const franchisee of childFranchisees) {
    // Sum paid invoices within the period
    const [salesSum] = await db
      .select({
        total: sql<number>`coalesce(sum(${invoices.amount}), 0)`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, franchisee.id),
          eq(invoices.status, 'paid'),
          gte(invoices.issueDate, periodStart),
          lte(invoices.issueDate, periodEnd)
        )
      );

    const grossSales = Number(salesSum?.total || 0);
    const royaltyRate = franchisee.royaltyPercentage || 5.0;
    const royaltyAmount = Math.round(grossSales * (royaltyRate / 100) * 100) / 100;

    const [statement] = await db
      .insert(franchiseRoyaltyStatements)
      .values({
        franchisorTenantId: scope.tenant_id,
        franchiseeTenantId: franchisee.id,
        periodStart,
        periodEnd,
        grossSales,
        royaltyRate,
        royaltyAmount,
        status: 'pending',
      })
      .returning();

    createdStatements.push({
      ...statement,
      franchisee_name: franchisee.name,
      franchisee_slug: franchisee.slug,
    });
  }

  return c.json({
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    statements_generated: createdStatements.length,
    statements: createdStatements,
  });
});

/**
 * GET /royalties/statements - List royalty statements
 */
franchiseRouter.get('/royalties/statements', async (c) => {
  const scope = c.get('scope');

  const statements = await db.query.franchiseRoyaltyStatements.findMany({
    where: sql`${franchiseRoyaltyStatements.franchisorTenantId} = ${scope.tenant_id} OR ${franchiseRoyaltyStatements.franchiseeTenantId} = ${scope.tenant_id}`,
    orderBy: [desc(franchiseRoyaltyStatements.generatedAt)],
    with: {
      franchisee: { columns: { id: true, name: true, slug: true } },
      franchisor: { columns: { id: true, name: true, slug: true } },
    },
  });

  return c.json(statements);
});

/**
 * GET /analytics - Aggregated rollup reporting for Franchisor
 */
franchiseRouter.get('/analytics', async (c) => {
  const scope = c.get('scope');

  const childFranchisees = await db.query.tenants.findMany({
    where: eq(tenants.parentTenantId, scope.tenant_id),
    with: {
      branches: { columns: { id: true } },
    },
  });

  const franchiseeIds = childFranchisees.map((f) => f.id);

  let totalNetworkSales = 0;
  let totalInvoicesCount = 0;

  if (franchiseeIds.length > 0) {
    const [salesStat] = await db
      .select({
        totalSales: sql<number>`coalesce(sum(${invoices.amount}), 0)`,
        count: sql<number>`count(${invoices.id})`,
      })
      .from(invoices)
      .where(and(inArray(invoices.tenantId, franchiseeIds), eq(invoices.status, 'paid')));

    totalNetworkSales = Number(salesStat?.totalSales || 0);
    totalInvoicesCount = Number(salesStat?.count || 0);
  }

  const [royaltyStat] = await db
    .select({
      totalAccrued: sql<number>`coalesce(sum(${franchiseRoyaltyStatements.royaltyAmount}), 0)`,
    })
    .from(franchiseRoyaltyStatements)
    .where(eq(franchiseRoyaltyStatements.franchisorTenantId, scope.tenant_id));

  const totalStoresCount = childFranchisees.reduce((acc, f) => acc + (f.branches?.length || 0), 0);

  return c.json({
    total_franchisees: childFranchisees.length,
    total_stores: totalStoresCount,
    total_network_sales: totalNetworkSales,
    total_paid_transactions: totalInvoicesCount,
    total_royalties_accrued: Number(royaltyStat?.totalAccrued || 0),
    top_franchisees: childFranchisees.map((f) => ({
      id: f.id,
      name: f.name,
      slug: f.slug,
      store_count: f.branches?.length || 0,
      royalty_rate: f.royaltyPercentage,
      territories: f.territoryCodes,
    })),
  });
});
