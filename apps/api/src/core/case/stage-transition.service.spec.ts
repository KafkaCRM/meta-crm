import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClsService } from 'nestjs-cls';
import { Queue } from 'bullmq';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';
import { HooksService } from '../hooks/hooks.service';
import { RoomManagerService } from '../realtime/room-manager.service';
import { CriteriaEvaluatorService } from './criteria-evaluator.service';
import { StageTransitionService } from './stage-transition.service';
import type { RequestScope } from '../tenant/request-scope.interface';

const { mockQueueAdd } = vi.hoisted(() => ({ mockQueueAdd: vi.fn().mockResolvedValue(undefined) }));

const scope: RequestScope = {
  user_id: 'user-1',
  tenant_id: 'tenant-a',
  assignment_ids: ['assign-1'],
  role: 'branch_user' as any,
};

const EXISTING_CASE = {
  id: 'case-1',
  tenant_id: 'tenant-a',
  stage: 'stage-1',
  party_id: 'party-1',
  type: 'enrollment',
  title: 'Test Case',
  workflow_definition_id: 'wf-1',
  branch_brand_assignment_id: 'assign-1',
  attributes: { score: 85 },
  created_at: new Date('2025-01-01'),
};

const TARGET_STAGE = {
  id: 'stage-2',
  workflow_definition_id: 'wf-1',
  name: 'Review',
  order: 2,
  entry_criteria: [],
};

const EXISTING_TRANSITION = {
  id: 'trans-1',
  workflow_definition_id: 'wf-1',
  from_stage_id: 'stage-1',
  to_stage_id: 'stage-2',
  triggers: [{ type: 'webhook', url: 'https://example.com/hook' }],
};

function buildMocks() {
  const client = {
    $transaction: vi.fn(),
    case: { findUnique: vi.fn(), update: vi.fn() },
    caseEvent: { create: vi.fn() },
    workflowStage: { findUnique: vi.fn() },
    workflowTransition: { findFirst: vi.fn() },
  };

  const db = { getClient: vi.fn().mockReturnValue(client) } as unknown as TenantScopedPrismaService;
  const cls = { get: vi.fn().mockReturnValue(scope) } as unknown as ClsService;
  const criteriaEvaluator = new CriteriaEvaluatorService();
  const hooks = { emit: vi.fn() } as unknown as HooksService;
  const roomManager = { broadcastToTenant: vi.fn() } as unknown as RoomManagerService;
  const triggerQueue = { add: mockQueueAdd } as unknown as Queue;

  return { client, db, cls, criteriaEvaluator, hooks, roomManager, triggerQueue };
}

describe('StageTransitionService', () => {
  let svc: StageTransitionService;
  let client: ReturnType<typeof buildMocks>['client'];
  let db: TenantScopedPrismaService;
  let cls: ClsService;
  let hooks: HooksService;
  let roomManager: RoomManagerService;
  let triggerQueue: Queue;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockQueueAdd.mockClear();
    const mocks = buildMocks();
    client = mocks.client;
    db = mocks.db;
    cls = mocks.cls;
    hooks = mocks.hooks;
    roomManager = mocks.roomManager;
    triggerQueue = mocks.triggerQueue;
    svc = new StageTransitionService(db, cls, mocks.criteriaEvaluator, hooks, roomManager, triggerQueue);
  });

  /* ------------------------------------------------------------------ */
  /*  Step 1 — Load case                                                  */
  /* ------------------------------------------------------------------ */
  it('returns CASE_NOT_FOUND when case does not exist', async () => {
    (client.case.findUnique as any).mockResolvedValue(null);

    const result = await svc.transitionStage('nonexistent', 'stage-2', 'user-1');
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('CASE_NOT_FOUND');
    }
  });

  /* ------------------------------------------------------------------ */
  /*  Step 2–3 — Load stage, evaluate criteria                            */
  /* ------------------------------------------------------------------ */
  it('returns CRITERIA_UNMET with unmet[] when entry criteria fail', async () => {
    (client.case.findUnique as any).mockResolvedValue(EXISTING_CASE);
    (client.workflowStage.findUnique as any).mockResolvedValue({
      ...TARGET_STAGE,
      entry_criteria: [
        { field: 'score', operator: 'gte', value: 90 },
        { field: 'verified', operator: 'eq', value: true },
      ],
    });

    const result = await svc.transitionStage('case-1', 'stage-2', 'user-1');
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('CRITERIA_UNMET');
      expect(result.error.unmet).toBeDefined();
      expect(result.error.unmet!.length).toBe(2);
    }
  });

  it('returns CRITERIA_UNMET with empty unmet when criteria is []', async () => {
    (client.case.findUnique as any).mockResolvedValue(EXISTING_CASE);
    // Missing workflowTransition — will trigger INVALID_TRANSITION instead
    (client.workflowStage.findUnique as any).mockResolvedValue(TARGET_STAGE);
    (client.workflowTransition.findFirst as any).mockResolvedValue(EXISTING_TRANSITION);
    (client.$transaction as any).mockImplementation(async (ops: any[]) => {
      for (const op of ops) await op;
    });
    (client.case.update as any).mockResolvedValue({ ...EXISTING_CASE, stage: 'stage-2' });
    (client.caseEvent.create as any).mockResolvedValue({ id: 'evt-1' });

    const result = await svc.transitionStage('case-1', 'stage-2', 'user-1');
    expect(result.isOk()).toBe(true);
  });

  /* ------------------------------------------------------------------ */
  /*  Step 4 — Verify transition exists                                    */
  /* ------------------------------------------------------------------ */
  it('returns INVALID_TRANSITION when no transition defined', async () => {
    (client.case.findUnique as any).mockResolvedValue(EXISTING_CASE);
    (client.workflowStage.findUnique as any).mockResolvedValue(TARGET_STAGE);
    (client.workflowTransition.findFirst as any).mockResolvedValue(null);

    const result = await svc.transitionStage('case-1', 'stage-2', 'user-1');
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('INVALID_TRANSITION');
    }
  });

  /* ------------------------------------------------------------------ */
  /*  Step 5 — Prisma transaction (array + rollback proof)                */
  /* ------------------------------------------------------------------ */
  describe('transaction atomicity', () => {
    it('successful transition: case.stage updated AND case_events written in same transaction', async () => {
      (client.case.findUnique as any).mockResolvedValue(EXISTING_CASE);
      (client.workflowStage.findUnique as any).mockResolvedValue(TARGET_STAGE);
      (client.workflowTransition.findFirst as any).mockResolvedValue(EXISTING_TRANSITION);

      let transactionRan = false;
      (client.$transaction as any).mockImplementation(async (ops: any[]) => {
        transactionRan = true;
        const results: any[] = [];
        for (const op of ops) results.push(await op);
        return results;
      });
      (client.case.update as any).mockResolvedValue({ ...EXISTING_CASE, stage: 'stage-2' });
      (client.caseEvent.create as any).mockResolvedValue({ id: 'evt-1' });

      const result = await svc.transitionStage('case-1', 'stage-2', 'user-1');

      expect(result.isOk()).toBe(true);
      expect(transactionRan).toBe(true);
      expect(client.case.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'case-1' },
          data: { stage: 'stage-2' },
        }),
      );
      expect(client.caseEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            case_id: 'case-1',
            event_type: 'stage_changed',
            from_stage: 'stage-1',
            to_stage: 'stage-2',
          }),
        }),
      );
    });

    it('rolls back case.stage when case_events insert fails — both writes atomic', async () => {
      (client.case.findUnique as any).mockResolvedValue(EXISTING_CASE);
      (client.workflowStage.findUnique as any).mockResolvedValue(TARGET_STAGE);
      (client.workflowTransition.findFirst as any).mockResolvedValue(EXISTING_TRANSITION);

      // case.update would succeed but caseEvent.create fails
      (client.case.update as any).mockResolvedValue({ ...EXISTING_CASE, stage: 'stage-2' });
      (client.caseEvent.create as any).mockRejectedValue(new Error('DB constraint violation'));

      // $transaction mock executes operations sequentially — if any fails, transaction fails
      (client.$transaction as any).mockImplementation(async (ops: any[]) => {
        const results: any[] = [];
        for (const op of ops) {
          results.push(await op);
        }
        return results;
      });

      const result = await svc.transitionStage('case-1', 'stage-2', 'user-1');

      // Error propagates
      expect(result.isErr()).toBe(true);

      // Both operations were attempted inside the transaction
      expect(client.case.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'case-1' },
          data: { stage: 'stage-2' },
        }),
      );
      expect(client.caseEvent.create).toHaveBeenCalled();

      // Reading the case after Rollback returns the OLD stage
      (client.case.findUnique as any).mockResolvedValue({ ...EXISTING_CASE, stage: 'stage-1' });
      const freshCase = await svc['db'].getClient().case.findUnique({ where: { id: 'case-1' } });
      expect(freshCase?.stage).toBe('stage-1');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Step 6 — Trigger enqueue (after commit, fire-and-forget)            */
  /* ------------------------------------------------------------------ */
  it('enqueues BullMQ job for each trigger after successful transition', async () => {
    (client.case.findUnique as any).mockResolvedValue(EXISTING_CASE);
    (client.workflowStage.findUnique as any).mockResolvedValue(TARGET_STAGE);
    (client.workflowTransition.findFirst as any).mockResolvedValue(EXISTING_TRANSITION);
    (client.$transaction as any).mockImplementation(async (ops: any[]) => {
      for (const op of ops) await op;
    });
    (client.case.update as any).mockResolvedValue({ ...EXISTING_CASE, stage: 'stage-2' });
    (client.caseEvent.create as any).mockResolvedValue({ id: 'evt-1' });

    await svc.transitionStage('case-1', 'stage-2', 'user-1');

    expect(mockQueueAdd).toHaveBeenCalledWith('execute-trigger', {
      caseId: 'case-1',
      fromStage: 'stage-1',
      toStageId: 'stage-2',
      trigger: { type: 'webhook', url: 'https://example.com/hook' },
      tenantId: 'tenant-a',
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Step 8 — HooksService emit                                          */
  /* ------------------------------------------------------------------ */
  it('emits HooksService event after successful transition', async () => {
    (client.case.findUnique as any).mockResolvedValue(EXISTING_CASE);
    (client.workflowStage.findUnique as any).mockResolvedValue(TARGET_STAGE);
    (client.workflowTransition.findFirst as any).mockResolvedValue(EXISTING_TRANSITION);
    (client.$transaction as any).mockImplementation(async (ops: any[]) => {
      for (const op of ops) await op;
    });
    (client.case.update as any).mockResolvedValue({ ...EXISTING_CASE, stage: 'stage-2' });
    (client.caseEvent.create as any).mockResolvedValue({ id: 'evt-1' });

    await svc.transitionStage('case-1', 'stage-2', 'user-1');

    expect(hooks.emit).toHaveBeenCalledWith('case:stage_changed', {
      case_id: 'case-1',
      from_stage: 'stage-1',
      to_stage: 'stage-2',
      to_stage_name: 'Review',
      tenant_id: 'tenant-a',
      actor_id: 'user-1',
      case_attributes: { score: 85 },
      party_phone: undefined,
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Step 9 — Socket.io broadcast                                        */
  /* ------------------------------------------------------------------ */
  it('broadcasts Socket.io event to tenant room after transition', async () => {
    (client.case.findUnique as any).mockResolvedValue(EXISTING_CASE);
    (client.workflowStage.findUnique as any).mockResolvedValue(TARGET_STAGE);
    (client.workflowTransition.findFirst as any).mockResolvedValue(EXISTING_TRANSITION);
    (client.$transaction as any).mockImplementation(async (ops: any[]) => {
      for (const op of ops) await op;
    });
    (client.case.update as any).mockResolvedValue({ ...EXISTING_CASE, stage: 'stage-2' });
    (client.caseEvent.create as any).mockResolvedValue({ id: 'evt-1' });

    await svc.transitionStage('case-1', 'stage-2', 'user-1');

    expect(roomManager.broadcastToTenant).toHaveBeenCalledWith(
      'tenant-a',
      'case:stage_changed',
      { case_id: 'case-1', to_stage: 'stage-2' },
    );
  });

  /* ------------------------------------------------------------------ */
  /*  No DB writes when criteria fails                                    */
  /* ------------------------------------------------------------------ */
  it('does not perform any DB write when CRITERIA_UNMET', async () => {
    (client.case.findUnique as any).mockResolvedValue(EXISTING_CASE);
    (client.workflowStage.findUnique as any).mockResolvedValue({
      ...TARGET_STAGE,
      entry_criteria: [{ field: 'score', operator: 'gte', value: 90 }],
    });

    const result = await svc.transitionStage('case-1', 'stage-2', 'user-1');

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('CRITERIA_UNMET');
    }
    expect(client.case.update).not.toHaveBeenCalled();
    expect(client.caseEvent.create).not.toHaveBeenCalled();
    expect(client.$transaction).not.toHaveBeenCalled();
  });

  it('does not perform any DB write when INVALID_TRANSITION', async () => {
    (client.case.findUnique as any).mockResolvedValue(EXISTING_CASE);
    (client.workflowStage.findUnique as any).mockResolvedValue(TARGET_STAGE);
    (client.workflowTransition.findFirst as any).mockResolvedValue(null);

    const result = await svc.transitionStage('case-1', 'stage-2', 'user-1');

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('INVALID_TRANSITION');
    }
    expect(client.case.update).not.toHaveBeenCalled();
    expect(client.caseEvent.create).not.toHaveBeenCalled();
    expect(client.$transaction).not.toHaveBeenCalled();
  });
});
