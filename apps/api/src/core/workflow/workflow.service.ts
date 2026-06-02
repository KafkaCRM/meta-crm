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

  async list(): Promise<Result<any[], WorkflowError>> {
    try {
      const workflows = await this.db.getClient().workflowDefinition.findMany({
        include: {
          stages: { orderBy: { order: 'asc' } },
        },
      });
      return ok(workflows);
    } catch (e: any) {
      return err({
        code: 'TRANSACTION_FAILED',
        message: e?.message ?? 'Failed to retrieve workflows',
      });
    }
  }

  async create(data: { name: string; entity_type?: string }): Promise<Result<any, WorkflowError>> {
    try {
      const scope = this.cls.get<RequestScope>('scope');
      const tenantId = scope?.tenant_id || '';

      const existing = await this.db.getClient().workflowDefinition.findFirst({
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

      const created = await this.db.getClient().workflowDefinition.create({
        data: {
          tenant_id: tenantId,
          name: data.name,
          entity_type: data.entity_type ?? 'appointment',
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
        await this.db.getClient().workflowStage.create({
          data: {
            workflow_definition_id: created.id,
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

      let workflow = await this.db.getClient().workflowDefinition.findFirst({
        include: {
          stages: { orderBy: { order: 'asc' } },
          transitions: true,
        },
      });

      if (!workflow) {
        // Initialize default workflow if none exists
        const created = await this.db.getClient().workflowDefinition.create({
          data: {
            tenant_id: tenantId,
            name: 'Patient Care Pipeline',
            entity_type: 'appointment',
          },
        });

        const stagesData = [
          { name: 'Appointment Scheduled', order: 0, sla_hours: 24, terminal_outcome: null },
          { name: 'Consultation', order: 1, sla_hours: null, terminal_outcome: null },
          { name: 'Follow-up', order: 2, sla_hours: null, terminal_outcome: null },
          { name: 'Closed Won', order: 3, sla_hours: null, terminal_outcome: 'won' },
          { name: 'Closed Lost', order: 4, sla_hours: null, terminal_outcome: 'lost' },
        ];

        const stageIds: string[] = [];
        for (const stage of stagesData) {
          const createdStage = await this.db.getClient().workflowStage.create({
            data: {
              workflow_definition_id: created.id,
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
          await this.db.getClient().workflowTransition.create({
            data: {
              workflow_definition_id: created.id,
              from_stage_id: stageIds[t.fromIdx]!,
              to_stage_id: stageIds[t.toIdx]!,
            },
          });
        }

        workflow = await this.db.getClient().workflowDefinition.findFirst({
          where: { id: created.id },
          include: {
            stages: { orderBy: { order: 'asc' } },
            transitions: true,
          },
        });
      }

      return ok(workflow);
    } catch (e: any) {
      return err({
        code: 'TRANSACTION_FAILED',
        message: e?.message ?? 'Failed to retrieve or initialize default workflow',
      });
    }
  }

  async update(
    id: string,
    data: { name: string; stages: any[]; transitions: any[] },
  ): Promise<Result<any, WorkflowError>> {
    try {
      const workflow = await this.db.getClient().workflowDefinition.findFirst({
        where: { id },
      });

      if (!workflow) {
        return err({ code: 'NOT_FOUND', message: 'Workflow definition not found' });
      }

      const result = await this.db.getClient().$transaction(async (tx) => {
        // 1. Update workflow definition details
        await tx.workflowDefinition.update({
          where: { id },
          data: { name: data.name },
        });

        // 2. Fetch existing stages
        const existingStages = await tx.workflowStage.findMany({
          where: { workflow_definition_id: id },
        });

        const inputStageIds = data.stages.map((s) => s.id).filter((sid) => sid && !sid.startsWith('stage_'));
        const stagesToDelete = existingStages.filter((s) => !inputStageIds.includes(s.id));

        // Delete removed stages (and cascade transitions)
        if (stagesToDelete.length > 0) {
          const deleteIds = stagesToDelete.map((s) => s.id);
          await tx.workflowTransition.deleteMany({
            where: {
              OR: [
                { from_stage_id: { in: deleteIds } },
                { to_stage_id: { in: deleteIds } },
              ],
            },
          });
          await tx.workflowStage.deleteMany({
            where: { id: { in: deleteIds } },
          });
        }

        // Map UI temporary IDs to real DB stage IDs
        const stageIdMap = new Map<string, string>();

        for (const inputStage of data.stages) {
          const isTempId = !inputStage.id || inputStage.id.startsWith('stage_');
          
          if (isTempId) {
            const created = await tx.workflowStage.create({
              data: {
                workflow_definition_id: id,
                name: inputStage.name,
                order: inputStage.order,
                sla_hours: inputStage.sla_hours,
                terminal_outcome: inputStage.terminal_outcome ?? null,
                entry_criteria: inputStage.entry_criteria ? JSON.parse(JSON.stringify(inputStage.entry_criteria)) : '[]',
              },
            });
            stageIdMap.set(inputStage.id, created.id);
          } else {
            await tx.workflowStage.update({
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
        // First delete all transitions for this workflow
        await tx.workflowTransition.deleteMany({
          where: { workflow_definition_id: id },
        });

        // Insert new transitions, resolving any temp IDs
        for (const inputTrans of data.transitions) {
          const fromId = stageIdMap.get(inputTrans.from_stage_id) || inputTrans.from_stage_id;
          const toId = stageIdMap.get(inputTrans.to_stage_id) || inputTrans.to_stage_id;

          if (fromId && toId) {
            await tx.workflowTransition.create({
              data: {
                workflow_definition_id: id,
                from_stage_id: fromId,
                to_stage_id: toId,
                triggers: inputTrans.triggers ? JSON.parse(JSON.stringify(inputTrans.triggers)) : '[]',
              },
            });
          }
        }

        return tx.workflowDefinition.findFirst({
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
        message: e?.message ?? 'Failed to update workflow transaction',
      });
    }
  }

  async delete(id: string): Promise<Result<void, WorkflowError>> {
    try {
      const dbClient = this.db.getClient();

      // 1. Fetch workflow definition
      const workflow = await dbClient.workflowDefinition.findFirst({
        where: { id },
      });

      if (!workflow) {
        return err({ code: 'NOT_FOUND', message: 'Workflow pipeline not found' });
      }

      // 2. Prevent deleting the only workflow
      const totalWorkflows = await dbClient.workflowDefinition.count();
      if (totalWorkflows <= 1) {
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

      // 4. Check for linked cases
      const casesCount = await dbClient.case.count({
        where: { workflow_definition_id: id },
      });

      if (casesCount > 0) {
        return err({
          code: 'VALIDATION_ERROR',
          message: `Cannot delete pipeline: it is linked to ${casesCount} active customer items (deals/cases).`
        });
      }

      // 5. Delete in a transaction: transitions, stages, and then the definition itself
      await dbClient.$transaction(async (tx) => {
        await tx.workflowTransition.deleteMany({
          where: { workflow_definition_id: id },
        });

        await tx.workflowStage.deleteMany({
          where: { workflow_definition_id: id },
        });

        await tx.workflowDefinition.delete({
          where: { id },
        });
      });

      return ok(undefined);
    } catch (e: any) {
      return err({
        code: 'TRANSACTION_FAILED',
        message: e?.message ?? 'Failed to delete workflow pipeline',
      });
    }
  }
}
