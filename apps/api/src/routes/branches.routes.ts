import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and, desc, asc, inArray } from 'drizzle-orm';
import { db } from '../db';
import { branches, verticals, users, userBranches } from '../db/schema';
import { validateJson } from '../middleware/validator';
import { requireAuth } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import type { AppEnv } from '../types/context';

export const branchesRouter = new Hono<AppEnv>();

branchesRouter.use('*', requireAuth, requireTenant);

branchesRouter.get('/', async (c) => {
  const scope = c.get('scope');
  const accessibleOnly = c.req.query('accessible') === 'true';
  const isAdmin = ['admin', 'tenant_admin', 'super_admin', 'platform_admin', 'owner'].includes(scope.role);

  const conditions = [eq(branches.tenantId, scope.tenant_id)];

  if (accessibleOnly && !isAdmin && scope.user_id) {
    const userBranchRows = await db.query.userBranches.findMany({
      where: and(eq(userBranches.tenantId, scope.tenant_id), eq(userBranches.userId, scope.user_id)),
      columns: { branchId: true },
    });
    const allowedBranchIds = userBranchRows.map((ub) => ub.branchId);

    const userRow = await db.query.users.findFirst({
      where: and(eq(users.tenantId, scope.tenant_id), eq(users.id, scope.user_id)),
      columns: { branchId: true },
    });
    if (userRow?.branchId && !allowedBranchIds.includes(userRow.branchId)) {
      allowedBranchIds.push(userRow.branchId);
    }

    if (allowedBranchIds.length > 0) {
      conditions.push(inArray(branches.id, allowedBranchIds));
    } else {
      conditions.push(eq(branches.id, '__NO_MATCH__'));
    }
  }

  const results = await db.query.branches.findMany({
    where: and(...conditions),
    orderBy: [asc(branches.createdAt)],
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

  if (created) {
    await db
      .insert(verticals)
      .values({
        tenantId: scope.tenant_id,
        branchId: created.id,
        name: 'General',
      });
  }

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
