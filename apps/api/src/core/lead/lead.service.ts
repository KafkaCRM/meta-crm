import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';
import type { RequestScope } from '../tenant/request-scope.interface';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { ConvertLeadDto } from './dto/convert-lead.dto';
import { PartySource } from '@meta-crm/types';

export type LeadErrorCode = 'NOT_FOUND' | 'ALREADY_CONVERTED' | 'CONVERSION_FAILED' | 'VALIDATION_FAILED';

export interface LeadError {
  code: LeadErrorCode;
  message: string;
  errors?: string[];
}

@Injectable()
export class LeadService {
  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly cls: ClsService,
  ) {}

  async findMany(params: {
    cursor?: string;
    limit?: number;
    status?: string;
    source?: string;
    name?: string;
  }): Promise<Result<{ data: any[]; next_cursor?: string }, LeadError>> {
    const limit = Math.min(params.limit ?? 50, 100);

    const where: any = {};
    if (params.status) where.status = params.status;
    if (params.source) where.source = params.source;
    if (params.name) where.name = { contains: params.name, mode: 'insensitive' };

    const leads = await this.db.getClient().lead.findMany({
      where,
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      orderBy: { created_at: 'desc' },
    });

    const hasMore = leads.length > limit;
    const data = hasMore ? leads.slice(0, limit) : leads;

    return ok({
      data,
      ...(hasMore ? { next_cursor: data[data.length - 1]?.id } : {}),
    });
  }

  async findOne(id: string): Promise<Result<any, LeadError>> {
    const lead = await this.db.getClient().lead.findUnique({
      where: { id },
    });

    if (!lead) {
      return err({ code: 'NOT_FOUND', message: `Lead not found with ID: ${id}` });
    }

    return ok(lead);
  }

  async create(dto: CreateLeadDto): Promise<Result<any, LeadError>> {
    const scope = this.cls.get<RequestScope>('scope');
    if (!scope?.tenant_id) {
      return err({ code: 'VALIDATION_FAILED', message: 'Tenant context missing' });
    }

    const lead = await this.db.getClient().lead.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        source: dto.source,
        status: dto.status ?? 'new',
        notes: dto.notes,
        attributes: (dto.attributes ?? {}) as any,
        tenant_id: scope.tenant_id,
      },
    });

    return ok(lead);
  }

  async update(id: string, dto: UpdateLeadDto): Promise<Result<any, LeadError>> {
    const existing = await this.db.getClient().lead.findUnique({ where: { id } });
    if (!existing) {
      return err({ code: 'NOT_FOUND', message: `Lead not found with ID: ${id}` });
    }

    const updated = await this.db.getClient().lead.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.source !== undefined && { source: dto.source }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.attributes !== undefined && { attributes: dto.attributes as any }),
      },
    });

    return ok(updated);
  }

  async remove(id: string): Promise<Result<void, LeadError>> {
    const existing = await this.db.getClient().lead.findUnique({ where: { id } });
    if (!existing) {
      return err({ code: 'NOT_FOUND', message: `Lead not found with ID: ${id}` });
    }

    await this.db.getClient().lead.delete({
      where: { id },
    });

    return ok(undefined);
  }

  async convert(id: string, dto: ConvertLeadDto): Promise<Result<{ party_id: string; case_id?: string }, LeadError>> {
    const scope = this.cls.get<RequestScope>('scope');
    if (!scope) {
      return err({ code: 'VALIDATION_FAILED', message: 'User context missing' });
    }

    const lead = await this.db.getClient().lead.findUnique({ where: { id } });
    if (!lead) {
      return err({ code: 'NOT_FOUND', message: `Lead not found with ID: ${id}` });
    }

    if (lead.status === 'converted') {
      return err({ code: 'ALREADY_CONVERTED', message: `Lead with ID: ${id} has already been converted` });
    }

    try {
      const result = await this.db.getClient().$transaction(async (tx) => {
        let sourceVal = PartySource.Manual;
        if (Object.values(PartySource).includes(lead.source as any)) {
          sourceVal = lead.source as PartySource;
        }

        const party = await tx.party.create({
          data: {
            tenant_id: scope.tenant_id,
            branch_brand_assignment_id: dto.branch_brand_assignment_id,
            type: 'individual',
            name: lead.name,
            email: lead.email,
            phone_raw: lead.phone,
            phone_normalized: lead.phone.replace(/[^\d+]/g, ''),
            source: sourceVal,
            attributes: (lead.attributes ?? {}) as any,
            merge_status: 'canonical',
          },
        });

        let createdCaseId: string | undefined = undefined;
        if (dto.create_case !== false) {
          const c = await tx.case.create({
            data: {
              tenant_id: scope.tenant_id,
              branch_brand_assignment_id: dto.branch_brand_assignment_id,
              party_id: party.id,
              type: dto.case_type ?? 'sales',
              title: dto.case_title ?? `Opportunity: ${lead.name}`,
              stage: dto.case_stage ?? 'new',
              workflow_definition_id: dto.workflow_definition_id ?? '',
              assigned_to_id: dto.assigned_to_id ?? scope.user_id,
              vertical_id: dto.vertical_id,
              campaign_id: dto.campaign_id,
              attributes: {},
            },
          });
          createdCaseId = c.id;
        }

        await tx.lead.update({
          where: { id },
          data: {
            status: 'converted',
            converted_party_id: party.id,
            converted_case_id: createdCaseId,
          },
        });

        return { party_id: party.id, case_id: createdCaseId };
      });

      return ok(result);
    } catch (e: any) {
      return err({ code: 'CONVERSION_FAILED', message: e?.message ?? 'Failed to convert lead' });
    }
  }
}
