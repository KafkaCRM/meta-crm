import { Injectable, NotFoundException } from '@nestjs/common';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';
import { CreateFieldDefinitionDto, UpdateFieldDefinitionDto } from './dto/metadata.dto';
import { SetupAuditTrailService } from './setup-audit.service';

export type FieldErrorCode = 'NOT_FOUND';

export interface FieldError {
  code: FieldErrorCode;
  message?: string;
}

@Injectable()
export class FieldDefinitionService {
  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly audit: SetupAuditTrailService,
  ) {}

  async findByEntity(entityType: string): Promise<Result<any[], FieldError>> {
    const fields = await this.db.getClient().fieldDefinition.findMany({
      where: { entity_type: entityType },
      orderBy: { order: 'asc' },
    });
    return ok(fields);
  }

  async create(dto: CreateFieldDefinitionDto): Promise<Result<any, FieldError>> {
    const field = await this.db.getClient().fieldDefinition.create({
      data: {
        entity_type: dto.entity_type,
        name: dto.name,
        label: dto.label,
        field_type: dto.field_type,
        options: dto.options as any,
        required: dto.required ?? false,
        order: dto.order ?? 0,
        visibility_rules: (dto.visibility_rules ?? []) as any,
        related_to: dto.related_to,
        custom_obj_id: dto.custom_obj_id,
      } as any,
    });

    // Write metadata change log to Setup Audit Trail
    await this.audit.log(
      `Created Custom Field '${field.label}' (${field.name})`,
      'Object Manager',
      { entity_type: field.entity_type, name: field.name, field_type: field.field_type, related_to: field.related_to }
    );

    return ok(field);
  }

  async update(id: string, dto: UpdateFieldDefinitionDto): Promise<Result<any, FieldError>> {
    const existing = await this.db.getClient().fieldDefinition.findUnique({ where: { id } });
    if (!existing) {
      return err({ code: 'NOT_FOUND', message: 'Field definition not found' });
    }

    const data: Record<string, unknown> = {};
    if (dto.label !== undefined) data.label = dto.label;
    if (dto.options !== undefined) data.options = dto.options;
    if (dto.required !== undefined) data.required = dto.required;
    if (dto.order !== undefined) data.order = dto.order;
    if (dto.visibility_rules !== undefined) data.visibility_rules = dto.visibility_rules;

    const updated = await this.db.getClient().fieldDefinition.update({
      where: { id },
      data: data as any,
    });

    await this.audit.log(
      `Updated Field '${updated.label}' (${updated.name})`,
      'Object Manager',
      { entity_type: updated.entity_type, name: updated.name }
    );

    return ok(updated);
  }

  async remove(id: string): Promise<Result<void, FieldError>> {
    const existing = await this.db.getClient().fieldDefinition.findUnique({ where: { id } });
    if (!existing) {
      return err({ code: 'NOT_FOUND', message: 'Field definition not found' });
    }

    await this.db.getClient().fieldDefinition.delete({ where: { id } });

    // Write metadata change log to Setup Audit Trail
    await this.audit.log(
      `Deleted Custom Field '${existing.label}' (${existing.name})`,
      'Object Manager',
      { entity_type: existing.entity_type, name: existing.name }
    );

    return ok(undefined);
  }
}
