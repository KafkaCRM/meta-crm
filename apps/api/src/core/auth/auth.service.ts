import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';
import { createId } from '@paralleldrive/cuid2';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import type { TenantRole, PlatformRole } from '@meta-crm/types';
import { PrismaService } from './prisma.service';

const BCRYPT_COST = 12;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface LoginInput {
  email: string;
  password: string;
  tenant_slug?: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: TenantRole | PlatformRole;
    assignment_ids: string[];
  };
}

export interface RefreshResponse {
  access_token: string;
}

export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'TENANT_NOT_FOUND'
  | 'USER_NOT_IN_TENANT'
  | 'REFRESH_TOKEN_INVALID'
  | 'ACCOUNT_SUSPENDED'
  | 'INTERNAL_ERROR';

export interface AuthError {
  code: AuthErrorCode;
  message: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly db: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(input: LoginInput): Promise<Result<LoginResponse, AuthError>> {
    if (input.tenant_slug) {
      return this.loginTenantUser(input.email, input.password, input.tenant_slug);
    }

    // Try platform user first
    const platformUser = await this.db.platformUser.findUnique({
      where: { email: input.email },
    });
    if (platformUser) {
      return this.loginPlatformUser(input.email, input.password);
    }

    // Fallback: auto-resolve tenant workspace from email
    const tenantUser = await this.db.user.findFirst({
      where: { email: input.email },
      include: { tenant: true },
    });
    if (tenantUser) {
      return this.loginTenantUser(input.email, input.password, tenantUser.tenant.slug);
    }

    return err({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
  }

  private async loginTenantUser(
    email: string,
    password: string,
    tenantSlug: string,
  ): Promise<Result<LoginResponse, AuthError>> {
    const tenant = await this.db.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant not found' });
    }

    if (tenant.status === 'suspended') {
      return err({ code: 'ACCOUNT_SUSPENDED', message: 'Account is suspended' });
    }

    const user = await this.db.user.findUnique({
      where: { email_tenant_id: { email, tenant_id: tenant.id } },
      include: {
        userRoles: {
          include: { role: true },
        },
      },
    });

    if (!user) {
      return err({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
    }

    if (user.status !== 'active') {
      return err({ code: 'ACCOUNT_SUSPENDED', message: 'Account is suspended' });
    }

    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      return err({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
    }

    const roleSlug = (user.userRoles[0]?.role?.slug ?? '') as TenantRole;
    const assignmentIds: string[] = user.userRoles
      .map((r) => r.assignment_id)
      .filter((id): id is string => id !== null);

    const accessToken = this.jwtService.sign({
      sub: user.id,
      tenant_id: tenant.id,
      assignment_ids: assignmentIds,
      role: roleSlug,
    });

    const refreshTokenValue = await this.createRefreshToken(user.id, 'tenant');
    if (refreshTokenValue.isErr()) {
      return err(refreshTokenValue.error);
    }

    return ok({
      access_token: accessToken,
      refresh_token: refreshTokenValue.value,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: roleSlug,
        assignment_ids: assignmentIds,
      },
    });
  }

  private async loginPlatformUser(
    email: string,
    password: string,
  ): Promise<Result<LoginResponse, AuthError>> {
    const platformUser = await this.db.platformUser.findUnique({
      where: { email },
      include: { platformUserRoles: true },
    });

    if (!platformUser) {
      return err({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
    }

    if (platformUser.status !== 'active') {
      return err({ code: 'ACCOUNT_SUSPENDED', message: 'Account is suspended' });
    }

    const passwordValid = await bcrypt.compare(password, platformUser.password_hash);
    if (!passwordValid) {
      return err({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
    }

    const platformRole = (platformUser.platformUserRoles[0]?.role ?? '') as PlatformRole;

    const accessToken = this.jwtService.sign({
      sub: platformUser.id,
      tenant_id: '',
      assignment_ids: [],
      role: platformRole,
      platform_role: platformRole,
    });

    const refreshTokenValue = await this.createRefreshToken(platformUser.id, 'platform');
    if (refreshTokenValue.isErr()) {
      return err(refreshTokenValue.error);
    }

    return ok({
      access_token: accessToken,
      refresh_token: refreshTokenValue.value,
      user: {
        id: platformUser.id,
        name: platformUser.name,
        email: platformUser.email,
        role: platformRole,
        assignment_ids: [],
      },
    });
  }

  async refreshToken(refreshTokenValue: string): Promise<Result<RefreshResponse, AuthError>> {
    const tokenHash = hashToken(refreshTokenValue);
    const stored = await this.db.refreshToken.findFirst({
      where: { token_hash: tokenHash },
    });

    if (!stored) {
      return err({ code: 'REFRESH_TOKEN_INVALID', message: 'Refresh token not found' });
    }

    if (stored.revoked_at) {
      return err({ code: 'REFRESH_TOKEN_INVALID', message: 'Refresh token has been revoked' });
    }

    if (new Date() > stored.expires_at) {
      return err({ code: 'REFRESH_TOKEN_INVALID', message: 'Refresh token has expired' });
    }

    let payload: Record<string, unknown>;

    if (stored.user_type === 'tenant') {
      const user = await this.db.user.findUnique({
        where: { id: stored.user_id },
        include: {
          userRoles: {
            include: { role: true },
          },
        },
      });

      if (!user) {
        return err({ code: 'REFRESH_TOKEN_INVALID', message: 'User not found' });
      }

      const roleSlug = user.userRoles[0]?.role?.slug ?? '';
      const assignmentIds: string[] = user.userRoles
        .map((r) => r.assignment_id)
        .filter((id): id is string => id !== null);

      payload = {
        sub: user.id,
        tenant_id: user.tenant_id,
        assignment_ids: assignmentIds,
        role: roleSlug,
      };
    } else {
      const platformUser = await this.db.platformUser.findUnique({
        where: { id: stored.user_id },
        include: { platformUserRoles: true },
      });

      if (!platformUser) {
        return err({ code: 'REFRESH_TOKEN_INVALID', message: 'User not found' });
      }

      const platformRole = platformUser.platformUserRoles[0]?.role ?? '';

      payload = {
        sub: platformUser.id,
        tenant_id: '',
        assignment_ids: [],
        role: platformRole,
        platform_role: platformRole,
      };
    }

    const accessToken = this.jwtService.sign(payload);

    return ok({ access_token: accessToken });
  }

  async revokeToken(refreshTokenValue: string): Promise<Result<void, AuthError>> {
    const tokenHash = hashToken(refreshTokenValue);
    const stored = await this.db.refreshToken.findFirst({
      where: { token_hash: tokenHash },
    });

    if (!stored) {
      return ok(undefined);
    }

    await this.db.refreshToken.update({
      where: { id: stored.id },
      data: { revoked_at: new Date() },
    });

    return ok(undefined);
  }

  private async createRefreshToken(userId: string, userType: 'tenant' | 'platform'): Promise<Result<string, AuthError>> {
    try {
      const refreshTokenValue = createId();
      const tokenHash = hashToken(refreshTokenValue);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await this.db.refreshToken.create({
        data: {
          user_id: userId,
          user_type: userType,
          token_hash: tokenHash,
          expires_at: expiresAt,
        },
      });

      return ok(refreshTokenValue);
    } catch {
      return err({ code: 'INTERNAL_ERROR', message: 'Failed to create refresh token' });
    }
  }
}
