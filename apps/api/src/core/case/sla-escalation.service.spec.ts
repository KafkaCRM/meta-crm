import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlatformPrismaService } from '../tenant/platform-prisma.service';
import { HooksService } from '../hooks/hooks.service';
import { RoomManagerService } from '../realtime/room-manager.service';
import { SlaEscalationService } from './sla-escalation.service';

describe('SlaEscalationService', () => {
  let service: SlaEscalationService;
  let mockPlatformDb: any;
  let mockHooks: any;
  let mockRoomManager: any;

  beforeEach(() => {
    mockPlatformDb = {
      client: {
        pipelineStage: {
          findMany: vi.fn(),
        },
        case: {
          findMany: vi.fn(),
          update: vi.fn(),
        },
        caseEvent: {
          create: vi.fn(),
        },
      },
    };

    mockHooks = {
      emit: vi.fn().mockResolvedValue(undefined),
    };

    mockRoomManager = {
      broadcastToTenant: vi.fn(),
    };

    service = new SlaEscalationService(
      mockPlatformDb as unknown as PlatformPrismaService,
      mockHooks as unknown as HooksService,
      mockRoomManager as unknown as RoomManagerService,
    );
  });

  it('does nothing if no stages have SLAs', async () => {
    mockPlatformDb.client.pipelineStage.findMany.mockResolvedValue([]);

    await service.checkSlas();

    expect(mockPlatformDb.client.pipelineStage.findMany).toHaveBeenCalled();
    expect(mockPlatformDb.client.case.findMany).not.toHaveBeenCalled();
  });

  it('processes and escalates breached cases, skipping already breached ones', async () => {
    const mockStages = [
      { id: 'stage-1', name: 'Enquiry', sla_hours: 24 },
    ];
    mockPlatformDb.client.pipelineStage.findMany.mockResolvedValue(mockStages);

    const mockCases = [
      {
        id: 'case-1',
        title: 'Already Breached Case',
        tenant_id: 'tenant-1',
        stage: 'stage-1',
        last_stage_changed_at: new Date(Date.now() - 30 * 60 * 60 * 1000), // 30h ago
        attributes: { sla_breached: true },
      },
      {
        id: 'case-2',
        title: 'Newly Breached Case',
        tenant_id: 'tenant-1',
        stage: 'stage-1',
        last_stage_changed_at: new Date(Date.now() - 30 * 60 * 60 * 1000), // 30h ago
        attributes: { priority: 'high' },
      },
    ];
    mockPlatformDb.client.case.findMany.mockResolvedValue(mockCases);
    mockPlatformDb.client.case.update.mockResolvedValue({ id: 'case-2' });
    mockPlatformDb.client.caseEvent.create.mockResolvedValue({ id: 'evt-1' });

    await service.checkSlas();

    // Checked stages with SLAs
    expect(mockPlatformDb.client.pipelineStage.findMany).toHaveBeenCalled();
    
    // Queried cases in breached stage
    expect(mockPlatformDb.client.case.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          stage: 'stage-1',
        }),
      }),
    );

    // Should ONLY update case-2 (case-1 already has sla_breached: true)
    expect(mockPlatformDb.client.case.update).toHaveBeenCalledTimes(1);
    expect(mockPlatformDb.client.case.update).toHaveBeenCalledWith({
      where: { id: 'case-2' },
      data: {
        attributes: expect.objectContaining({
          priority: 'high',
          sla_breached: true,
        }),
      },
    });

    // Created audit caseEvent
    expect(mockPlatformDb.client.caseEvent.create).toHaveBeenCalledTimes(1);
    expect(mockPlatformDb.client.caseEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          case_id: 'case-2',
          event_type: 'sla_breached',
          actor_id: 'system',
        }),
      }),
    );

    // Broadcasted to socket room
    expect(mockRoomManager.broadcastToTenant).toHaveBeenCalledWith(
      'tenant-1',
      'case:sla_breached',
      expect.objectContaining({
        case_id: 'case-2',
        stage_id: 'stage-1',
      }),
    );

    // Emitted hook event
    expect(mockHooks.emit).toHaveBeenCalledWith(
      'case:sla_breached',
      expect.objectContaining({
        case_id: 'case-2',
        tenant_id: 'tenant-1',
        stage_name: 'Enquiry',
      }),
    );
  });
});
