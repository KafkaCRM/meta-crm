import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { verticals } from '../db/schema';
import { validateJson } from '../middleware/validator';
import { requireAuth } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import type { AppEnv } from '../types/context';

export const verticalsRouter = new Hono<AppEnv>();

verticalsRouter.use('*', requireAuth, requireTenant);

verticalsRouter.get('/', async (c) => {
  const scope = c.get('scope');
  const branchId = c.req.query('branch_id');

  const conditions = [eq(verticals.tenantId, scope.tenant_id)];
  if (branchId) conditions.push(eq(verticals.branchId, branchId));

  const results = await db.query.verticals.findMany({
    where: and(...conditions),
    orderBy: [desc(verticals.createdAt)],
    with: {
      branch: { columns: { id: true, name: true } },
    },
  });

  return c.json(results);
});

const verticalSchema = z.object({
  branch_id: z.string().min(1, 'Branch ID is required'),
  name: z.string().min(1, 'Vertical name is required'),
});

verticalsRouter.post('/', validateJson(verticalSchema), async (c) => {
  const scope = c.get('scope');
  const body = c.get('validatedJson' as any) as z.infer<typeof verticalSchema>;

  const [created] = await db
    .insert(verticals)
    .values({
      tenantId: scope.tenant_id,
      branchId: body.branch_id,
      name: body.name,
    })
    .returning();

  return c.json(created, 201);
});

verticalsRouter.patch('/:id', async (c) => {
  const scope = c.get('scope');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));

  const [updated] = await db
    .update(verticals)
    .set({
      ...(body.name !== undefined && { name: body.name }),
    })
    .where(and(eq(verticals.id, id), eq(verticals.tenantId, scope.tenant_id)))
    .returning();

  if (!updated) {
    return c.json({ code: 'NOT_FOUND', message: 'Vertical not found' }, 404);
  }

  return c.json(updated);
});

verticalsRouter.delete('/:id', async (c) => {
  const scope = c.get('scope');
  const id = c.req.param('id');

  const [deleted] = await db
    .delete(verticals)
    .where(and(eq(verticals.id, id), eq(verticals.tenantId, scope.tenant_id)))
    .returning();

  if (!deleted) {
    return c.json({ code: 'NOT_FOUND', message: 'Vertical not found' }, 404);
  }

  return c.json({ message: 'Vertical deleted successfully' });
});
