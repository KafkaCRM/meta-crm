import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { users, userRoles, roles, userBranches, userVerticals } from '../db/schema';
import { hashPassword, generateToken } from '../lib/crypto';
import { validateJson } from '../middleware/validator';
import { requireAuth } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import type { AppEnv } from '../types/context';

export const usersRouter = new Hono<AppEnv>();

usersRouter.use('*', requireAuth, requireTenant);

usersRouter.get('/', async (c) => {
  const scope = c.get('scope');

  const tenantUsers = await db.query.users.findMany({
    where: eq(users.tenantId, scope.tenant_id),
    orderBy: [desc(users.createdAt)],
    with: {
      branch: { columns: { id: true, name: true } },
      userBranches: { with: { branch: { columns: { id: true, name: true } } } },
      userVerticals: { with: { vertical: { columns: { id: true, name: true } } } },
    },
  });

  // Attach roles for each user
  const userIds = tenantUsers.map((u) => u.id);
  const allRoles = userIds.length > 0
    ? await db
        .select({
          userId: userRoles.userId,
          roleId: roles.id,
          roleName: roles.name,
          roleSlug: roles.slug,
          assignmentId: userRoles.assignmentId,
        })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(eq(userRoles.tenantId, scope.tenant_id))
    : [];

  const rolesByUserId = new Map<string, any[]>();
  for (const r of allRoles) {
    const list = rolesByUserId.get(r.userId) || [];
    list.push({ role_id: r.roleId, role_name: r.roleName, role_slug: r.roleSlug, assignment_id: r.assignmentId });
    rolesByUserId.set(r.userId, list);
  }

  const data = tenantUsers.map((u) => {
    const assignedBranches = (u as any).userBranches?.map((ub: any) => ub.branch).filter(Boolean) || [];
    if (u.branch && !assignedBranches.some((b: any) => b.id === u.branch!.id)) {
      assignedBranches.unshift(u.branch);
    }
    const branchIds = assignedBranches.map((b: any) => b.id);
    const assignedVerticals = (u as any).userVerticals?.map((uv: any) => uv.vertical).filter(Boolean) || [];
    const verticalIds = assignedVerticals.map((v: any) => v.id);

    return {
      id: u.id,
      tenant_id: u.tenantId,
      name: u.name,
      email: u.email,
      phone_number: u.phoneNumber,
      status: u.status,
      branch_id: u.branchId,
      branch: u.branch,
      branches: assignedBranches,
      branch_ids: branchIds,
      verticals: assignedVerticals,
      vertical_ids: verticalIds,
      roles: rolesByUserId.get(u.id) || [],
      created_at: u.createdAt,
    };
  });

  return c.json(data);
});

usersRouter.get('/:id', async (c) => {
  const scope = c.get('scope');
  const id = c.req.param('id');

  const user = await db.query.users.findFirst({
    where: and(eq(users.id, id), eq(users.tenantId, scope.tenant_id)),
    with: {
      branch: true,
      userBranches: { with: { branch: true } },
      userVerticals: { with: { vertical: true } },
    },
  });

  if (!user) {
    return c.json({ code: 'NOT_FOUND', message: 'User not found' }, 404);
  }

  const assignedBranches = user.userBranches?.map((ub: any) => ub.branch).filter(Boolean) || [];
  if (user.branch && !assignedBranches.some((b: any) => b.id === user.branch!.id)) {
    assignedBranches.unshift(user.branch);
  }

  return c.json({
    ...user,
    branches: assignedBranches,
    branch_ids: assignedBranches.map((b: any) => b.id),
    verticals: user.userVerticals?.map((uv: any) => uv.vertical).filter(Boolean) || [],
    vertical_ids: user.userVerticals?.map((uv: any) => uv.verticalId) || [],
  });
});

const inviteUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email().optional().nullable(),
  phone_number: z.string().min(1, 'Phone number is required'),
  password: z.string().optional(),
  branch_id: z.string().optional().nullable(),
  branch_ids: z.array(z.string()).optional(),
  role_ids: z.array(z.string()).optional(),
  vertical_ids: z.array(z.string()).optional(),
});

usersRouter.post('/invite', validateJson(inviteUserSchema), async (c) => {
  const scope = c.get('scope');
  const body = c.get('validatedJson' as any) as z.infer<typeof inviteUserSchema>;

  const tempPassword = body.password || `Welcome@${generateToken().slice(0, 8)}`;
  const passwordHash = await hashPassword(tempPassword);

  const allBranchIds = Array.from(new Set([
    ...(body.branch_ids || []),
    ...(body.branch_id ? [body.branch_id] : []),
  ])).filter(Boolean);

  const effectivePrimaryBranchId = body.branch_id || allBranchIds[0] || null;

  const result = await db.transaction(async (tx) => {
    const [newUser] = await tx
      .insert(users)
      .values({
        tenantId: scope.tenant_id,
        branchId: effectivePrimaryBranchId,
        name: body.name,
        email: body.email || null,
        phoneNumber: body.phone_number,
        passwordHash,
        status: 'active',
      })
      .returning();

    // Assign branches to userBranches
    if (allBranchIds.length > 0) {
      await tx.insert(userBranches).values(
        allBranchIds.map((bId) => ({
          userId: newUser!.id,
          branchId: bId,
          tenantId: scope.tenant_id,
        }))
      );
    }

    // Assign roles
    if (body.role_ids && body.role_ids.length > 0) {
      await tx.insert(userRoles).values(
        body.role_ids.map((rId) => ({
          userId: newUser!.id,
          roleId: rId,
          tenantId: scope.tenant_id,
        }))
      );
    }

    // Assign verticals
    if (body.vertical_ids && body.vertical_ids.length > 0) {
      await tx.insert(userVerticals).values(
        body.vertical_ids.map((vId) => ({
          userId: newUser!.id,
          verticalId: vId,
          tenantId: scope.tenant_id,
        }))
      );
    }

    return {
      ...newUser!,
      temporary_password: tempPassword,
    };
  });

  return c.json(result, 201);
});

usersRouter.patch('/:id', async (c) => {
  const scope = c.get('scope');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));

  const existing = await db.query.users.findFirst({
    where: and(eq(users.id, id), eq(users.tenantId, scope.tenant_id)),
  });

  if (!existing) {
    return c.json({ code: 'NOT_FOUND', message: 'User not found' }, 404);
  }

  const updated = await db.transaction(async (tx) => {
    const updateFields: Record<string, any> = {};
    if (body.name !== undefined) updateFields['name'] = body.name;
    if (body.phone_number !== undefined) updateFields['phoneNumber'] = body.phone_number;
    if (body.branch_id !== undefined) updateFields['branchId'] = body.branch_id;
    if (body.status !== undefined) updateFields['status'] = body.status;

    let userRow = existing;
    if (Object.keys(updateFields).length > 0) {
      const [u] = await tx.update(users).set(updateFields).where(eq(users.id, id)).returning();
      userRow = u!;
    }

    // Update branches if provided
    if (Array.isArray(body.branch_ids)) {
      await tx.delete(userBranches).where(eq(userBranches.userId, id));
      const bIds = body.branch_ids.filter(Boolean);
      if (bIds.length > 0) {
        await tx.insert(userBranches).values(
          bIds.map((bId: string) => ({
            userId: id,
            branchId: bId,
            tenantId: scope.tenant_id,
          }))
        );
        // Ensure primary branch is set to one of the assigned branches
        if (!body.branch_id) {
          await tx.update(users).set({ branchId: bIds[0] }).where(eq(users.id, id));
        }
      } else if (body.branch_id === undefined) {
        await tx.update(users).set({ branchId: null }).where(eq(users.id, id));
      }
    }

    // Update roles if provided
    if (Array.isArray(body.role_ids)) {
      await tx.delete(userRoles).where(eq(userRoles.userId, id));
      if (body.role_ids.length > 0) {
        await tx.insert(userRoles).values(
          body.role_ids.map((rId: string) => ({
            userId: id,
            roleId: rId,
            tenantId: scope.tenant_id,
          }))
        );
      }
    }

    // Update verticals if provided
    if (Array.isArray(body.vertical_ids)) {
      await tx.delete(userVerticals).where(eq(userVerticals.userId, id));
      if (body.vertical_ids.length > 0) {
        await tx.insert(userVerticals).values(
          body.vertical_ids.map((vId: string) => ({
            userId: id,
            verticalId: vId,
            tenantId: scope.tenant_id,
          }))
        );
      }
    }

    return userRow;
  });

  return c.json(updated);
});

usersRouter.delete('/:id', async (c) => {
  const scope = c.get('scope');
  const id = c.req.param('id');

  const [deactivated] = await db
    .update(users)
    .set({ status: 'inactive' })
    .where(and(eq(users.id, id), eq(users.tenantId, scope.tenant_id)))
    .returning();

  if (!deactivated) {
    return c.json({ code: 'NOT_FOUND', message: 'User not found' }, 404);
  }

  return c.json({ message: 'User deactivated successfully' });
});
