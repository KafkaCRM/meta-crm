import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { labelOverrides } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import type { AppEnv } from '../types/context';

export const labelsRouter = new Hono<AppEnv>();

labelsRouter.use('*', requireAuth, requireTenant);

labelsRouter.get('/', async (c) => {
  const scope = c.get('scope');

  const overrides = await db.query.labelOverrides.findMany({
    where: eq(labelOverrides.tenantId, scope.tenant_id),
  });

  const map: Record<string, string> = {};
  for (const o of overrides) {
    map[o.labelKey] = o.overrideValue;
  }

  return c.json(map);
});

labelsRouter.put('/:key', async (c) => {
  const scope = c.get('scope');
  const key = c.req.param('key');
  const { override_value } = await c.req.json().catch(() => ({}));

  if (override_value === undefined) {
    return c.json({ code: 'VALIDATION_FAILED', message: 'override_value is required' }, 400);
  }

  const existing = await db.query.labelOverrides.findFirst({
    where: and(eq(labelOverrides.tenantId, scope.tenant_id), eq(labelOverrides.labelKey, key)),
  });

  if (existing) {
    const [updated] = await db
      .update(labelOverrides)
      .set({ overrideValue: String(override_value) })
      .where(eq(labelOverrides.id, existing.id))
      .returning();
    return c.json(updated);
  } else {
    const [created] = await db
      .insert(labelOverrides)
      .values({
        tenantId: scope.tenant_id,
        labelKey: key,
        overrideValue: String(override_value),
      })
      .returning();
    return c.json(created, 201);
  }
});
