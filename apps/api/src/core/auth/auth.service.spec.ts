import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { AuthService, type LoginResponse } from './auth.service';
import type { PrismaService } from './prisma.service';

const { mockCompare } = vi.hoisted(() => {
  const _mockCompare = vi.fn();
  return { mockCompare: _mockCompare };
});

vi.mock('bcrypt', () => ({
  hash: vi.fn().mockResolvedValue('$2b$12$mockedhash'),
  compare: mockCompare,
  default: {
    hash: vi.fn().mockResolvedValue('$2b$12$mockedhash'),
    compare: mockCompare,
  },
}));

function createMockDb() {
  return {
    tenant: { findUnique: vi.fn() },
    user: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
    platformUser: { findUnique: vi.fn() },
    refreshToken: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    vertical: { findMany: vi.fn().mockResolvedValue([]) },
    userVertical: { findMany: vi.fn().mockResolvedValue([]) },
  } as unknown as PrismaService;
}

function createMockJwt() {
  const mock = new JwtService({ secret: 'test-secret' });
  vi.spyOn(mock, 'sign').mockReturnValue('mock-access-token');
  return mock;
}

const TENANT = {
  id: 'tenant-1',
  name: 'Test Tenant',
  slug: 'test-tenant',
  industry: 'education',
  config_json: {},
  schema_name: null,
  status: 'active',
  created_at: new Date('2025-01-01'),
};

const ROLE = {
  id: 'role-1',
  tenant_id: 'tenant-1',
  name: 'Branch User',
  slug: 'branch_user',
  description: null,
  is_system_role: true,
  created_at: new Date('2025-01-01'),
};

const USER = {
  id: 'user-1',
  tenant_id: 'tenant-1',
  name: 'John Doe',
  email: 'john@example.com',
  password_hash: '$2b$12$hash',
  status: 'active',
  created_at: new Date('2025-01-01'),
  tenant: TENANT,
  userRoles: [
    {
      id: 'ur-1',
      user_id: 'user-1',
      role_id: 'role-1',
      tenant_id: 'tenant-1',
      assignment_id: 'assignment-1',
      role: ROLE,
    },
  ],
};

const PLATFORM_USER = {
  id: 'puser-1',
  name: 'Admin User',
  email: 'admin@example.com',
  password_hash: '$2b$12$hash',
  status: 'active',
  created_at: new Date('2025-01-01'),
  platformUserRoles: [
    {
      id: 'pur-1',
      platform_user_id: 'puser-1',
      role: 'platform_admin',
    },
  ],
};

const REFRESH_TOKEN_ACTIVE = {
  id: 'rt-1',
  user_id: 'user-1',
  user_type: 'tenant',
  token_hash: 'hashed-token',
  expires_at: new Date(Date.now() + 86400000 * 7),
  revoked_at: null,
  created_at: new Date(),
};

describe('AuthService', () => {
  let db: PrismaService;
  let jwtService: JwtService;
  let authService: AuthService;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockCompare.mockReset();
    db = createMockDb();
    jwtService = createMockJwt();
    authService = new AuthService(db, jwtService);
  });

  describe('login (tenant user)', () => {
    it('returns access_token and refresh_token on success', async () => {
      mockCompare.mockResolvedValue(true);
      (db.tenant.findUnique as any).mockResolvedValue(TENANT);
      (db.user.findUnique as any).mockResolvedValue(USER);
      (db.user.findFirst as any).mockResolvedValue(USER);
      (db.refreshToken.create as any).mockResolvedValue({ id: 'rt-new' });

      const result = await authService.login({
        email: 'john@example.com',
        password: 'correct-password',
        tenant_slug: 'test-tenant',
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk() && !('multiple_workspaces' in result.value)) {
        const val = result.value as LoginResponse;
        expect(val.access_token).toBe('mock-access-token');
        expect(val.refresh_token).toBeTruthy();
        expect(val.user.name).toBe('John Doe');
        expect(val.user.role).toBe('branch_user');
        expect(val.user.assignment_ids).toEqual(['assignment-1']);
        expect((val.user as any).password_hash).toBeUndefined();
      }
    });

    it('returns TENANT_NOT_FOUND for unknown slug', async () => {
      (db.tenant.findUnique as any).mockResolvedValue(null);

      const result = await authService.login({
        email: 'john@example.com',
        password: 'password',
        tenant_slug: 'unknown',
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('TENANT_NOT_FOUND');
      }
    });

    it('returns INVALID_CREDENTIALS for wrong password', async () => {
      mockCompare.mockResolvedValue(false);
      (db.tenant.findUnique as any).mockResolvedValue(TENANT);
      (db.user.findUnique as any).mockResolvedValue(USER);
      (db.user.findFirst as any).mockResolvedValue(USER);

      const result = await authService.login({
        email: 'john@example.com',
        password: 'wrong-password',
        tenant_slug: 'test-tenant',
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('INVALID_CREDENTIALS');
      }
    });

    it('returns ACCOUNT_SUSPENDED when tenant is suspended', async () => {
      (db.tenant.findUnique as any).mockResolvedValue({
        ...TENANT,
        status: 'suspended',
      });

      const result = await authService.login({
        email: 'john@example.com',
        password: 'password',
        tenant_slug: 'test-tenant',
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('ACCOUNT_SUSPENDED');
      }
    });
  });

  describe('login (platform user)', () => {
    it('returns JWT with platform_role and no tenant_id', async () => {
      mockCompare.mockResolvedValue(true);
      (db.platformUser.findUnique as any).mockResolvedValue(PLATFORM_USER);
      (db.refreshToken.create as any).mockResolvedValue({ id: 'rt-new' });

      const result = await authService.login({
        email: 'admin@example.com',
        password: 'admin-password',
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk() && !('multiple_workspaces' in result.value)) {
        const val = result.value as LoginResponse;
        expect(val.user.role).toBe('platform_admin');
        expect(val.user.assignment_ids).toEqual([]);
        expect((val.user as any).password_hash).toBeUndefined();
      }
    });
  });

  describe('login (no tenant slug provided)', () => {
    it('successfully logs in a tenant user by auto-resolving the slug from email', async () => {
      mockCompare.mockResolvedValue(true);
      (db.platformUser.findUnique as any).mockResolvedValue(null);
      (db.user.findMany as any).mockResolvedValue([USER]);
      (db.user.findFirst as any).mockResolvedValue(USER);
      (db.tenant.findUnique as any).mockResolvedValue(TENANT);
      (db.user.findUnique as any).mockResolvedValue(USER);
      (db.refreshToken.create as any).mockResolvedValue({ id: 'rt-new' });

      const result = await authService.login({
        email: 'john@example.com',
        password: 'correct-password',
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk() && !('multiple_workspaces' in result.value)) {
        const val = result.value as LoginResponse;
        expect(val.access_token).toBe('mock-access-token');
        expect(val.user.name).toBe('John Doe');
      }
    });

    it('returns INVALID_CREDENTIALS if user is not found in either table', async () => {
      (db.platformUser.findUnique as any).mockResolvedValue(null);
      (db.user.findMany as any).mockResolvedValue([]);

      const result = await authService.login({
        email: 'unknown@example.com',
        password: 'password',
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('INVALID_CREDENTIALS');
      }
    });
  });

  describe('refreshToken', () => {
    it('returns new access_token for valid token', async () => {
      (db.refreshToken.findFirst as any).mockResolvedValue(REFRESH_TOKEN_ACTIVE);
      (db.user.findUnique as any).mockResolvedValue(USER);

      const result = await authService.refreshToken('valid-refresh-token');

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.access_token).toBe('mock-access-token');
      }
    });

    it('returns REFRESH_TOKEN_INVALID for revoked token', async () => {
      (db.refreshToken.findFirst as any).mockResolvedValue({
        ...REFRESH_TOKEN_ACTIVE,
        revoked_at: new Date(),
      });

      const result = await authService.refreshToken('revoked-token');

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('REFRESH_TOKEN_INVALID');
      }
    });

    it('returns REFRESH_TOKEN_INVALID for expired token', async () => {
      (db.refreshToken.findFirst as any).mockResolvedValue({
        ...REFRESH_TOKEN_ACTIVE,
        expires_at: new Date(Date.now() - 86400000),
      });

      const result = await authService.refreshToken('expired-token');

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('REFRESH_TOKEN_INVALID');
      }
    });
  });

  describe('revokeToken', () => {
    it('revokes the refresh token on logout', async () => {
      (db.refreshToken.findFirst as any).mockResolvedValue(REFRESH_TOKEN_ACTIVE);
      (db.refreshToken.update as any).mockResolvedValue({
        ...REFRESH_TOKEN_ACTIVE,
        revoked_at: new Date(),
      });

      const result = await authService.revokeToken('token-to-revoke');

      expect(result.isOk()).toBe(true);
      expect(db.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rt-1' },
          data: expect.objectContaining({ revoked_at: expect.any(Date) }),
        }),
      );
    });

    it('succeeds even if refresh token not found', async () => {
      (db.refreshToken.findFirst as any).mockResolvedValue(null);

      const result = await authService.revokeToken('unknown-token');

      expect(result.isOk()).toBe(true);
    });
  });
});
