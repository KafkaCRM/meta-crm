import { Injectable, Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';
import type { RequestScope } from '../tenant/request-scope.interface';

export type PipelineErrorCode =
  | 'CONNECTION_NOT_FOUND'
  | 'CONNECTION_INACTIVE'
  | 'NO_INTAKE_ROUTE'
  | 'INVALID_EVENT'
  | 'DUPLICATE_EVENT'
  | 'FIELD_MAPPING_FAILED'
  | 'CAMPAIGN_NOT_FOUND'
  | 'LEAD_CREATION_FAILED'
  | 'PARTY_CREATION_FAILED'
  | 'CASE_CREATION_FAILED'
  | 'INTERNAL';

export interface PipelineError {
  code: PipelineErrorCode;
  message: string;
}

export interface PipelineResult {
  status: 'routed' | 'deduplicated' | 'failed';
  entity_type: 'lead' | 'party';
  entity_id: string | null;
  event_id: string;
}

@Injectable()
export class IntakePipelineService {
  private readonly logger = new Logger(IntakePipelineService.name);

  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly cls: ClsService,
  ) {}

  async processInboundEvent(params: {
    connectionId: string;
    providerEventId: string;
    eventType: string;
    rawPayload: Record<string, unknown>;
    parsedFields: Record<string, string>;
    tenantId: string;
  }): Promise<Result<PipelineResult, PipelineError>> {
    const { connectionId, providerEventId, eventType, rawPayload, parsedFields, tenantId } = params;

    // 1. Verify connection is active
    const connection = await this.db.getClient().integrationConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      return err({ code: 'CONNECTION_NOT_FOUND', message: `Connection ${connectionId} not found` });
    }

    if (connection.status !== 'connected') {
      return err({
        code: 'CONNECTION_INACTIVE',
        message: `Connection ${connectionId} is ${connection.status}`,
      });
    }

    // 2. Create InboundEvent first (deduplication checkpoint)
    const existingEvent = await this.db.getClient().inboundEvent.findUnique({
      where: { connection_id_provider_event_id: { connection_id: connectionId, provider_event_id: providerEventId } },
    });

    if (existingEvent) {
      return ok({
        status: 'deduplicated',
        entity_type: 'lead',
        entity_id: existingEvent.result_entity_id,
        event_id: existingEvent.id,
      });
    }

    const inboundEvent = await this.db.getClient().inboundEvent.create({
      data: {
        connection_id: connectionId,
        provider_event_id: providerEventId,
        event_type: eventType,
        raw_payload: rawPayload as any,
        status: 'received',
      },
    });

    // 3. Load intake route for this connection
    const route = await this.db.getClient().integrationIntakeRoute.findUnique({
      where: { connection_id: connectionId },
      include: { fieldMappings: true },
    });

    if (!route) {
      await this.db.getClient().inboundEvent.update({
        where: { id: inboundEvent.id },
        data: { status: 'failed', error_message: 'No intake route configured' },
      });
      return err({ code: 'NO_INTAKE_ROUTE', message: 'No intake route configured for this connection' });
    }

    try {
      // 4. Map fields
      const mappedFields = this.mapFields(parsedFields, route.fieldMappings);

      // 5. Resolve campaign (derives branch, brand, vertical, pipeline)
      const campaignDerivations = await this.resolveCampaign(route.campaign_id);

      // 6. Resolve assignment
      const assignedToId = await this.resolveAssignment(route, scopeOf(tenantId));

      const branchBrandAssignmentId = route.branch_brand_assignment_id
        ?? campaignDerivations?.branchBrandAssignmentId
        ?? '';

      // 7. Create entity based on mode
      if (route.mode === 'create_lead') {
        const leadResult = await this.createLeadFromIntake({
          tenantId,
          mappedFields,
          connectionProvider: connection.provider,
          campaignId: route.campaign_id,
          assignedToId,
          branchBrandAssignmentId,
          verticalId: route.vertical_id ?? campaignDerivations?.verticalId ?? null,
        });

        if (leadResult.isErr()) {
          await this.failEvent(inboundEvent.id, leadResult.error.message);
          return err(leadResult.error);
        }

        await this.db.getClient().inboundEvent.update({
          where: { id: inboundEvent.id },
          data: {
            status: 'routed',
            result_entity_type: 'lead',
            result_entity_id: leadResult.value,
            processed_at: new Date(),
          },
        });

        return ok({
          status: 'routed',
          entity_type: 'lead',
          entity_id: leadResult.value,
          event_id: inboundEvent.id,
        });
      }

      // mode = create_contact_opportunity
      const contactResult = await this.createContactOpportunityFromIntake({
        tenantId,
        mappedFields,
        connectionProvider: connection.provider,
        campaignId: route.campaign_id,
        assignedToId,
        branchBrandAssignmentId,
        verticalId: route.vertical_id ?? campaignDerivations?.verticalId ?? null,
        pipelineId: route.pipeline_id ?? campaignDerivations?.pipelineId ?? null,
        entryStageId: route.entry_stage_id ?? campaignDerivations?.entryStageId ?? null,
      });

      if (contactResult.isErr()) {
        await this.failEvent(inboundEvent.id, contactResult.error.message);
        return err(contactResult.error);
      }

      await this.db.getClient().inboundEvent.update({
        where: { id: inboundEvent.id },
        data: {
          status: 'routed',
          result_entity_type: 'party',
          result_entity_id: contactResult.value,
          processed_at: new Date(),
        },
      });

      return ok({
        status: 'routed',
        entity_type: 'party',
        entity_id: contactResult.value,
        event_id: inboundEvent.id,
      });
    } catch (e) {
      const message = (e as Error).message;
      await this.failEvent(inboundEvent.id, message);
      return err({ code: 'INTERNAL', message });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Field Mapping
  // ═══════════════════════════════════════════════════════════════════

  private mapFields(
    sourceFields: Record<string, string>,
    mappings: Array<{ source_field: string; target_entity: string; target_field: string; transform: string | null }>,
  ): Record<string, string> {
    const result: Record<string, string> = {};

    for (const mapping of mappings) {
      const sourceValue = this.resolveDotPath(sourceFields, mapping.source_field);
      if (sourceValue === undefined || sourceValue === null) continue;

      const transformed = this.applyTransform(sourceValue, mapping.transform);
      result[`${mapping.target_entity}.${mapping.target_field}`] = String(transformed);
    }

    // Pass through any unmapped fields as lead. prefixed
    for (const [key, value] of Object.entries(sourceFields)) {
      const isMapped = mappings.some((m) => m.source_field === key);
      if (!isMapped && value) {
        result[`lead.${key}`] = String(value);
      }
    }

    return result;
  }

  private resolveDotPath(obj: Record<string, any>, path: string): any {
    const parts = path.split('.');
    let current: any = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }
    return current;
  }

  private applyTransform(value: any, transform: string | null): any {
    if (!transform || transform === 'direct') return value;
    if (transform.startsWith('split(')) {
      const match = transform.match(/split\(['"](.+)['"],\s*(\d+)\)/);
      if (match) {
        const separator = match[1]!;
        const index = parseInt(match[2]!, 10);
        const parts = String(value).split(separator);
        return parts[index] ?? '';
      }
    }
    return value;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Campaign Derivation
  // ═══════════════════════════════════════════════════════════════════

  private async resolveCampaign(campaignId: string | null): Promise<{
    branchBrandAssignmentId: string | null;
    verticalId: string | null;
    pipelineId: string | null;
    entryStageId: string | null;
  } | null> {
    if (!campaignId) return null;

    const campaign = await this.db.getClient().campaign.findUnique({
      where: { id: campaignId },
      include: {
        pipeline: { include: { stages: { orderBy: { order: 'asc' } } } },
      },
    });

    if (!campaign) return null;

    const branchBrandAssignment = await this.db.getClient().branchBrandAssignment.findFirst({
      where: { branch_id: campaign.branch_id, brand_id: campaign.brand_id },
    });

    return {
      branchBrandAssignmentId: branchBrandAssignment?.id ?? null,
      verticalId: campaign.vertical_id,
      pipelineId: campaign.pipeline_id,
      entryStageId: campaign.pipeline?.stages?.[0]?.id ?? null,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // Assignment
  // ═══════════════════════════════════════════════════════════════════

  private async resolveAssignment(
    route: { owner_id: string | null; assignment_rule: any },
    _scope: any,
  ): Promise<string | null> {
    if (route.owner_id) return route.owner_id;

    const rule = route.assignment_rule || { type: 'fixed' };

    if (rule.type === 'round_robin') {
      const users = await this.db.getClient().user.findMany({
        where: { status: 'active' },
        select: { id: true },
        take: 50,
      });
      if (users.length === 0) return null;
      return users[Math.floor(Math.random() * users.length)]!.id;
    }

    return null;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Lead Creation
  // ═══════════════════════════════════════════════════════════════════

  private async createLeadFromIntake(params: {
    tenantId: string;
    mappedFields: Record<string, string>;
    connectionProvider: string;
    campaignId: string | null;
    assignedToId: string | null;
    branchBrandAssignmentId: string;
    verticalId: string | null;
  }): Promise<Result<string, PipelineError>> {
    const name = params.mappedFields['lead.name'] ?? 'Unknown Lead';
    const email = params.mappedFields['lead.email'] ?? null;
    const phone = params.mappedFields['lead.phone'] ?? params.mappedFields['party.phone_raw'] ?? '+910000000000';

    const attributes: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params.mappedFields)) {
      if (!['lead.name', 'lead.email', 'lead.phone'].includes(key)) {
        attributes[key] = value;
      }
    }

    try {
      const lead = await this.db.getClient().lead.create({
        data: {
          tenant_id: params.tenantId,
          name,
          email,
          phone,
          source: params.connectionProvider,
          status: 'new',
          campaign_id: params.campaignId,
          assigned_to_id: params.assignedToId,
          attributes: attributes as any,
        },
      });
      return ok(lead.id);
    } catch (e) {
      return err({
        code: 'LEAD_CREATION_FAILED',
        message: (e as Error).message,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Contact + Opportunity Creation
  // ═══════════════════════════════════════════════════════════════════

  private async createContactOpportunityFromIntake(params: {
    tenantId: string;
    mappedFields: Record<string, string>;
    connectionProvider: string;
    campaignId: string | null;
    assignedToId: string | null;
    branchBrandAssignmentId: string;
    verticalId: string | null;
    pipelineId: string | null;
    entryStageId: string | null;
  }): Promise<Result<string, PipelineError>> {
    const name = params.mappedFields['party.name'] ?? 'Unknown Contact';
    const email = params.mappedFields['party.email'] ?? null;
    const phone = params.mappedFields['party.phone_raw'] ?? '+910000000000';
    const normalized = phone.replace(/[^\d+]/g, '');

    const caseTitle = params.mappedFields['case.title'] ?? `Opportunity: ${name}`;

    const partyAttrs: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params.mappedFields)) {
      if (key.startsWith('party.') && !['party.name', 'party.email', 'party.phone_raw'].includes(key)) {
        partyAttrs[key] = value;
      }
    }

    try {
      const result = await this.db.getClient().$transaction(async (tx) => {
        const party = await tx.party.create({
          data: {
            tenant_id: params.tenantId,
            branch_brand_assignment_id: params.branchBrandAssignmentId,
            type: 'individual',
            name,
            email,
            phone_raw: phone,
            phone_normalized: normalized,
            source: params.connectionProvider,
            attributes: partyAttrs as any,
            merge_status: 'canonical',
          },
        });

        let pipelineId: string | null = params.pipelineId;
        let stageId: string | null = params.entryStageId;

        if (!pipelineId) {
          const pipeline = await tx.pipelineDefinition.findFirst();
          pipelineId = pipeline?.id ?? null;
          if (pipeline) {
            const stages = await tx.pipelineStage.findMany({
              where: { pipeline_definition_id: pipeline.id },
              orderBy: { order: 'asc' },
            });
            stageId = stages[0]?.id ?? null;
          }
        }

        if (!pipelineId) {
          throw new Error('No pipeline definition found');
        }

        await tx.case.create({
          data: {
            tenant_id: params.tenantId,
            branch_brand_assignment_id: params.branchBrandAssignmentId,
            party_id: party.id,
            type: 'sales',
            title: caseTitle,
            stage: stageId ?? '',
            pipeline_definition_id: pipelineId,
            assigned_to_id: params.assignedToId,
            vertical_id: params.verticalId,
            campaign_id: params.campaignId,
            attributes: {},
          },
        });

        return party.id;
      });

      return ok(result);
    } catch (e) {
      return err({
        code: 'CASE_CREATION_FAILED',
        message: (e as Error).message,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════════

  private async failEvent(eventId: string, message: string) {
    await this.db.getClient().inboundEvent.update({
      where: { id: eventId },
      data: { status: 'failed', error_message: message },
    });
  }
}

function scopeOf(tenantId: string) {
  return { tenant_id: tenantId };
}
