import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { ClsService } from 'nestjs-cls';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';
import { HooksService } from '../hooks/hooks.service';
import { RoomManagerService } from '../realtime/room-manager.service';
import { CriteriaEvaluatorService } from './criteria-evaluator.service';
import type { RequestScope } from '../tenant/request-scope.interface';

export type TransitionErrorCode = 'CASE_NOT_FOUND' | 'UNAUTHORIZED' | 'INVALID_TRANSITION' | 'CRITERIA_UNMET' | 'TRANSACTION_FAILED';

export interface TransitionError {
  code: TransitionErrorCode;
  unmet?: string[];
  message?: string;
}

@Injectable()
export class StageTransitionService {
  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly cls: ClsService,
    private readonly criteriaEvaluator: CriteriaEvaluatorService,
    private readonly hooks: HooksService,
    private readonly roomManager: RoomManagerService,
    @InjectQueue('case-triggers') private readonly triggerQueue: Queue,
  ) {}

  async transitionStage(
    caseId: string,
    toStageId: string,
    actorId: string,
  ): Promise<Result<any, TransitionError>> {
    const scope = this.cls.get<RequestScope>('scope');

    // 1. Load case and verify ownership
    const caseRecord = await this.db.getClient().case.findUnique({
      where: { id: caseId },
      include: { party: true },
    });

    if (!caseRecord) {
      return err({ code: 'CASE_NOT_FOUND' } as TransitionError);
    }

    // 2. Load target stage and entry_criteria
    const targetStage = await this.db.getClient().workflowStage.findUnique({
      where: { id: toStageId },
    });

    if (!targetStage) {
      return err({ code: 'INVALID_TRANSITION', message: 'Target stage not found' } as TransitionError);
    }

    // 3. Evaluate entry criteria (before transaction)
    const criteria = Array.isArray(targetStage.entry_criteria) ? targetStage.entry_criteria : [];
    const evaluation = this.criteriaEvaluator.evaluate(
      criteria as any,
      (caseRecord.attributes ?? {}) as Record<string, unknown>,
    );

    if (!evaluation.passed) {
      return err({
        code: 'CRITERIA_UNMET',
        unmet: evaluation.unmet,
      } as TransitionError);
    }

    // 4. Verify transition exists in workflow_transitions
    const existingTransition = await this.db.getClient().workflowTransition.findFirst({
      where: {
        from_stage_id: caseRecord.stage,
        to_stage_id: toStageId,
      },
    });

    if (!existingTransition) {
      return err({
        code: 'INVALID_TRANSITION',
        message: `No transition from "${caseRecord.stage}" to "${toStageId}"`,
      } as TransitionError);
    }

    const fromStage = caseRecord.stage;

    // 5. Prisma transaction — both writes atomically
    try {
      await this.db.getClient().$transaction([
        this.db.getClient().case.update({
          where: { id: caseId },
          data: { stage: toStageId },
        }),
        this.db.getClient().caseEvent.create({
          data: {
            case_id: caseId,
            event_type: 'stage_changed',
            from_stage: fromStage,
            to_stage: toStageId,
            actor_id: actorId,
            actor_type: 'user',
          } as any,
        }),
      ]);
    } catch (e: any) {
      return err({
        code: 'TRANSACTION_FAILED',
        message: e?.message ?? 'Transaction failed',
      } as TransitionError);
    }

    // 6. Enqueue trigger execution (fire-and-forget, after commit)
    const triggers = Array.isArray(existingTransition.triggers) ? existingTransition.triggers : [];
    for (const trigger of triggers) {
      this.triggerQueue.add('execute-trigger', {
        caseId,
        fromStage,
        toStageId,
        trigger,
        tenantId: scope?.tenant_id,
      }).catch(() => {
        // Trigger failure is handled by the BullMQ processor, not here
      });
    }

    // 7. Trigger failure handling is in the BullMQ processor (separate file)
    // 8. Emit HooksService event (enriched payload for plugins)
    await this.hooks.emit('case:stage_changed', {
      case_id: caseId,
      from_stage: fromStage,
      to_stage: toStageId,
      to_stage_name: targetStage.name,
      tenant_id: scope?.tenant_id,
      actor_id: actorId,
      case_attributes: caseRecord.attributes,
      party_phone: caseRecord.party?.phone_normalized,
    });

    // 9. Emit Socket.io event to tenant room
    if (scope?.tenant_id) {
      this.roomManager.broadcastToTenant(scope.tenant_id, 'case:stage_changed', {
        case_id: caseId,
        to_stage: toStageId,
      });
    }

    const updatedCase = await this.db.getClient().case.findUnique({
      where: { id: caseId },
    });

    return ok(updatedCase);
  }
}
