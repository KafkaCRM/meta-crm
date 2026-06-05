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
    assigned_to_id?: string;
  }): Promise<Result<{ data: any[]; next_cursor?: string }, LeadError>> {
    const limit = Math.min(params.limit ?? 50, 100);

    const where: any = {};
    if (params.status) {
      if (params.status === 'junk') {
        where.status = 'junk';
      } else if (params.status === 'hot') {
        where.status = 'hot';
      } else {
        where.status = params.status;
      }
    }
    if (params.source) where.source = params.source;
    if (params.name) where.name = { contains: params.name, mode: 'insensitive' };
    
    if (params.assigned_to_id) {
      if (params.assigned_to_id === 'unassigned' || params.assigned_to_id === 'null') {
        where.assigned_to_id = null;
      } else {
        where.assigned_to_id = params.assigned_to_id;
      }
    }

    const leads = await this.db.getClient().lead.findMany({
      where,
      take: limit + 1,
      include: {
        assigned_to: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      orderBy: { created_at: 'desc' },
    });

    const hasMore = leads.length > limit;
    const rawData = hasMore ? leads.slice(0, limit) : leads;

    // Check duplicate risks in database by phone match
    let dataWithFlags = rawData;
    if (rawData.length > 0) {
      const phones = rawData.map(l => l.phone);
      const normalizedPhones = phones.map(p => p.replace(/[^\d+]/g, ''));

      // Check against existing canonical parties
      const existingParties = await this.db.getClient().party.findMany({
        where: {
          phone_normalized: { in: normalizedPhones },
          merge_status: { not: 'merged' },
        },
        select: {
          phone_normalized: true,
        },
      });

      const duplicatePartyPhones = new Set(existingParties.map(p => p.phone_normalized));

      dataWithFlags = rawData.map(lead => {
        const normalized = lead.phone.replace(/[^\d+]/g, '');
        const hasPartyMatch = duplicatePartyPhones.has(normalized);

        // Simple length check: Indian numbers should have 10+ digits raw
        const digits = lead.phone.replace(/\D/g, '');
        const phoneValid = digits.length >= 10 && digits.length <= 15;

        return {
          ...lead,
          duplicate_risk: hasPartyMatch,
          phone_valid: phoneValid,
        };
      });
    }

    return ok({
      data: dataWithFlags,
      ...(hasMore ? { next_cursor: rawData[rawData.length - 1]?.id } : {}),
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
        campaign_id: dto.campaign_id,
        assigned_to_id: dto.assigned_to_id,
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
        ...(dto.campaign_id !== undefined && { campaign_id: dto.campaign_id }),
        ...(dto.assigned_to_id !== undefined && { assigned_to_id: dto.assigned_to_id }),
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
          let workflow = await tx.pipelineDefinition.findFirst({
            where: { id: dto.pipeline_definition_id || undefined },
          });
          if (!workflow) {
            workflow = await tx.pipelineDefinition.findFirst();
          }
          if (!workflow) {
            throw new Error('No workflow definition found to associate with the case');
          }

          const stages = await tx.pipelineStage.findMany({
            where: { pipeline_definition_id: workflow.id },
            orderBy: { order: 'asc' },
          });
          const defaultStage = stages[0]?.id || '';

          const c = await tx.case.create({
            data: {
              tenant_id: scope.tenant_id,
              branch_brand_assignment_id: dto.branch_brand_assignment_id,
              party_id: party.id,
              type: dto.case_type ?? 'sales',
              title: dto.case_title ?? `Opportunity: ${lead.name}`,
              stage: dto.case_stage && dto.case_stage !== 'new' ? dto.case_stage : defaultStage,
              pipeline_definition_id: workflow.id,
              assigned_to_id: dto.assigned_to_id ?? scope.user_id,
              vertical_id: dto.vertical_id ?? workflow.vertical_id,
              campaign_id: dto.campaign_id ?? lead.campaign_id,
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
            campaign_id: dto.campaign_id ?? lead.campaign_id,
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
