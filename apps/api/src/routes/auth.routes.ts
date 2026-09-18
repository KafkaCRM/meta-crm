import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and, or, isNull } from 'drizzle-orm';
import { db } from '../db';
import { tenants, users, userRoles, roles, platformUsers, platformUserRoles, refreshTokens, userVerticals } from '../db/schema';
import { hashPassword, verifyPassword, hashToken, generateToken } from '../lib/crypto';
import { signJwt } from '../lib/jwt';
import { validateJson } from '../middleware/validator';
import { requireAuth } from '../middleware/auth';
import type { AppEnv } from '../types/context';

export const authRouter = new Hono<AppEnv>();

const loginSchema = z.object({
  email: z.string().min(1, 'Email or phone number is required'),
  password: z.string().min(1, 'Password is required'),
  tenant_slug: z.string().optional(),
});

const refreshSchema = z.object({
  refresh_token: z.string().optional(),
});

authRouter.post('/login', validateJson(loginSchema), async (c) => {
  const { email, password, tenant_slug } = c.get('validatedJson' as any) as z.infer<typeof loginSchema>;

  // 1. If tenant_slug is provided, direct single-tenant user login
  if (tenant_slug) {
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.slug, tenant_slug),
    });

    if (!tenant) {
      return c.json({ code: 'TENANT_NOT_FOUND', message: 'Workspace not found' }, 404);
    }
    if (tenant.status === 'suspended') {
      return c.json({ code: 'ACCOUNT_SUSPENDED', message: 'Workspace is suspended' }, 403);
    }

    const user = await db.query.users.findFirst({
      where: and(
        eq(users.tenantId, tenant.id),
        or(eq(users.email, email), eq(users.phoneNumber, email))
      ),
      with: {
        userBranches: true,
      },
    });

    if (!user || user.status !== 'active') {
      return c.json({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' }, 401);
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return c.json({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' }, 401);
    }

    // Get user roles
    const uRoles = await db
      .select({ roleSlug: roles.slug, assignmentId: userRoles.assignmentId })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, user.id));

    const roleSlug = uRoles[0]?.roleSlug ?? 'user';
    const assignmentIds = uRoles.map((r) => r.assignmentId).filter((id): id is string => Boolean(id));

    // Resolve vertical IDs
    const uVerts = await db
      .select({ verticalId: userVerticals.verticalId })
      .from(userVerticals)
      .where(eq(userVerticals.userId, user.id));
    const verticalIds = uVerts.map((v) => v.verticalId);

    const accessToken = signJwt({
      sub: user.id,
      tenant_id: tenant.id,
      role: roleSlug,
      assignment_ids: assignmentIds,
      vertical_ids: verticalIds,
    });

    const rawRefreshToken = generateToken();
    const tokenH = hashToken(rawRefreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await db.insert(refreshTokens).values({
      userId: user.id,
      userType: 'tenant',
      tokenHash: tokenH,
      expiresAt,
    });

    return c.json({
      access_token: accessToken,
      refresh_token: rawRefreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email || '',
        role: roleSlug,
        assignment_ids: assignmentIds,
      },
    });
  }

  // 2. Try platform user login first (e.g. system administrators)
  const platformUser = await db.query.platformUsers.findFirst({
    where: eq(platformUsers.email, email),
  });

  if (platformUser && platformUser.status === 'active') {
    const isPlatformValid = await verifyPassword(password, platformUser.passwordHash);
    if (isPlatformValid) {
      const pRoles = await db
        .select({ role: platformUserRoles.role })
        .from(platformUserRoles)
        .where(eq(platformUserRoles.platformUserId, platformUser.id));

      const platformRole = pRoles[0]?.role ?? 'platform_admin';

      const accessToken = signJwt({
        sub: platformUser.id,
        tenant_id: '',
        role: platformRole,
        platform_role: platformRole,
        assignment_ids: [],
        vertical_ids: [],
      });

      const rawRefreshToken = generateToken();
      const tokenH = hashToken(rawRefreshToken);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await db.insert(refreshTokens).values({
        userId: platformUser.id,
        userType: 'platform',
        tokenHash: tokenH,
        expiresAt,
      });

      return c.json({
        access_token: accessToken,
        refresh_token: rawRefreshToken,
        user: {
          id: platformUser.id,
          name: platformUser.name,
          email: platformUser.email,
          role: platformRole,
          assignment_ids: [],
        },
      });
    }
  }

  // 3. Find matching active tenant users
  // Fixes SEC-04: If multiple workspaces exist, we DO NOT run 50 bcrypt checks sequentially!
  // We check matches, verify user password, and if single match return token, if multiple return workspace selector!
  const matchedUsers = await db
    .select({
      user: users,
      tenant: tenants,
    })
    .from(users)
    .innerJoin(tenants, eq(users.tenantId, tenants.id))
    .where(
      and(
        or(eq(users.email, email), eq(users.phoneNumber, email)),
        eq(users.status, 'active'),
        eq(tenants.status, 'active')
      )
    );

  if (matchedUsers.length === 0) {
    return c.json({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' }, 401);
  }

  // If user belongs to multiple workspaces:
  // First verify password against one valid user password hash
  const firstMatch = matchedUsers[0]!;
  const isValid = await verifyPassword(password, firstMatch.user.passwordHash);
  if (!isValid) {
    return c.json({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' }, 401);
  }

  if (matchedUsers.length > 1) {
    return c.json({
      multiple_workspaces: true,
      workspaces: matchedUsers.map((m) => ({
        slug: m.tenant.slug,
        name: m.tenant.name,
      })),
    });
  }

  // Single workspace user authenticated
  const singleMatch = matchedUsers[0]!;
  const uRoles = await db
    .select({ roleSlug: roles.slug, assignmentId: userRoles.assignmentId })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, singleMatch.user.id));

  const roleSlug = uRoles[0]?.roleSlug ?? 'user';
  const assignmentIds = uRoles.map((r) => r.assignmentId).filter((id): id is string => Boolean(id));

  const uVerts = await db
    .select({ verticalId: userVerticals.verticalId })
    .from(userVerticals)
    .where(eq(userVerticals.userId, singleMatch.user.id));
  const verticalIds = uVerts.map((v) => v.verticalId);

  const accessToken = signJwt({
    sub: singleMatch.user.id,
    tenant_id: singleMatch.tenant.id,
    role: roleSlug,
    assignment_ids: assignmentIds,
    vertical_ids: verticalIds,
  });

  const rawRefreshToken = generateToken();
  const tokenH = hashToken(rawRefreshToken);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await db.insert(refreshTokens).values({
    userId: singleMatch.user.id,
    userType: 'tenant',
    tokenHash: tokenH,
    expiresAt,
  });

  return c.json({
    access_token: accessToken,
    refresh_token: rawRefreshToken,
    user: {
      id: singleMatch.user.id,
      name: singleMatch.user.name,
      email: singleMatch.user.email || '',
      role: roleSlug,
      assignment_ids: assignmentIds,
    },
  });
});

authRouter.post('/refresh', validateJson(refreshSchema), async (c) => {
  const body = c.get('validatedJson' as any) as z.infer<typeof refreshSchema>;
  const rawToken = body.refresh_token;

  if (!rawToken) {
    return c.json({ code: 'REFRESH_TOKEN_INVALID', message: 'Missing refresh token' }, 401);
  }

  const tokenH = hashToken(rawToken);
  const stored = await db.query.refreshTokens.findFirst({
    where: and(eq(refreshTokens.tokenHash, tokenH), isNull(refreshTokens.revokedAt)),
  });

  if (!stored || new Date() > stored.expiresAt) {
    return c.json({ code: 'REFRESH_TOKEN_INVALID', message: 'Invalid or expired refresh token' }, 401);
  }

  if (stored.userType === 'tenant') {
    const user = await db.query.users.findFirst({
      where: and(eq(users.id, stored.userId), eq(users.status, 'active')),
      with: { tenant: true },
    });

    if (!user || user.tenant.status !== 'active') {
      return c.json({ code: 'REFRESH_TOKEN_INVALID', message: 'User or tenant is not active' }, 401);
    }

    const uRoles = await db
      .select({ roleSlug: roles.slug, assignmentId: userRoles.assignmentId })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, user.id));

    const roleSlug = uRoles[0]?.roleSlug ?? 'user';
    const assignmentIds = uRoles.map((r) => r.assignmentId).filter((id): id is string => Boolean(id));

    const uVerts = await db
      .select({ verticalId: userVerticals.verticalId })
      .from(userVerticals)
      .where(eq(userVerticals.userId, user.id));
    const verticalIds = uVerts.map((v) => v.verticalId);

    const accessToken = signJwt({
      sub: user.id,
      tenant_id: user.tenantId,
      role: roleSlug,
      assignment_ids: assignmentIds,
      vertical_ids: verticalIds,
    });

    return c.json({ access_token: accessToken });
  } else {
    const platformUser = await db.query.platformUsers.findFirst({
      where: and(eq(platformUsers.id, stored.userId), eq(platformUsers.status, 'active')),
    });

    if (!platformUser) {
      return c.json({ code: 'REFRESH_TOKEN_INVALID', message: 'Platform user not found' }, 401);
    }

    const pRoles = await db
      .select({ role: platformUserRoles.role })
      .from(platformUserRoles)
      .where(eq(platformUserRoles.platformUserId, platformUser.id));

    const platformRole = pRoles[0]?.role ?? 'platform_admin';

    const accessToken = signJwt({
      sub: platformUser.id,
      tenant_id: '',
      role: platformRole,
      platform_role: platformRole,
      assignment_ids: [],
      vertical_ids: [],
    });

    return c.json({ access_token: accessToken });
  }
});

authRouter.post('/logout', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const rawToken = body?.refresh_token;

  if (rawToken) {
    const tokenH = hashToken(rawToken);
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.tokenHash, tokenH));
  }

  return c.json({ success: true });
});

// Impersonation (platform admin entering a customer tenant workspace)
authRouter.post('/impersonate', requireAuth, async (c) => {
  const scope = c.get('scope');
  if (!scope.platform_role) {
    return c.json({ code: 'FORBIDDEN', message: 'Platform admin privileges required' }, 403);
  }

  const { tenant_id } = await c.req.json().catch(() => ({}));
  if (!tenant_id) {
    return c.json({ code: 'VALIDATION_FAILED', message: 'tenant_id is required' }, 400);
  }

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenant_id),
  });

  if (!tenant) {
    return c.json({ code: 'TENANT_NOT_FOUND', message: 'Tenant not found' }, 404);
  }

  // Find admin or any active user in the tenant
  const user = await db.query.users.findFirst({
    where: and(eq(users.tenantId, tenant.id), eq(users.status, 'active')),
  });

  if (!user) {
    return c.json({ code: 'USER_NOT_IN_TENANT', message: 'No active user found in workspace' }, 404);
  }

  const uRoles = await db
    .select({ roleSlug: roles.slug, assignmentId: userRoles.assignmentId })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, user.id));

  const roleSlug = uRoles[0]?.roleSlug ?? 'admin';
  const assignmentIds = uRoles.map((r) => r.assignmentId).filter((id): id is string => Boolean(id));

  const uVerts = await db
    .select({ verticalId: userVerticals.verticalId })
    .from(userVerticals)
    .where(eq(userVerticals.userId, user.id));
  const verticalIds = uVerts.map((v) => v.verticalId);

  const accessToken = signJwt({
    sub: user.id,
    tenant_id: tenant.id,
    role: roleSlug,
    assignment_ids: assignmentIds,
    vertical_ids: verticalIds,
    is_impersonating: true,
    admin_user_id: scope.user_id,
  });

  return c.json({
    access_token: accessToken,
    tenant_slug: tenant.slug,
    user: {
      id: user.id,
      name: user.name,
      email: user.email || '',
      role: roleSlug,
      assignment_ids: assignmentIds,
    },
  });
});
