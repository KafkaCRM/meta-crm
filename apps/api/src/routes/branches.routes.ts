import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { branches } from '../db/schema';
import { validateJson } from '../middleware/validator';
import { requireAuth } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import type { AppEnv } from '../types/context';

export const branchesRouter = new Hono<AppEnv>();

branchesRouter.use('*', requireAuth, requireTenant);

branchesRouter.get('/', async (c) => {
  const scope = c.get('scope');
  const results = await db.query.branches.findMany({
    where: eq(branches.tenantId, scope.tenant_id),
    orderBy: [desc(branches.createdAt)],
  });
  return c.json(results);
});

const branchSchema = z.object({
  name: z.string().min(1, 'Branch name is required'),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  manager_id: z.string().optional().nullable(),
});

branchesRouter.post('/', validateJson(branchSchema), async (c) => {
  const scope = c.get('scope');
  const body = c.get('validatedJson' as any) as z.infer<typeof branchSchema>;

  const [created] = await db
    .insert(branches)
    .values({
      tenantId: scope.tenant_id,
      name: body.name,
      address: body.address,
      city: body.city,
      managerId: body.manager_id,
    })
    .returning();

  return c.json(created, 201);
});

branchesRouter.patch('/:id', async (c) => {
  const scope = c.get('scope');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));

  const [updated] = await db
    .update(branches)
    .set({
      ...(body.name !== undefined && { name: body.name }),
      ...(body.address !== undefined && { address: body.address }),
      ...(body.city !== undefined && { city: body.city }),
      ...(body.manager_id !== undefined && { managerId: body.manager_id }),
    })
    .where(and(eq(branches.id, id), eq(branches.tenantId, scope.tenant_id)))
    .returning();

  if (!updated) {
    return c.json({ code: 'NOT_FOUND', message: 'Branch not found' }, 404);
  }

  return c.json(updated);
});

branchesRouter.delete('/:id', async (c) => {
  const scope = c.get('scope');
  const id = c.req.param('id');

  const [deleted] = await db
    .delete(branches)
    .where(and(eq(branches.id, id), eq(branches.tenantId, scope.tenant_id)))
    .returning();

  if (!deleted) {
    return c.json({ code: 'NOT_FOUND', message: 'Branch not found' }, 404);
  }

  return c.json({ message: 'Branch deleted successfully' });
});
