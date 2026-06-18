import { Injectable } from '@nestjs/common';
import { ok, err, Result } from 'neverthrow';
import { ClsService } from 'nestjs-cls';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';
import type { RequestScope } from '../tenant/request-scope.interface';

export type WorkflowErrorCode = 'NOT_FOUND' | 'TRANSACTION_FAILED' | 'VALIDATION_ERROR';

export interface WorkflowError {
  code: WorkflowErrorCode;
  message: string;
}

@Injectable()
export class WorkflowService {
  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly cls: ClsService,
  ) {}

  async list(filters?: { branch_id?: string; vertical_id?: string }): Promise<Result<any[], WorkflowError>> {
    try {
      const where: Record<string, unknown> = {};
      if (filters?.vertical_id) {
        where.vertical_id = filters.vertical_id;
      } else if (filters?.branch_id) {
        // Filter by branch through the vertical relation
        const verticalIds = await this.db.getClient().vertical.findMany({
          where: { branch_id: filters.branch_id },
          select: { id: true },
        });
        where.vertical_id = { in: verticalIds.map((v) => v.id) };
      }
      const pipelines = await this.db.getClient().pipelineDefinition.findMany({
        where,
        include: {
          stages: { orderBy: { order: 'asc' } },
          vertical: { select: { id: true, name: true, branch_id: true } },
        },
      });
      return ok(pipelines);
    } catch (e: any) {
      return err({
        code: 'TRANSACTION_FAILED',
        message: e?.message ?? 'Failed to retrieve pipelines',
      });
    }
  }

  async create(data: { name: string; entity_type?: string; vertical_id?: string }): Promise<Result<any, WorkflowError>> {
    try {
      const scope = this.cls.get<RequestScope>('scope');
      const tenantId = scope?.tenant_id || '';

      const existing = await this.db.getClient().pipelineDefinition.findFirst({
        where: {
          tenant_id: tenantId,
          name: {
            equals: data.name.trim(),
            mode: 'insensitive',
          },
        },
      });

      if (existing) {
        return err({
          code: 'TRANSACTION_FAILED',
          message: `A pipeline named "${data.name.trim()}" already exists. Please choose a unique name.`,
        });
      }

      const created = await this.db.getClient().pipelineDefinition.create({
        data: {
          tenant_id: tenantId,
          name: data.name,
          entity_type: data.entity_type ?? 'lead',
          vertical_id: data.vertical_id ?? null,
        },
      });

      // Automatically seed default stages for this new pipeline so it starts functional
      const defaultStages = [
        { name: 'Lead', order: 0, sla_hours: 24, terminal_outcome: null },
        { name: 'Contacted', order: 1, sla_hours: null, terminal_outcome: null },
        { name: 'Proposal Sent', order: 2, sla_hours: null, terminal_outcome: null },
        { name: 'Closed Won', order: 3, sla_hours: null, terminal_outcome: 'won' },
        { name: 'Closed Lost', order: 4, sla_hours: null, terminal_outcome: 'lost' },
      ];

      for (const stage of defaultStages) {
        await this.db.getClient().pipelineStage.create({
          data: {
            pipeline_definition_id: created.id,
            name: stage.name,
            order: stage.order,
            sla_hours: stage.sla_hours,
            terminal_outcome: stage.terminal_outcome,
          },
        });
      }

      return ok(created);
    } catch (e: any) {
      return err({
        code: 'TRANSACTION_FAILED',
        message: e?.message ?? 'Failed to create pipeline',
      });
    }
  }

  async getDefault(): Promise<Result<any, WorkflowError>> {
    try {
      const scope = this.cls.get<RequestScope>('scope');
      const tenantId = scope?.tenant_id || '';

      let pipeline = await this.db.getClient().pipelineDefinition.findFirst({
        include: {
          stages: { orderBy: { order: 'asc' } },
          transitions: true,
        },
      });

      if (!pipeline) {
        // Initialize a generic default pipeline if none exists.
        const created = await this.db.getClient().pipelineDefinition.create({
          data: {
            tenant_id: tenantId,
            name: 'Default Pipeline',
            entity_type: 'lead',
          },
        });

        const stagesData = [
          { name: 'Lead', order: 0, sla_hours: 24, terminal_outcome: null },
          { name: 'Contacted', order: 1, sla_hours: null, terminal_outcome: null },
          { name: 'Qualified', order: 2, sla_hours: null, terminal_outcome: null },
          { name: 'Closed Won', order: 3, sla_hours: null, terminal_outcome: 'won' },
          { name: 'Closed Lost', order: 4, sla_hours: null, terminal_outcome: 'lost' },
        ];

        const stageIds: string[] = [];
        for (const stage of stagesData) {
          const createdStage = await this.db.getClient().pipelineStage.create({
            data: {
              pipeline_definition_id: created.id,
              name: stage.name,
              order: stage.order,
              sla_hours: stage.sla_hours,
              terminal_outcome: stage.terminal_outcome,
            },
          });
          stageIds.push(createdStage.id);
        }

        // Default transitions:
        // stage 0 -> stage 1
        // stage 1 -> stage 2
        // stage 1 -> stage 3 (Won)
        // stage 1 -> stage 4 (Lost)
        // stage 2 -> stage 3 (Won)
        const transitionsData = [
          { fromIdx: 0, toIdx: 1 },
          { fromIdx: 1, toIdx: 2 },
          { fromIdx: 1, toIdx: 3 },
          { fromIdx: 1, toIdx: 4 },
          { fromIdx: 2, toIdx: 3 },
        ];

        for (const t of transitionsData) {
          await this.db.getClient().pipelineTransition.create({
            data: {
              pipeline_definition_id: created.id,
              from_stage_id: stageIds[t.fromIdx]!,
              to_stage_id: stageIds[t.toIdx]!,
            },
          });
        }

        pipeline = await this.db.getClient().pipelineDefinition.findFirst({
          where: { id: created.id },
          include: {
            stages: { orderBy: { order: 'asc' } },
            transitions: true,
          },
        });
      }

      return ok(pipeline);
    } catch (e: any) {
      return err({
        code: 'TRANSACTION_FAILED',
        message: e?.message ?? 'Failed to retrieve or initialize default pipeline',
      });
    }
  }

  async getStages(id: string): Promise<Result<any[], WorkflowError>> {
    try {
      const pipeline = await this.db.getClient().pipelineDefinition.findFirst({
        where: { id },
        include: { stages: { orderBy: { order: 'asc' } } },
      });

      if (!pipeline) {
        return err({ code: 'NOT_FOUND', message: 'Pipeline not found' });
      }

      return ok(pipeline.stages);
    } catch (e: any) {
      return err({
        code: 'TRANSACTION_FAILED',
        message: e?.message ?? 'Failed to retrieve pipeline stages',
      });
    }
  }

  async update(
    id: string,
    data: { name: string; stages: any[]; transitions: any[] },
  ): Promise<Result<any, WorkflowError>> {
    try {
      const pipeline = await this.db.getClient().pipelineDefinition.findFirst({
        where: { id },
      });

      if (!pipeline) {
        return err({ code: 'NOT_FOUND', message: 'Pipeline not found' });
      }

      const result = await this.db.getClient().$transaction(async (tx) => {
        // 1. Update pipeline definition details
        await tx.pipelineDefinition.update({
          where: { id },
          data: { name: data.name },
        });

        // 2. Fetch existing stages
        const existingStages = await tx.pipelineStage.findMany({
          where: { pipeline_definition_id: id },
        });

        const inputStageIds = data.stages.map((s) => s.id).filter((sid) => sid && !sid.startsWith('stage_'));
        const stagesToDelete = existingStages.filter((s) => !inputStageIds.includes(s.id));

        // Delete removed stages (and cascade transitions)
        if (stagesToDelete.length > 0) {
          const deleteIds = stagesToDelete.map((s) => s.id);
          await tx.pipelineTransition.deleteMany({
            where: {
              OR: [
                { from_stage_id: { in: deleteIds } },
                { to_stage_id: { in: deleteIds } },
              ],
            },
          });
          await tx.pipelineStage.deleteMany({
            where: { id: { in: deleteIds } },
          });
        }

        // Map UI temporary IDs to real DB stage IDs
        const stageIdMap = new Map<string, string>();

        for (const inputStage of data.stages) {
          const isTempId = !inputStage.id || inputStage.id.startsWith('stage_');
          
          if (isTempId) {
            const created = await tx.pipelineStage.create({
              data: {
                pipeline_definition_id: id,
                name: inputStage.name,
                order: inputStage.order,
                sla_hours: inputStage.sla_hours,
                terminal_outcome: inputStage.terminal_outcome ?? null,
                entry_criteria: inputStage.entry_criteria ? JSON.parse(JSON.stringify(inputStage.entry_criteria)) : '[]',
              },
            });
            stageIdMap.set(inputStage.id, created.id);
          } else {
            await tx.pipelineStage.update({
              where: { id: inputStage.id },
              data: {
                name: inputStage.name,
                order: inputStage.order,
                sla_hours: inputStage.sla_hours,
                terminal_outcome: inputStage.terminal_outcome ?? null,
                entry_criteria: inputStage.entry_criteria ? JSON.parse(JSON.stringify(inputStage.entry_criteria)) : '[]',
              },
            });
            stageIdMap.set(inputStage.id, inputStage.id);
          }
        }

        // 3. Re-create all transitions
        // First delete all transitions for this pipeline
        await tx.pipelineTransition.deleteMany({
          where: { pipeline_definition_id: id },
        });

        // Insert new transitions, resolving any temp IDs
        for (const inputTrans of data.transitions) {
          const fromId = stageIdMap.get(inputTrans.from_stage_id) || inputTrans.from_stage_id;
          const toId = stageIdMap.get(inputTrans.to_stage_id) || inputTrans.to_stage_id;

          if (fromId && toId) {
            await tx.pipelineTransition.create({
              data: {
                pipeline_definition_id: id,
                from_stage_id: fromId,
                to_stage_id: toId,
                triggers: inputTrans.triggers ? JSON.parse(JSON.stringify(inputTrans.triggers)) : '[]',
              },
            });
          }
        }

        return tx.pipelineDefinition.findFirst({
          where: { id },
          include: {
            stages: { orderBy: { order: 'asc' } },
            transitions: true,
          },
        });
      });

      return ok(result);
    } catch (e: any) {
      return err({
        code: 'TRANSACTION_FAILED',
        message: e?.message ?? 'Failed to update pipeline transaction',
      });
    }
  }

  async delete(id: string): Promise<Result<void, WorkflowError>> {
    try {
      const dbClient = this.db.getClient();

      // 1. Fetch pipeline definition
      const pipeline = await dbClient.pipelineDefinition.findFirst({
        where: { id },
      });

      if (!pipeline) {
        return err({ code: 'NOT_FOUND', message: 'Pipeline not found' });
      }

      // 2. Prevent deleting the only pipeline
      const totalPipelines = await dbClient.pipelineDefinition.count();
      if (totalPipelines <= 1) {
        return err({
          code: 'VALIDATION_ERROR',
          message: 'Cannot delete the only pipeline: a CRM tenant must have at least one pipeline.'
        });
      }

      // 3. Check for linked active campaigns
      const campaignsCount = await dbClient.campaign.count({
        where: { pipeline_id: id },
      });

      if (campaignsCount > 0) {
        return err({
          code: 'VALIDATION_ERROR',
          message: `Cannot delete pipeline: it is linked to ${campaignsCount} active campaign(s).`
        });
      }

      // 4. Check for linked leads
      const leadsCount = await dbClient.lead.count({
        where: { pipeline_definition_id: id },
      });

      if (leadsCount > 0) {
        return err({
          code: 'VALIDATION_ERROR',
          message: `Cannot delete pipeline: it is linked to ${leadsCount} active lead(s).`
        });
      }

      // 5. Delete in a transaction: transitions, stages, and then the definition itself
      await dbClient.$transaction(async (tx) => {
        await tx.pipelineTransition.deleteMany({
          where: { pipeline_definition_id: id },
        });

        await tx.pipelineStage.deleteMany({
          where: { pipeline_definition_id: id },
        });

        await tx.pipelineDefinition.delete({
          where: { id },
        });
      });

      return ok(undefined);
    } catch (e: any) {
      return err({
        code: 'TRANSACTION_FAILED',
        message: e?.message ?? 'Failed to delete pipeline',
      });
    }
  }
}
