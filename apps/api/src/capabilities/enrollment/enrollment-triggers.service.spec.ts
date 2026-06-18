import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { EnrollmentTriggersService } from './enrollment-triggers.service';
import { TenantScopedPrismaService } from '../../core/tenant/tenant-scoped-prisma.service';
import type { MessagingAdapter } from '../../core/communication/messaging-adapter.interface';

describe('EnrollmentTriggersService', () => {
  let service: EnrollmentTriggersService;
  let eventEmitter: EventEmitter2;
  let mockDb: any;
  let mockMessagingAdapter: MessagingAdapter;
  let mockCls: any;

  const mockScope = {
    user_id: 'user-1',
    tenant_id: 'tenant-1',
    assignment_ids: [],
    role: 'tenant_admin',
  };

  beforeEach(async () => {
    mockDb = {
      getClient: vi.fn().mockReturnValue({
        lead: {
          findUnique: vi.fn(),
        },
        pipelineStage: {
          findUnique: vi.fn(),
        },
        interaction: {
          create: vi.fn(),
        },
        tenantPlugin: {
          findFirst: vi.fn(),
        },
        tenant: {
          findFirst: vi.fn(),
        },
      }),
    };

    mockMessagingAdapter = {
      send: vi.fn().mockResolvedValue({ isOk: () => true, value: { message_id: 'msg-1' } }),
    };

    mockCls = {
      get: vi.fn().mockReturnValue(mockScope),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnrollmentTriggersService,
        { provide: TenantScopedPrismaService, useValue: mockDb },
        { provide: 'MESSAGING_ADAPTER', useValue: mockMessagingAdapter },
        { provide: ClsService, useValue: mockCls },
        EventEmitter2,
      ],
    }).compile();

    service = module.get(EnrollmentTriggersService);
    eventEmitter = module.get(EventEmitter2);

    mockDb.getClient().tenant.findFirst.mockResolvedValue({
      id: 'tenant-1',
      config_json: { enabled_capabilities: ['capability/enrollment'] },
    });
  });

  it('fires confirmation message when lead moves to Fee Paid stage', async () => {
    const leadPayload = {
      lead_id: 'lead-1',
      from_stage: 'stage-applied',
      to_stage: 'stage-fee-paid',
      tenant_id: 'tenant-1',
      actor_id: 'user-1',
    };

    mockDb.getClient().tenantPlugin.findFirst.mockResolvedValue({ id: 'plugin-1' });
    mockDb.getClient().lead.findUnique.mockResolvedValue({
      id: 'lead-1',
      party_id: 'party-1',
      attributes: { course_name: 'BSc Computer Science' },
      party: { phone_normalized: '+1234567890' },
    });
    mockDb.getClient().pipelineStage.findUnique.mockResolvedValue({ id: 'stage-fee-paid', name: 'Fee Paid' });

    await service.handleStageChanged(leadPayload);

    expect(mockMessagingAdapter.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '+1234567890',
        message: expect.stringContaining('BSc Computer Science'),
        tenant_id: 'tenant-1',
      }),
    );

    expect(mockDb.getClient().interaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          channel: 'whatsapp',
          direction: 'outbound',
        }),
      }),
    );
  });

  it('does not fire when capability is disabled for tenant', async () => {
    const leadPayload = {
      lead_id: 'lead-3',
      from_stage: 'stage-1',
      to_stage: 'stage-fee-paid',
      tenant_id: 'tenant-no-cap',
      actor_id: 'user-1',
    };

    mockDb.getClient().tenant.findFirst.mockResolvedValue({
      id: 'tenant-no-cap',
      config_json: { enabled_capabilities: [] },
    });
    mockDb.getClient().tenantPlugin.findFirst.mockResolvedValue(null);
    mockDb.getClient().lead.findUnique.mockResolvedValue({
      id: 'lead-3',
      party_id: 'party-3',
      attributes: {},
      party: { phone_normalized: '+1234567890' },
    });

    await service.handleStageChanged(leadPayload);

    expect(mockDb.getClient().lead.findUnique).not.toHaveBeenCalled();
    expect(mockMessagingAdapter.send).not.toHaveBeenCalled();
  });

  it('does not fire when stage is not Fee Paid', async () => {
    const leadPayload = {
      lead_id: 'lead-4',
      from_stage: 'stage-1',
      to_stage: 'stage-interview',
      tenant_id: 'tenant-1',
      actor_id: 'user-1',
    };

    mockDb.getClient().tenantPlugin.findFirst.mockResolvedValue({ id: 'plugin-1' });
    mockDb.getClient().lead.findUnique.mockResolvedValue({
      id: 'lead-4',
      party_id: 'party-4',
      attributes: {},
      party: { phone_normalized: '+1234567890' },
    });
    mockDb.getClient().pipelineStage.findUnique.mockResolvedValue({ id: 'stage-interview', name: 'Interview' });

    await service.handleStageChanged(leadPayload);

    expect(mockMessagingAdapter.send).not.toHaveBeenCalled();
  });
});
