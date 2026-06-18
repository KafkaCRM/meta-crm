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

export type LeadErrorCode =
  | 'NOT_FOUND'
  | 'ALREADY_CONVERTED'
  | 'CONVERSION_FAILED'
  | 'VALIDATION_FAILED'
  | 'INVALID_TRANSITION'
  | 'NO_PIPELINE';

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
    pipeline_definition_id?: string;
    stage?: string;
    vertical_ids?: string[];
  }): Promise<Result<{ data: any[]; next_cursor?: string }, LeadError>> {
    const limit = Math.min(params.limit ?? 50, 100);

    const where: any = {};
    if (params.vertical_ids && params.vertical_ids.length > 0) {
      where.vertical_id = { in: params.vertical_ids };
    }
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
    if (params.pipeline_definition_id) where.pipeline_definition_id = params.pipeline_definition_id;
    if (params.stage) where.stage = params.stage;
    
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
          select: { id: true, name: true, email: true },
        },
        party: {
          select: { id: true, name: true, email: true, phone_raw: true },
        },
      },
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      orderBy: { created_at: 'desc' },
    });

    const hasMore = leads.length > limit;
    const rawData = hasMore ? leads.slice(0, limit) : leads;

    let dataWithFlags = rawData;
    if (rawData.length > 0) {
      try {
        const phones = rawData.map(l => l.phone);
        const normalizedPhones = phones.map(p => p.replace(/[^\d+]/g, ''));

        const existingParties = await this.db.getClient().party.findMany({
          where: {
            phone_normalized: { in: normalizedPhones },
            merge_status: { not: 'merged' },
          },
          select: { phone_normalized: true },
        });

        const duplicatePartyPhones = new Set(existingParties.map(p => p.phone_normalized));

        dataWithFlags = rawData.map(lead => {
          const normalized = lead.phone.replace(/[^\d+]/g, '');
          const hasPartyMatch = duplicatePartyPhones.has(normalized);
          const digits = lead.phone.replace(/\D/g, '');
          const phoneValid = digits.length >= 10 && digits.length <= 15;

          return {
            ...lead,
            duplicate_risk: hasPartyMatch,
            phone_valid: phoneValid,
          };
        });
      } catch {
        // Gracefully degrade
      }
    }

    return ok({
      data: dataWithFlags,
      ...(hasMore ? { next_cursor: rawData[rawData.length - 1]?.id } : {}),
    });
  }

  async findOne(id: string): Promise<Result<any, LeadError>> {
    const lead = await this.db.getClient().lead.findUnique({
      where: { id },
      include: {
        assigned_to: {
          select: { id: true, name: true, email: true },
        },
        party: {
          select: { id: true, name: true, email: true, phone_raw: true, source: true },
        },
        pipelineDefinition: {
          select: { id: true, name: true, stages: { orderBy: { order: 'asc' } } },
        },
        events: {
          orderBy: { occurred_at: 'desc' },
          take: 50,
        },
      },
    });

    if (!lead) {
      return err({ code: 'NOT_FOUND', message: `Lead not found with ID: ${id}` });
    }

    return ok(lead);
  }

  async findByStage(pipelineDefinitionId: string): Promise<Result<any, LeadError>> {
    const scope = this.cls.get<RequestScope>('scope');
    if (!scope || !scope.tenant_id) {
      return err({ code: 'VALIDATION_FAILED', message: 'Tenant context missing' });
    }

    const workflow = await this.db.getClient().pipelineDefinition.findFirst({
      where: { id: pipelineDefinitionId },
      include: { stages: { orderBy: { order: 'asc' } } },
    });

    if (!workflow) {
      return err({ code: 'NO_PIPELINE', message: 'Pipeline not found' });
    }

    const stageIds = workflow.stages.map((s) => s.id);
    const leads = await this.db.getClient().lead.findMany({
      where: {
        pipeline_definition_id: pipelineDefinitionId,
        stage: { in: stageIds },
      },
      include: {
        assigned_to: {
          select: { id: true, name: true, email: true },
        },
        party: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    const leadsByStage: Record<string, any[]> = {};
    for (const stage of workflow.stages) {
      leadsByStage[stage.id] = [];
    }

    for (const lead of leads) {
      const stageKey = lead.stage;
      if (stageKey) {
        const bucket = leadsByStage[stageKey];
        if (bucket) bucket.push(lead);
      }
    }

    return ok({
      stages: workflow.stages,
      leads: leadsByStage,
    });
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
        vertical_id: dto.vertical_id ?? scope.vertical_ids?.[0] ?? '',
        attributes: (dto.attributes ?? {}) as any,
        tenant_id: scope.tenant_id,
        events: {
          create: {
            event_type: 'lead_created',
            actor_id: scope.user_id ?? 'system',
            tenant_id: scope.tenant_id,
            metadata: { source: dto.source, campaign_id: dto.campaign_id } as any,
          },
        },
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
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.campaign_id !== undefined && { campaign_id: dto.campaign_id }),
        ...(dto.assigned_to_id !== undefined && { assigned_to_id: dto.assigned_to_id }),
        ...(dto.vertical_id !== undefined && { vertical_id: dto.vertical_id }),
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

    await this.db.getClient().lead.delete({ where: { id } });

    return ok(undefined);
  }

  async addToPipeline(
    id: string,
    pipelineDefinitionId: string,
  ): Promise<Result<any, LeadError>> {
    const scope = this.cls.get<RequestScope>('scope');
    const lead = await this.db.getClient().lead.findUnique({ where: { id } });
    if (!lead) {
      return err({ code: 'NOT_FOUND', message: `Lead not found with ID: ${id}` });
    }

    const pipeline = await this.db.getClient().pipelineDefinition.findUnique({
      where: { id: pipelineDefinitionId },
      include: { stages: { orderBy: { order: 'asc' }, take: 1 } },
    });
    if (!pipeline) {
      return err({ code: 'NO_PIPELINE', message: 'Pipeline definition not found' });
    }

    const firstStage = pipeline.stages[0]?.id;

    const updated = await this.db.getClient().lead.update({
      where: { id },
      data: {
        pipeline_definition_id: pipelineDefinitionId,
        stage: firstStage,
        status: lead.status === 'new' ? 'active' : lead.status,
        events: {
          create: {
            event_type: 'stage_changed',
            from_stage: null,
            to_stage: firstStage,
            actor_id: scope?.user_id ?? 'system',
            tenant_id: lead.tenant_id,
            metadata: { pipeline_name: pipeline.name } as any,
          },
        },
      },
      include: {
        pipelineDefinition: {
          select: { id: true, name: true, stages: { orderBy: { order: 'asc' } } },
        },
      },
    });

    return ok(updated);
  }

  async transitionStage(
    id: string,
    toStageId: string,
  ): Promise<Result<any, LeadError>> {
    const scope = this.cls.get<RequestScope>('scope');
    const lead = await this.db.getClient().lead.findUnique({ where: { id } });
    if (!lead) {
      return err({ code: 'NOT_FOUND', message: `Lead not found with ID: ${id}` });
    }

    if (!lead.pipeline_definition_id) {
      return err({ code: 'NO_PIPELINE', message: 'Lead is not assigned to a pipeline' });
    }

    const stage = await this.db.getClient().pipelineStage.findUnique({
      where: { id: toStageId },
    });
    if (!stage || stage.pipeline_definition_id !== lead.pipeline_definition_id) {
      return err({ code: 'INVALID_TRANSITION', message: 'Invalid stage for this pipeline' });
    }

    const updated = await this.db.getClient().lead.update({
      where: { id },
      data: {
        stage: toStageId,
        events: {
          create: {
            event_type: 'stage_changed',
            from_stage: lead.stage,
            to_stage: toStageId,
            actor_id: scope?.user_id ?? 'system',
            tenant_id: lead.tenant_id,
            metadata: {} as any,
          },
        },
      },
      include: {
        pipelineDefinition: {
          select: { id: true, name: true, stages: { orderBy: { order: 'asc' } } },
        },
      },
    });

    return ok(updated);
  }

  async findEvents(
    leadId: string,
    params: { cursor?: string; limit?: number },
  ): Promise<Result<{ data: any[]; next_cursor?: string }, LeadError>> {
    const limit = Math.min(params.limit ?? 50, 100);
    const events = await this.db.getClient().leadEvent.findMany({
      where: { lead_id: leadId },
      take: limit + 1,
      orderBy: { occurred_at: 'desc' },
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });

    const hasMore = events.length > limit;
    const data = hasMore ? events.slice(0, limit) : events;

    return ok({
      data,
      ...(hasMore ? { next_cursor: data[data.length - 1]?.id } : {}),
    });
  }

  async convert(
    id: string,
    dto: ConvertLeadDto,
  ): Promise<Result<{ party_id: string }, LeadError>> {
    const scope = this.cls.get<RequestScope>('scope');
    if (!scope) {
      return err({ code: 'VALIDATION_FAILED', message: 'User context missing' });
    }

    const lead = await this.db.getClient().lead.findUnique({ where: { id } });
    if (!lead) {
      return err({ code: 'NOT_FOUND', message: `Lead not found with ID: ${id}` });
    }

    if (lead.status === 'converted') {
      return err({ code: 'ALREADY_CONVERTED', message: 'This lead has already been converted' });
    }

    try {
      const result = await this.db.getClient().$transaction(async (tx) => {
        let sourceVal = PartySource.Manual;
        if (Object.values(PartySource).includes(lead.source as any)) {
          sourceVal = lead.source as PartySource;
        }

        const party = await tx.party.create({
          data: {
            tenant_id: scope!.tenant_id,
            vertical_id: dto.vertical_id,
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

        await tx.lead.update({
          where: { id },
          data: {
            status: 'converted',
            party_id: party.id,
            events: {
              create: {
                event_type: 'promoted',
                to_stage: lead.stage,
                actor_id: scope!.user_id,
                tenant_id: scope!.tenant_id,
                metadata: { party_id: party.id } as any,
              },
            },
          },
        });

        return { party_id: party.id };
      });

      return ok(result);
    } catch (e: any) {
      return err({ code: 'CONVERSION_FAILED', message: e?.message ?? 'Failed to convert lead' });
    }
  }
}
