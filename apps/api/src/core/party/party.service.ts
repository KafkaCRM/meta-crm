import { Injectable, NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';
import type { RequestScope } from '../tenant/request-scope.interface';
import type { CreatePartyDto } from './dto/create-party.dto';
import type { UpdatePartyDto } from './dto/update-party.dto';
import { FieldValidationService } from '../metadata/field-validation.service';
import { HooksService } from '../hooks/hooks.service';

export type PartyErrorCode = 'NOT_FOUND' | 'INVALID_PHONE' | 'VALIDATION_FAILED';

export interface PartyError {
  code: PartyErrorCode;
  message: string;
  errors?: string[];
}

@Injectable()
export class PartyService {
  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly cls: ClsService,
    private readonly fieldValidation: FieldValidationService,
    private readonly hooks: HooksService,
  ) {}

  async findMany(params: {
    cursor?: string;
    limit?: number;
    phone?: string;
    name?: string;
    source?: string;
    type?: string;
    vertical_ids?: string[];
  }): Promise<Result<{ data: any[]; next_cursor?: string }, PartyError>> {
    const scope = this.cls.get<RequestScope>('scope');
    const limit = Math.min(params.limit ?? 50, 100);

    const where: any = {};
    if (params.vertical_ids && params.vertical_ids.length > 0) {
      where.vertical_id = { in: params.vertical_ids };
    }
    if (params.phone) where.phone_normalized = { contains: params.phone };
    if (params.name) where.name = { contains: params.name, mode: 'insensitive' };
    if (params.source) where.source = params.source;
    if (params.type) where.type = params.type;

    const parties = await this.db.getClient().party.findMany({
      where,
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      orderBy: { created_at: 'desc' },
    });

    const hasMore = parties.length > limit;
    const data = hasMore ? parties.slice(0, limit) : parties;

    return ok({
      data,
      ...(hasMore ? { next_cursor: data[data.length - 1]?.id } : {}),
    });
  }

  async findOne(id: string): Promise<Result<any, PartyError>> {
    const scope = this.cls.get<RequestScope>('scope');
    const party = await this.db.getClient().party.findUnique({
      where: { id },
    });

    if (!party) {
      return err({ code: 'NOT_FOUND', message: 'Party not found' });
    }

    return ok(party);
  }

  async create(dto: CreatePartyDto): Promise<Result<any, PartyError>> {
    const validationResult = await this.fieldValidation.validateAttributes('Party', dto.attributes ?? {});
    if (validationResult.isErr()) {
      return err({
        code: 'VALIDATION_FAILED',
        message: 'Attributes validation failed',
        errors: validationResult.error,
      } as PartyError);
    }

    const party = await this.db.getClient().party.create({
      data: {
        type: dto.type,
        name: dto.name,
        email: dto.email,
        phone_raw: dto.phone ?? '',
        phone_normalized: dto.phone ?? '',
        source: dto.source ?? 'manual',
        vertical_id: dto.vertical_id,
        attributes: (dto.attributes ?? {}) as any,
      } as any,
    });

    const scope = this.cls.get<RequestScope>('scope');
    const tenantId = scope?.tenant_id || '';

    // Trigger process builder flow in background
    this.hooks.emit('record.event', {
      tenantId,
      objectType: 'Party',
      event: 'create',
      record: party,
    });

    return ok(party);
  }

  async update(id: string, dto: UpdatePartyDto): Promise<Result<any, PartyError>> {
    const existing = await this.db.getClient().party.findUnique({ where: { id } });
    if (!existing) {
      return err({ code: 'NOT_FOUND', message: 'Party not found' });
    }

    const updateData: any = {};
    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.phone !== undefined) {
      updateData.phone_raw = dto.phone;
      updateData.phone_normalized = dto.phone;
    }
    if (dto.vertical_id !== undefined) updateData.vertical_id = dto.vertical_id;
    if (dto.source !== undefined) updateData.source = dto.source;
    if (dto.attributes !== undefined) {
      const validationResult = await this.fieldValidation.validateAttributes('Party', dto.attributes);
      if (validationResult.isErr()) {
        return err({
          code: 'VALIDATION_FAILED',
          message: 'Attributes validation failed',
          errors: validationResult.error,
        } as PartyError);
      }
      updateData.attributes = dto.attributes as any;
    }

    const updated = await this.db.getClient().party.update({
      where: { id },
      data: updateData,
    });

    const scope = this.cls.get<RequestScope>('scope');
    const tenantId = scope?.tenant_id || '';

    // Trigger process builder flow in background
    this.hooks.emit('record.event', {
      tenantId,
      objectType: 'Party',
      event: 'update',
      record: updated,
    });

    return ok(updated);
  }

  async softDelete(id: string): Promise<Result<void, PartyError>> {
    const existing = await this.db.getClient().party.findUnique({ where: { id } });
    if (!existing) {
      return err({ code: 'NOT_FOUND', message: 'Party not found' });
    }

    await this.db.getClient().party.update({
      where: { id },
      data: { merge_status: 'merged' },
    });

    return ok(undefined);
  }
}
