import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AppointmentReminderService, CaseStageChangedPayload } from './appointment-reminder.service';
import { healthcarePluginManifest } from './manifest';
import { z } from 'zod';

const PluginManifestSchema = z.object({
  id: z.string().min(1, 'Manifest id is required'),
  name: z.string().min(1, 'Manifest name is required'),
  description: z.string().min(1, 'Manifest description is required'),
  compatible_industries: z
    .array(z.string())
    .min(1, 'At least one compatible industry required'),
  hooks: z.array(z.string()).optional().default([]),
  extends: z.array(z.string()).optional().default([]),
});

describe('Healthcare Plugin', () => {
  describe('Manifest validation', () => {
    it('validates against Zod schema', () => {
      const result = PluginManifestSchema.safeParse(healthcarePluginManifest);
      expect(result.success).toBe(true);
    });

    it('has correct hooks', () => {
      expect(healthcarePluginManifest.hooks).toContain('case:stage_changed');
    });

    it('has correct compatible industries', () => {
      expect(healthcarePluginManifest.compatible_industries).toContain('healthcare');
    });
  });

  describe('AppointmentReminderService', () => {
    let service: AppointmentReminderService;
    let eventEmitter: EventEmitter2;
    let mockQueue: Partial<Queue>;

    beforeEach(async () => {
      mockQueue = {
        add: vi.fn().mockResolvedValue({ id: 'job-1' }),
      };

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          BullModule.registerQueue({
            name: 'appointment-reminders',
          }),
        ],
        providers: [
          AppointmentReminderService,
          EventEmitter2,
        ],
      })
        .overrideProvider(getQueueToken('appointment-reminders'))
        .useValue(mockQueue)
        .compile();

      service = module.get(AppointmentReminderService);
      eventEmitter = module.get(EventEmitter2);
    });

    it('enqueues BullMQ job when stage changes to appointment_scheduled', async () => {
      const appointmentDate = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

      const payload: CaseStageChangedPayload = {
        case_id: 'case-1',
        from_stage: 'stage-intake',
        to_stage: 'stage-appt',
        to_stage_name: 'appointment_scheduled',
        tenant_id: 'tenant-1',
        actor_id: 'user-1',
        case_attributes: { appointment_date: appointmentDate },
        party_phone: '+1234567890',
      };

      await service.handleStageChanged(payload);

      expect(mockQueue.add).toHaveBeenCalledWith(
        'send-appointment-reminder',
        {
          case_id: 'case-1',
          tenant_id: 'tenant-1',
          party_phone: '+1234567890',
          appointment_date: appointmentDate,
        },
        expect.objectContaining({ delay: expect.any(Number) }),
      );
    });

    it('does not enqueue job when stage is not appointment_scheduled', async () => {
      const payload: CaseStageChangedPayload = {
        case_id: 'case-2',
        from_stage: 'stage-intake',
        to_stage: 'stage-followup',
        to_stage_name: 'follow_up',
        tenant_id: 'tenant-1',
        actor_id: 'user-1',
        case_attributes: {},
      };

      await service.handleStageChanged(payload);

      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('does not enqueue job when appointment_date is missing', async () => {
      const payload: CaseStageChangedPayload = {
        case_id: 'case-3',
        from_stage: 'stage-intake',
        to_stage: 'stage-appt',
        to_stage_name: 'appointment_scheduled',
        tenant_id: 'tenant-1',
        actor_id: 'user-1',
        case_attributes: { other_field: 'value' },
      };

      await service.handleStageChanged(payload);

      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('enqueues job with correct delay (24h before appointment)', async () => {
      const appointmentDate = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

      const payload: CaseStageChangedPayload = {
        case_id: 'case-4',
        from_stage: 'stage-intake',
        to_stage: 'stage-appt',
        to_stage_name: 'appointment_scheduled',
        tenant_id: 'tenant-1',
        actor_id: 'user-1',
        case_attributes: { appointment_date: appointmentDate },
        party_phone: '+1234567890',
      };

      await service.handleStageChanged(payload);

      const callArgs = (mockQueue.add as any).mock.calls[0];
      const delay = callArgs[2].delay;

      const expectedDelay = new Date(appointmentDate).getTime() - 24 * 60 * 60 * 1000 - Date.now();
      expect(delay).toBeCloseTo(expectedDelay, -2);
    });
  });
});
