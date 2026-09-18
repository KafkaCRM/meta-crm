import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { roles, rolePermissions } from '../db/schema';
import { validateJson } from '../middleware/validator';
import { requireAuth } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import type { AppEnv } from '../types/context';

export const rolesRouter = new Hono<AppEnv>();

rolesRouter.use('*', requireAuth, requireTenant);

rolesRouter.get('/', async (c) => {
  const scope = c.get('scope');

  const tenantRoles = await db.query.roles.findMany({
    where: eq(roles.tenantId, scope.tenant_id),
    orderBy: [desc(roles.createdAt)],
    with: {
      permissions: true,
    },
  });

  return c.json(tenantRoles);
});

const roleSchema = z.object({
  name: z.string().min(1, 'Role name is required'),
  slug: z.string().min(1, 'Role slug is required'),
  description: z.string().optional().nullable(),
  permissions: z
    .array(
      z.object({
        resource: z.string(),
        action: z.string(),
        conditions: z.record(z.string(), z.any()).optional(),
      })
    )
    .optional(),
});

rolesRouter.post('/', validateJson(roleSchema), async (c) => {
  const scope = c.get('scope');
  const body = c.get('validatedJson' as any) as z.infer<typeof roleSchema>;

  const created = await db.transaction(async (tx) => {
    const [newRole] = await tx
      .insert(roles)
      .values({
        tenantId: scope.tenant_id,
        name: body.name,
        slug: body.slug,
        description: body.description,
        isSystemRole: false,
      })
      .returning();

    if (body.permissions && body.permissions.length > 0) {
      await tx.insert(rolePermissions).values(
        body.permissions.map((p) => ({
          roleId: newRole!.id,
          resource: p.resource,
          action: p.action,
          conditions: p.conditions,
        }))
      );
    }

    return tx.query.roles.findFirst({
      where: eq(roles.id, newRole!.id),
      with: { permissions: true },
    });
  });

  return c.json(created, 201);
});

rolesRouter.patch('/:id', async (c) => {
  const scope = c.get('scope');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));

  const existing = await db.query.roles.findFirst({
    where: and(eq(roles.id, id), eq(roles.tenantId, scope.tenant_id)),
  });

  if (!existing) {
    return c.json({ code: 'NOT_FOUND', message: 'Role not found' }, 404);
  }

  const updated = await db.transaction(async (tx) => {
    if (body.name || body.description !== undefined) {
      await tx
        .update(roles)
        .set({
          ...(body.name && { name: body.name }),
          ...(body.description !== undefined && { description: body.description }),
        })
        .where(eq(roles.id, id));
    }

    if (Array.isArray(body.permissions)) {
      await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, id));
      if (body.permissions.length > 0) {
        await tx.insert(rolePermissions).values(
          body.permissions.map((p: any) => ({
            roleId: id,
            resource: p.resource,
            action: p.action,
            conditions: p.conditions,
          }))
        );
      }
    }

    return tx.query.roles.findFirst({
      where: eq(roles.id, id),
      with: { permissions: true },
    });
  });

  return c.json(updated);
});

rolesRouter.delete('/:id', async (c) => {
  const scope = c.get('scope');
  const id = c.req.param('id');

  const role = await db.query.roles.findFirst({
    where: and(eq(roles.id, id), eq(roles.tenantId, scope.tenant_id)),
  });

  if (!role) {
    return c.json({ code: 'NOT_FOUND', message: 'Role not found' }, 404);
  }

  if (role.isSystemRole) {
    return c.json({ code: 'FORBIDDEN', message: 'System roles cannot be deleted' }, 403);
  }

  await db.delete(roles).where(eq(roles.id, id));

  return c.json({ message: 'Role deleted successfully' });
});
