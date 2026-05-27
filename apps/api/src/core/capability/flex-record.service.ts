import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';
import { DynamicValidatorService } from '../permissions/dynamic-validator.service';
import type { RequestScope } from '../tenant/request-scope.interface';
import { HooksService } from '../hooks/hooks.service';

export type FlexRecordErrorCode = 'NOT_FOUND' | 'SCHEMA_NOT_FOUND' | 'VALIDATION_FAILED';

export interface FlexRecordError {
  code: FlexRecordErrorCode;
  message?: string;
  errors?: any;
}

@Injectable()
export class FlexRecordService {
  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly cls: ClsService,
    private readonly validator: DynamicValidatorService,
    private readonly hooks: HooksService,
  ) {}

  private getScope(): RequestScope {
    return this.cls.get<RequestScope>('scope')!;
  }

  async findMany(objectType: string): Promise<Result<any[], FlexRecordError>> {
    const scope = this.getScope();
    
    // Verify object schema exists for this tenant
    const schema = await this.db.getClient().customObjectDefinition.findFirst({
      where: { tenant_id: scope.tenant_id, api_name: objectType },
    });
    if (!schema) {
      return err({ code: 'SCHEMA_NOT_FOUND', message: `Object schema '${objectType}' not found` });
    }

    const records = await this.db.getClient().flexRecord.findMany({
      where: { tenant_id: scope.tenant_id, object_type: objectType },
      orderBy: { created_at: 'desc' },
    });

    const parsedRecords = records.map((r) => ({
      id: r.id,
      object_type: r.object_type,
      created_at: r.created_at,
      updated_at: r.updated_at,
      ...((r.data_json ?? {}) as Record<string, any>),
    }));

    return ok(parsedRecords);
  }

  async findOne(id: string): Promise<Result<any, FlexRecordError>> {
    const scope = this.getScope();
    const record = await this.db.getClient().flexRecord.findUnique({
      where: { id },
    });

    if (!record || record.tenant_id !== scope.tenant_id) {
      return err({ code: 'NOT_FOUND', message: 'Record not found' });
    }

    return ok({
      id: record.id,
      object_type: record.object_type,
      created_at: record.created_at,
      updated_at: record.updated_at,
      ...((record.data_json ?? {}) as Record<string, any>),
    });
  }

  async create(objectType: string, data: Record<string, any>): Promise<Result<any, FlexRecordError>> {
    const scope = this.getScope();

    // 1. Verify schema exists
    const schema = await this.db.getClient().customObjectDefinition.findFirst({
      where: { tenant_id: scope.tenant_id, api_name: objectType },
    });
    if (!schema) {
      return err({ code: 'SCHEMA_NOT_FOUND', message: `Object schema '${objectType}' not found` });
    }

    // 2. Validate data fields against registered FieldDefinitions
    try {
      const validatedData = await this.validator.validateAttributes(scope.tenant_id, objectType, data);
      
      // 3. Write polymorphic FlexRecord to DB
      const record = await this.db.getClient().flexRecord.create({
        data: {
          object_type: objectType,
          data_json: validatedData,
          tenant: { connect: { id: scope.tenant_id } },
        },
      });

      const responseRecord = {
        id: record.id,
        object_type: record.object_type,
        created_at: record.created_at,
        updated_at: record.updated_at,
        ...validatedData,
      };

      // Trigger custom process flow in background
      this.hooks.emit('record.event', {
        tenantId: scope.tenant_id,
        objectType,
        event: 'create',
        record: responseRecord,
      });

      return ok(responseRecord);
    } catch (e: any) {
      return err({
        code: 'VALIDATION_FAILED',
        message: e?.message ?? 'Field validation failed',
        errors: e?.response?.errors,
      });
    }
  }

  async update(id: string, data: Record<string, any>): Promise<Result<any, FlexRecordError>> {
    const scope = this.getScope();
    const existing = await this.db.getClient().flexRecord.findUnique({
      where: { id },
    });

    if (!existing || existing.tenant_id !== scope.tenant_id) {
      return err({ code: 'NOT_FOUND', message: 'Record not found' });
    }

    // Validate updated attributes
    try {
      const mergedData = { ...((existing.data_json ?? {}) as Record<string, any>), ...data };
      const validatedData = await this.validator.validateAttributes(scope.tenant_id, existing.object_type, mergedData);

      const updated = await this.db.getClient().flexRecord.update({
        where: { id },
        data: {
          data_json: validatedData,
        },
      });

      const responseRecord = {
        id: updated.id,
        object_type: updated.object_type,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
        ...validatedData,
      };

      // Trigger custom process flow in background
      this.hooks.emit('record.event', {
        tenantId: scope.tenant_id,
        objectType: existing.object_type,
        event: 'update',
        record: responseRecord,
      });

      return ok(responseRecord);
    } catch (e: any) {
      return err({
        code: 'VALIDATION_FAILED',
        message: e?.message ?? 'Field validation failed',
        errors: e?.response?.errors,
      });
    }
  }

  async remove(id: string): Promise<Result<void, FlexRecordError>> {
    const scope = this.getScope();
    const existing = await this.db.getClient().flexRecord.findUnique({
      where: { id },
    });

    if (!existing || existing.tenant_id !== scope.tenant_id) {
      return err({ code: 'NOT_FOUND', message: 'Record not found' });
    }

    await this.db.getClient().flexRecord.delete({
      where: { id },
    });

    return ok(undefined);
  }
}
