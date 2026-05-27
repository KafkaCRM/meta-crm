import { Injectable, NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';
import type { RequestScope } from '../tenant/request-scope.interface';
import { SetupAuditTrailService } from './setup-audit.service';

export type CustomObjectErrorCode = 'NOT_FOUND' | 'DUPLICATE_NAME';

export interface CustomObjectError {
  code: CustomObjectErrorCode;
  message?: string;
}

@Injectable()
export class CustomObjectDefinitionService {
  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly cls: ClsService,
    private readonly audit: SetupAuditTrailService,
  ) {}

  async list(): Promise<Result<any[], CustomObjectError>> {
    const scope = this.cls.get<RequestScope>('scope')!;
    const objects = await this.db.getClient().customObjectDefinition.findMany({
      where: { tenant_id: scope.tenant_id },
      orderBy: { created_at: 'desc' },
    });
    return ok(objects);
  }

  async findOne(id: string): Promise<Result<any, CustomObjectError>> {
    const object = await this.db.getClient().customObjectDefinition.findUnique({
      where: { id },
      include: { fields: true },
    });
    if (!object) {
      return err({ code: 'NOT_FOUND', message: 'Custom object definition not found' });
    }
    return ok(object);
  }

  async create(dto: {
    api_name: string;
    singular_label: string;
    plural_label: string;
    description?: string;
  }): Promise<Result<any, CustomObjectError>> {
    const scope = this.cls.get<RequestScope>('scope')!;

    // Check for duplicate api_name
    const existing = await this.db.getClient().customObjectDefinition.findFirst({
      where: { tenant_id: scope.tenant_id, api_name: dto.api_name },
    });

    if (existing) {
      return err({
        code: 'DUPLICATE_NAME',
        message: `Custom object with name '${dto.api_name}' already exists`,
      });
    }

    const object = await this.db.getClient().customObjectDefinition.create({
      data: {
        api_name: dto.api_name,
        singular_label: dto.singular_label,
        plural_label: dto.plural_label,
        description: dto.description,
        tenant: { connect: { id: scope.tenant_id } },
      },
    });

    await this.audit.log(
      `Created Custom Object '${object.singular_label}' (${object.api_name})`,
      'Object Manager',
      { api_name: object.api_name, label: object.singular_label }
    );

    return ok(object);
  }

  async update(
    id: string,
    dto: {
      singular_label?: string;
      plural_label?: string;
      description?: string;
    },
  ): Promise<Result<any, CustomObjectError>> {
    const existing = await this.db.getClient().customObjectDefinition.findUnique({
      where: { id },
    });

    if (!existing) {
      return err({ code: 'NOT_FOUND', message: 'Custom object definition not found' });
    }

    const updated = await this.db.getClient().customObjectDefinition.update({
      where: { id },
      data: {
        ...(dto.singular_label !== undefined ? { singular_label: dto.singular_label } : {}),
        ...(dto.plural_label !== undefined ? { plural_label: dto.plural_label } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
      },
    });

    return ok(updated);
  }

  async remove(id: string): Promise<Result<void, CustomObjectError>> {
    const existing = await this.db.getClient().customObjectDefinition.findUnique({
      where: { id },
    });

    if (!existing) {
      return err({ code: 'NOT_FOUND', message: 'Custom object definition not found' });
    }

    // Delete all child field definitions first
    await this.db.getClient().fieldDefinition.deleteMany({
      where: { custom_obj_id: id },
    });

    await this.db.getClient().customObjectDefinition.delete({
      where: { id },
    });

    await this.audit.log(
      `Deleted Custom Object '${existing.singular_label}' (${existing.api_name})`,
      'Object Manager',
      { api_name: existing.api_name, label: existing.singular_label }
    );

    return ok(undefined);
  }
}
