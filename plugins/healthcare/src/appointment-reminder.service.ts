import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export interface CaseStageChangedPayload {
  case_id: string;
  from_stage: string;
  to_stage: string;
  to_stage_name: string;
  tenant_id?: string;
  actor_id?: string;
  case_attributes?: Record<string, unknown>;
  party_phone?: string;
  active_plugins?: string[];
}

@Injectable()
export class AppointmentReminderService implements OnModuleInit {
  private readonly logger = new Logger(AppointmentReminderService.name);

  constructor(
    @InjectQueue('appointment-reminders') private readonly reminderQueue: Queue,
  ) {}

  onModuleInit() {
    this.logger.log('Healthcare appointment reminder plugin loaded');
  }

  @OnEvent('case:before_stage_change')
  async handleBeforeStageChange(payload: any): Promise<{ blocked: boolean; reason?: string }> {
    if (!payload.active_plugins?.includes('plugin-healthcare')) {
      return { blocked: false };
    }

    if (payload.to_stage_name === 'appointment_scheduled') {
      const attrs = payload.case_attributes ?? {};
      const appointmentDate = attrs['appointment_date'] as string | undefined;

      if (!appointmentDate) {
        return {
          blocked: true,
          reason: 'Appointment Date is required to schedule an appointment',
        };
      }

      const dateVal = new Date(appointmentDate).getTime();
      if (isNaN(dateVal)) {
        return {
          blocked: true,
          reason: 'Appointment Date must be a valid date format',
        };
      }

      if (dateVal <= Date.now()) {
        return {
          blocked: true,
          reason: 'Appointment Date must be scheduled in the future',
        };
      }
    }

    return { blocked: false };
  }

  @OnEvent('case:stage_changed')
  async handleStageChanged(payload: CaseStageChangedPayload): Promise<void> {
    if (!payload.active_plugins?.includes('plugin-healthcare')) return;
    if (payload.to_stage_name !== 'appointment_scheduled') return;

    const attrs = payload.case_attributes ?? {};
    const appointmentDate = attrs['appointment_date'] as string | undefined;
    if (!appointmentDate) return;

    const reminderAt = new Date(appointmentDate).getTime() - 24 * 60 * 60 * 1000;
    const delay = reminderAt - Date.now();

    if (delay <= 0) {
      this.logger.warn(
        `Appointment date ${appointmentDate} is in the past, skipping reminder for case ${payload.case_id}`,
      );
      return;
    }

    await this.reminderQueue.add(
      'send-appointment-reminder',
      {
        case_id: payload.case_id,
        tenant_id: payload.tenant_id,
        party_phone: payload.party_phone,
        appointment_date: appointmentDate,
      },
      { delay },
    );

    this.logger.log(
      `Appointment reminder scheduled for case ${payload.case_id} at ${new Date(reminderAt).toISOString()}`,
    );
  }
}
