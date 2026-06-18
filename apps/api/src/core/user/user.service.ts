import { Injectable, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';
import { PlatformPrismaService } from '../tenant/platform-prisma.service';
import { PermissionCacheService } from '../permissions/permission-cache.service';
import * as bcrypt from 'bcrypt';

export interface InviteUserInput {
  name: string;
  email?: string;
  phone_number: string;
  password?: string;
  role_ids: string[];
  assignment_ids?: string[];
  vertical_ids?: string[];
}

export interface UpdateUserInput {
  name?: string;
  phone_number?: string;
  role_ids?: string[];
  assignment_ids?: string[];
  vertical_ids?: string[];
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
      phone_number: user.phone_number ?? undefined,
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

    // 2. Duplicate checking (Check email if provided, and check phone number)
    const existing = await this.tenantDb.getClient().user.findFirst({
      where: {
        tenant_id: tenantId,
        OR: [
          ...(input.email ? [{ email: input.email }] : []),
          { phone_number: input.phone_number },
        ],
      },
    });

    if (existing) {
      throw new ConflictException('User with this email or phone number already exists in this workspace');
    }

    // Generate temporary password hash for new user
    const tempPassword = input.password || ('Temp' + Math.random().toString(36).slice(-8) + '!');
    const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_COST);

    return this.tenantDb.getClient().$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          tenant_id: tenantId,
          name: input.name,
          email: input.email ?? null,
          phone_number: input.phone_number,
          password_hash: passwordHash,
          status: 'active',
        },
      });

      const assignedIds = input.assignment_ids && input.assignment_ids.length > 0
        ? input.assignment_ids
        : [null];

      // Connect selected roles to each assignment
      for (const roleId of input.role_ids) {
        for (const asgId of assignedIds) {
          await tx.userRole.create({
            data: {
              tenant_id: tenantId,
              user_id: user.id,
              role_id: roleId,
              assignment_id: asgId,
            },
          });
        }
      }

      // Connect selected verticals
      if (input.vertical_ids) {
        for (const vertId of input.vertical_ids) {
          await tx.userVertical.create({
            data: {
              tenant_id: tenantId,
              user_id: user.id,
              vertical_id: vertId,
            },
          });
        }
      }

      const res = {
        id: user.id,
        tenant_id: user.tenant_id,
        name: user.name,
        email: user.email,
        phone_number: user.phone_number ?? undefined,
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
          phone_number: input.phone_number,
        },
      });

      // Handle roles and assignments updates
      if (input.role_ids || input.assignment_ids) {
        let roleIdsToUse = input.role_ids;
        if (!roleIdsToUse) {
          const currentRoles = await tx.userRole.findMany({
            where: { user_id: id, tenant_id: tenantId },
            select: { role_id: true },
          });
          roleIdsToUse = Array.from(new Set(currentRoles.map((r) => r.role_id)));
        }

        const assignedIds = input.assignment_ids && input.assignment_ids.length > 0
          ? input.assignment_ids
          : [null];

        // Clear existing role mappings
        await tx.userRole.deleteMany({
          where: { user_id: id, tenant_id: tenantId },
        });

        // Add updated mappings
        for (const roleId of roleIdsToUse) {
          for (const asgId of assignedIds) {
            await tx.userRole.create({
              data: {
                tenant_id: tenantId,
                user_id: id,
                role_id: roleId,
                assignment_id: asgId,
              },
            });
          }
        }
      }

      // Handle verticals updates
      if (input.vertical_ids) {
        // Clear existing mappings
        await tx.userVertical.deleteMany({
          where: { user_id: id, tenant_id: tenantId },
        });

        // Add updated mappings
        for (const vertId of input.vertical_ids) {
          await tx.userVertical.create({
            data: {
              tenant_id: tenantId,
              user_id: id,
              vertical_id: vertId,
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
