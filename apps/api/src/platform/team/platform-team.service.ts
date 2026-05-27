import { Injectable, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { PlatformPrismaService } from '../../core/tenant/platform-prisma.service';
import { PlatformAuditService } from '../audit/platform-audit.service';
import type { RequestScope } from '../../core/tenant/request-scope.interface';
import type { PlatformRole } from '@meta-crm/types';

const BCRYPT_COST = 12;

const ROLE_HIERARCHY: Record<string, number> = {
  platform_owner: 100,
  platform_admin: 80,
  platform_sales: 50,
  platform_billing: 50,
  platform_support: 50,
  platform_developer: 50,
  platform_ops: 50,
};

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export type PlatformTeamErrorCode =
  | 'USER_NOT_FOUND'
  | 'EMAIL_TAKEN'
  | 'ROLE_ESCALATION'
  | 'TRANSACTION_FAILED';

export interface PlatformTeamError {
  code: PlatformTeamErrorCode;
  message: string;
}

export interface InviteInput {
  name: string;
  email: string;
  role: PlatformRole;
}

export interface InviteResponse {
  id: string;
  email: string;
  temporary_password: string;
  role: string;
}

@Injectable()
export class PlatformTeamService {
  constructor(
    private readonly db: PlatformPrismaService,
    private readonly audit: PlatformAuditService,
  ) {}

  private checkRoleEscalation(inviterRole: string, targetRole: string): boolean {
    const inviterLevel = ROLE_HIERARCHY[inviterRole] ?? 0;
    const targetLevel = ROLE_HIERARCHY[targetRole] ?? 0;
    return inviterLevel >= targetLevel;
  }

  async list(): Promise<Result<any[], PlatformTeamError>> {
    const users = await this.db.client.platformUser.findMany({
      include: {
        platformUserRoles: { select: { role: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    const data = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.platformUserRoles[0]?.role ?? null,
      status: u.status,
      created_at: u.created_at,
    }));

    return ok(data);
  }

  async invite(
    input: InviteInput,
    inviter: RequestScope,
    auditMeta?: { actor_id: string; actor_role: string; actor_ip: string; user_agent: string; reason?: string },
  ): Promise<Result<InviteResponse, PlatformTeamError>> {
    if (!this.checkRoleEscalation(inviter.platform_role ?? '', input.role)) {
      return err({
        code: 'ROLE_ESCALATION',
        message: `Cannot invite a user with role ${input.role} from role ${inviter.platform_role}`,
      });
    }

    const existing = await this.db.client.platformUser.findUnique({
      where: { email: input.email },
    });
    if (existing) {
      return err({ code: 'EMAIL_TAKEN', message: 'Email already in use' });
    }

    const temporaryPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_COST);

    try {
      const user = await this.db.client.platformUser.create({
        data: {
          name: input.name,
          email: input.email,
          password_hash: passwordHash,
          platformUserRoles: {
            create: { role: input.role },
          },
        },
      });

      if (auditMeta) {
        await this.audit.writeLog({
          actor_id: auditMeta.actor_id,
          actor_role: auditMeta.actor_role,
          action: 'team:invite',
          target_id: user.id,
          actor_ip: auditMeta.actor_ip,
          user_agent: auditMeta.user_agent,
          details: { invited_user_id: user.id, email: user.email, role: input.role },
          reason: auditMeta.reason,
        });
      }

      return ok({
        id: user.id,
        email: user.email,
        temporary_password: temporaryPassword,
        role: input.role,
      });
    } catch (e: any) {
      return err({ code: 'TRANSACTION_FAILED', message: e?.message ?? 'Failed to invite user' });
    }
  }

  async changeRole(
    userId: string,
    newRole: PlatformRole,
    actor: RequestScope,
    auditMeta?: { actor_id: string; actor_role: string; actor_ip: string; user_agent: string; reason?: string },
  ): Promise<Result<void, PlatformTeamError>> {
    if (actor.platform_role !== 'platform_owner') {
      return err({
        code: 'ROLE_ESCALATION',
        message: 'Only platform_owner can change roles',
      });
    }

    const existing = await this.db.client.platformUser.findUnique({
      where: { id: userId },
    });
    if (!existing) {
      return err({ code: 'USER_NOT_FOUND', message: 'Platform user not found' });
    }

    await this.db.client.platformUserRole.updateMany({
      where: { platform_user_id: userId },
      data: { role: newRole },
    });

    if (auditMeta) {
      await this.audit.writeLog({
        actor_id: auditMeta.actor_id,
        actor_role: auditMeta.actor_role,
        action: 'team:change_role',
        target_id: userId,
        actor_ip: auditMeta.actor_ip,
        user_agent: auditMeta.user_agent,
        details: { user_id: userId, email: existing.email, new_role: newRole },
        reason: auditMeta.reason,
      });
    }

    return ok(undefined);
  }

  async deactivate(
    userId: string,
    auditMeta?: { actor_id: string; actor_role: string; actor_ip: string; user_agent: string; reason?: string },
  ): Promise<Result<void, PlatformTeamError>> {
    const existing = await this.db.client.platformUser.findUnique({
      where: { id: userId },
    });
    if (!existing) {
      return err({ code: 'USER_NOT_FOUND', message: 'Platform user not found' });
    }

    await this.db.client.platformUser.update({
      where: { id: userId },
      data: { status: 'inactive' },
    });

    if (auditMeta) {
      await this.audit.writeLog({
        actor_id: auditMeta.actor_id,
        actor_role: auditMeta.actor_role,
        action: 'team:deactivate',
        target_id: userId,
        actor_ip: auditMeta.actor_ip,
        user_agent: auditMeta.user_agent,
        details: { user_id: userId, email: existing.email },
        reason: auditMeta.reason,
      });
    }

    return ok(undefined);
  }
}
