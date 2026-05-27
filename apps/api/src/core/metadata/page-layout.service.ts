import { Injectable, NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';
import type { RequestScope } from '../tenant/request-scope.interface';
import { SetupAuditTrailService } from './setup-audit.service';

export type LayoutErrorCode = 'NOT_FOUND';

export interface LayoutError {
  code: LayoutErrorCode;
  message?: string;
}

@Injectable()
export class PageLayoutService {
  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly cls: ClsService,
    private readonly audit: SetupAuditTrailService,
  ) {}

  async findByObject(objectType: string): Promise<Result<any[], LayoutError>> {
    const scope = this.cls.get<RequestScope>('scope')!;
    const layouts = await this.db.getClient().pageLayout.findMany({
      where: { tenant_id: scope.tenant_id, object_type: objectType },
      orderBy: { created_at: 'desc' },
    });
    return ok(layouts);
  }

  async findDefault(objectType: string): Promise<Result<any, LayoutError>> {
    const scope = this.cls.get<RequestScope>('scope')!;
    const layout = await this.db.getClient().pageLayout.findFirst({
      where: { tenant_id: scope.tenant_id, object_type: objectType, is_default: true },
    });
    if (!layout) {
      return err({ code: 'NOT_FOUND', message: `No default layout for object type ${objectType}` });
    }
    return ok(layout);
  }

  async create(dto: {
    object_type: string;
    name: string;
    layout_json: any;
    is_default?: boolean;
  }): Promise<Result<any, LayoutError>> {
    const scope = this.cls.get<RequestScope>('scope')!;
    
    // If setting as default, unset other layouts as default first
    if (dto.is_default) {
      await this.db.getClient().pageLayout.updateMany({
        where: { tenant_id: scope.tenant_id, object_type: dto.object_type },
        data: { is_default: false },
      });
    }

    const layout = await this.db.getClient().pageLayout.create({
      data: {
        object_type: dto.object_type,
        name: dto.name,
        layout_json: dto.layout_json,
        is_default: dto.is_default ?? true,
        tenant: { connect: { id: scope.tenant_id } },
      },
    });

    await this.audit.log(
      `Created Page Layout '${layout.name}' for object type ${layout.object_type}`,
      'Layout Designer',
      { name: layout.name, object_type: layout.object_type }
    );

    return ok(layout);
  }

  async update(
    id: string,
    dto: {
      name?: string;
      layout_json?: any;
      is_default?: boolean;
    },
  ): Promise<Result<any, LayoutError>> {
    const existing = await this.db.getClient().pageLayout.findUnique({ where: { id } });
    if (!existing) {
      return err({ code: 'NOT_FOUND', message: 'Page layout not found' });
    }

    if (dto.is_default && !existing.is_default) {
      await this.db.getClient().pageLayout.updateMany({
        where: { tenant_id: existing.tenant_id, object_type: existing.object_type },
        data: { is_default: false },
      });
    }

    const updated = await this.db.getClient().pageLayout.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.layout_json !== undefined ? { layout_json: dto.layout_json } : {}),
        ...(dto.is_default !== undefined ? { is_default: dto.is_default } : {}),
      },
    });

    await this.audit.log(
      `Updated Page Layout '${updated.name}' for object type ${updated.object_type}`,
      'Layout Designer',
      { name: updated.name, object_type: updated.object_type }
    );

    return ok(updated);
  }

  async remove(id: string): Promise<Result<void, LayoutError>> {
    const existing = await this.db.getClient().pageLayout.findUnique({ where: { id } });
    if (!existing) {
      return err({ code: 'NOT_FOUND', message: 'Page layout not found' });
    }

    await this.db.getClient().pageLayout.delete({ where: { id } });

    await this.audit.log(
      `Deleted Page Layout '${existing.name}' for object type ${existing.object_type}`,
      'Layout Designer',
      { name: existing.name, object_type: existing.object_type }
    );

    return ok(undefined);
  }
}
