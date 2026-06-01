import { Injectable, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';
import { PlatformPrismaService } from '../tenant/platform-prisma.service';
import { PermissionCacheService } from '../permissions/permission-cache.service';
import * as bcrypt from 'bcrypt';

export interface InviteUserInput {
  name: string;
  email: string;
  role_ids: string[];
  assignment_ids?: string[];
}

export interface UpdateUserInput {
  name?: string;
  role_ids?: string[];
  assignment_ids?: string[];
}

const BCRYPT_COST = 12;

@Injectable()
export class UserService {
  constructor(
    private readonly tenantDb: TenantScopedPrismaService,
    private readonly platformDb: PlatformPrismaService,
    private readonly cache: PermissionCacheService,
  ) {}

  async getMaxUserLimit(tenantId: string): Promise<number> {
    const tenant = await this.platformDb.client.tenant.findUnique({
      where: { id: tenantId },
      include: { tenantPlans: { include: { plan: true } } },
    });

    if (!tenant) return 5;

    const config = (tenant.config_json ?? {}) as Record<string, any>;
    const customMaxUsers = config.custom_limits?.max_users;

    if (typeof customMaxUsers === 'number') {
      return customMaxUsers;
    }

    const activePlan = tenant.tenantPlans?.[0]?.plan;
    return activePlan?.max_users ?? 5;
  }

  async list(tenantId: string) {
    const users = await this.tenantDb.getClient().user.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: 'desc' },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    return users.map((user) => ({
      id: user.id,
      tenant_id: user.tenant_id,
      name: user.name,
      email: user.email,
      status: user.status,
      created_at: user.created_at,
      roles: user.userRoles.map((ur) => ({
        role_id: ur.role.id,
        role_name: ur.role.display_name || ur.role.name,
        assignment_id: ur.assignment_id ?? undefined,
      })),
    }));
  }

  async invite(tenantId: string, input: InviteUserInput) {
    // 1. Seat limit enforcement checks
    const maxUsers = await this.getMaxUserLimit(tenantId);
    const currentCount = await this.tenantDb.getClient().user.count({
      where: { tenant_id: tenantId },
    });

    if (currentCount >= maxUsers) {
      throw new ForbiddenException(
        `Seat limit reached. You are using ${currentCount} of ${maxUsers} seats. Contact admin to upgrade.`,
      );
    }

    // 2. Duplicate checking
    const existing = await this.tenantDb.getClient().user.findFirst({
      where: { email: input.email, tenant_id: tenantId },
    });

    if (existing) {
      throw new ConflictException('User with this email already exists in this workspace');
    }

    // Generate temporary password hash for new user
    const tempPassword = 'Temp' + Math.random().toString(36).slice(-8) + '!';
    const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_COST);

    return this.tenantDb.getClient().$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          tenant_id: tenantId,
          name: input.name,
          email: input.email,
          password_hash: passwordHash,
          status: 'active',
        },
      });

      // Resolve auto-assignment if single-entity workspace
      const assignmentsCount = await tx.branchBrandAssignment.count({
        where: { tenant_id: tenantId },
      });
      let resolvedAssignmentId = input.assignment_ids?.[0] ?? null;
      if (!resolvedAssignmentId && assignmentsCount === 1) {
        const singleAssignment = await tx.branchBrandAssignment.findFirst({
          where: { tenant_id: tenantId },
        });
        resolvedAssignmentId = singleAssignment?.id ?? null;
      }

      // Connect selected roles
      for (const roleId of input.role_ids) {
        await tx.userRole.create({
          data: {
            tenant_id: tenantId,
            user_id: user.id,
            role_id: roleId,
            assignment_id: resolvedAssignmentId,
          },
        });
      }

      const res = {
        id: user.id,
        tenant_id: user.tenant_id,
        name: user.name,
        email: user.email,
        status: user.status,
        created_at: user.created_at,
        temporary_password: tempPassword, // Included so details can be shown to inviter
      };
      await this.cache.invalidate(user.id, tenantId);
      return res;
    });
  }

  async update(tenantId: string, id: string, input: UpdateUserInput) {
    const user = await this.tenantDb.getClient().user.findFirst({
      where: { id, tenant_id: tenantId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.tenantDb.getClient().$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id },
        data: {
          name: input.name,
        },
      });

      if (input.role_ids) {
        // Resolve auto-assignment if single-entity workspace
        const assignmentsCount = await tx.branchBrandAssignment.count({
          where: { tenant_id: tenantId },
        });
        let resolvedAssignmentId = input.assignment_ids?.[0] ?? null;
        if (!resolvedAssignmentId && assignmentsCount === 1) {
          const singleAssignment = await tx.branchBrandAssignment.findFirst({
            where: { tenant_id: tenantId },
          });
          resolvedAssignmentId = singleAssignment?.id ?? null;
        }

        // Clear existing mappings
        await tx.userRole.deleteMany({
          where: { user_id: id, tenant_id: tenantId },
        });

        // Add updated mappings
        for (const roleId of input.role_ids) {
          await tx.userRole.create({
            data: {
              tenant_id: tenantId,
              user_id: id,
              role_id: roleId,
              assignment_id: resolvedAssignmentId,
            },
          });
        }
      }

      await this.cache.invalidate(id, tenantId);
      return updatedUser;
    });
  }

  async remove(tenantId: string, id: string) {
    const user = await this.tenantDb.getClient().user.findFirst({
      where: { id, tenant_id: tenantId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Guard to prevent self-deletion or deleting final owner/admin can be handled if needed, 
    // but basic delete covers dashboard settings triggers.
    return this.tenantDb.getClient().$transaction(async (tx) => {
      await tx.userRole.deleteMany({
        where: { user_id: id, tenant_id: tenantId },
      });

      await tx.user.delete({
        where: { id },
      });

      await this.cache.invalidate(id, tenantId);
      return { message: 'User removed successfully' };
    });
  }
}
