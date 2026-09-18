import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db';
import { tenants, subscriptionPlans, tenantPlans, platformAuditLogs } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { requirePlatformAdmin } from '../middleware/tenant';
import type { AppEnv } from '../types/context';

export const platformRouter = new Hono<AppEnv>();

platformRouter.use('*', requireAuth, requirePlatformAdmin);

// GET /platform/tenants - List all customer workspaces
platformRouter.get('/tenants', async (c) => {
  const list = await db.query.tenants.findMany({
    orderBy: [desc(tenants.createdAt)],
    with: {
      users: { columns: { id: true, name: true, email: true } },
      branches: { columns: { id: true, name: true } },
    },
  });
  return c.json(list);
});

// POST /platform/tenants/:id/status - Suspend or activate tenant
platformRouter.post('/tenants/:id/status', async (c) => {
  const id = c.req.param('id');
  const { status } = await c.req.json().catch(() => ({}));

  if (!status || !['active', 'suspended'].includes(status)) {
    return c.json({ code: 'VALIDATION_FAILED', message: 'Valid status required (active | suspended)' }, 400);
  }

  const [updated] = await db
    .update(tenants)
    .set({ status })
    .where(eq(tenants.id, id))
    .returning();

  if (!updated) {
    return c.json({ code: 'NOT_FOUND', message: 'Tenant not found' }, 404);
  }

  return c.json(updated);
});

// GET /platform/plans
platformRouter.get('/plans', async (c) => {
  const plans = await db.query.subscriptionPlans.findMany({
    orderBy: [subscriptionPlans.createdAt],
  });
  return c.json(plans);
});

// GET /platform/audit-logs
platformRouter.get('/audit-logs', async (c) => {
  const logs = await db.query.platformAuditLogs.findMany({
    orderBy: [desc(platformAuditLogs.createdAt)],
    limit: 100,
  });
  return c.json(logs);
});
