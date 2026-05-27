import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from './permissions.guard';
import { CheckPermissions } from './permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';
import { PermissionCacheService } from './permission-cache.service';
import type { RequestScope } from '../tenant/request-scope.interface';

class CreateRoleDto {
  @IsString()
  name!: string;

  @IsString()
  slug!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

class PermissionEntryDto {
  @IsString()
  resource!: string;

  @IsString()
  action!: string;

  @IsOptional()
  conditions?: Record<string, unknown>;
}

class UpdateRoleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionEntryDto)
  permissions?: PermissionEntryDto[];
}

@Controller('roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RoleController {
  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly cache: PermissionCacheService,
  ) {}

  @Get()
  @CheckPermissions('read', 'Role')
  async list(@CurrentUser() user: RequestScope) {
    const roles = await this.db.getClient().role.findMany({
      where: { tenant_id: user.tenant_id },
      include: {
        rolePermissions: true,
      },
      orderBy: { created_at: 'asc' },
    });

    return roles.map((r) => ({
      id: r.id,
      tenant_id: r.tenant_id,
      name: r.display_name || r.name, // Return display_name as name for seamless frontend integration
      slug: r.slug,
      description: r.description ?? undefined,
      is_system_role: r.is_system_role,
      created_at: r.created_at,
      permissions: r.rolePermissions.map((rp) => ({
        resource: rp.resource,
        action: rp.action,
        conditions: (rp.conditions as Record<string, unknown>) ?? undefined,
      })),
    }));
  }

  @Post()
  @CheckPermissions('manage', 'Role')
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser() user: RequestScope, @Body() body: CreateRoleDto) {
    // Check duplicate name
    const existing = await this.db.getClient().role.findFirst({
      where: {
        tenant_id: user.tenant_id,
        name: body.slug,
      },
    });

    if (existing) {
      throw new BadRequestException(`Role with slug '${body.slug}' already exists`);
    }

    const created = await this.db.getClient().role.create({
      data: {
        tenant_id: user.tenant_id,
        name: body.slug,
        slug: body.slug,
        display_name: body.name, // The 'name' from the form is the user-facing title
        description: body.description,
        is_system_role: false,
      },
    });

    return {
      id: created.id,
      tenant_id: created.tenant_id,
      name: created.display_name || created.name,
      slug: created.slug,
      description: created.description ?? undefined,
      is_system_role: created.is_system_role,
      created_at: created.created_at,
      permissions: [],
    };
  }

  @Patch(':id')
  @CheckPermissions('manage', 'Role')
  async update(
    @CurrentUser() user: RequestScope,
    @Param('id') id: string,
    @Body() body: UpdateRoleDto,
  ) {
    const role = await this.db.getClient().role.findFirst({
      where: { id, tenant_id: user.tenant_id },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return this.db.getClient().$transaction(async (tx) => {
      // 1. Update metadata
      const updated = await tx.role.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { display_name: body.name } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
        },
      });

      // 2. Update permissions if passed
      if (body.permissions !== undefined) {
        if (role.is_system_role) {
          throw new BadRequestException('System role permissions cannot be modified');
        }

        await tx.rolePermission.deleteMany({
          where: { role_id: id },
        });

        for (const perm of body.permissions) {
          await tx.rolePermission.create({
            data: {
              role_id: id,
              resource: perm.resource,
              action: perm.action,
              conditions: perm.conditions ? JSON.parse(JSON.stringify(perm.conditions)) : null,
            },
          });
        }
      }

      // 3. Evict cache for all tenant users to apply changes instantly
      const tenantUsers = await tx.user.findMany({
        where: { tenant_id: user.tenant_id },
        select: { id: true },
      });

      for (const u of tenantUsers) {
        await this.cache.invalidate(u.id, user.tenant_id);
      }

      return updated;
    });
  }

  @Delete(':id')
  @CheckPermissions('manage', 'Role')
  @HttpCode(HttpStatus.OK)
  async remove(@CurrentUser() user: RequestScope, @Param('id') id: string) {
    const role = await this.db.getClient().role.findFirst({
      where: { id, tenant_id: user.tenant_id },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (role.is_system_role) {
      throw new BadRequestException('System roles cannot be deleted');
    }

    return this.db.getClient().$transaction(async (tx) => {
      // Clear associated permissions first
      await tx.rolePermission.deleteMany({
        where: { role_id: id },
      });

      // Clear any user assignments
      await tx.userRole.deleteMany({
        where: { role_id: id, tenant_id: user.tenant_id },
      });

      await tx.role.delete({
        where: { id },
      });

      // Evict permissions cache for the tenant
      const tenantUsers = await tx.user.findMany({
        where: { tenant_id: user.tenant_id },
        select: { id: true },
      });

      for (const u of tenantUsers) {
        await this.cache.invalidate(u.id, user.tenant_id);
      }

      return { message: 'Role deleted successfully' };
    });
  }
}
