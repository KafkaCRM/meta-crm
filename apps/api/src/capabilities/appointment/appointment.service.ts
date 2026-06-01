import { Injectable, Logger } from '@nestjs/common';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../../core/tenant/tenant-scoped-prisma.service';
import { ClsService } from 'nestjs-cls';
import { HooksService } from '../../core/hooks/hooks.service';
import type { RequestScope } from '../../core/tenant/request-scope.interface';
import * as dayjs from 'dayjs';

export type AppointmentErrorCode = 'QUERY_FAILED' | 'NOT_FOUND' | 'TENANT_NOT_FOUND' | 'INVALID_DATE';

export interface AppointmentError {
  code: AppointmentErrorCode;
  message?: string;
}

export interface CreateAppointmentDto {
  party_id: string;
  user_id?: string;
  title: string;
  description?: string;
  start_time: Date;
  end_time: Date;
  room?: string;
}

export interface UpdateAppointmentDto {
  title?: string;
  description?: string;
  start_time?: Date;
  end_time?: Date;
  room?: string;
  status?: string;
}

@Injectable()
export class AppointmentService {
  private readonly logger = new Logger(AppointmentService.name);

  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly cls: ClsService,
    private readonly hooks: HooksService,
  ) {}

  private getTenantId(): string | null {
    const scope = this.cls.get<RequestScope>('scope');
    return scope?.tenant_id ?? null;
  }

  async listAppointments(filters: {
    party_id?: string;
    user_id?: string;
    start?: string;
    end?: string;
  }): Promise<Result<any[], AppointmentError>> {
    try {
      const tenantId = this.getTenantId();
      if (!tenantId) {
        return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant context missing' });
      }

      const where: any = { tenant_id: tenantId };

      if (filters.party_id) {
        where.party_id = filters.party_id;
      }
      if (filters.user_id) {
        where.user_id = filters.user_id;
      }
      if (filters.start || filters.end) {
        where.start_time = {};
        if (filters.start) {
          where.start_time.gte = new Date(filters.start);
        }
        if (filters.end) {
          where.start_time.lte = new Date(filters.end);
        }
      }

      const appointments = await this.db.getClient().appointment.findMany({
        where,
        orderBy: { start_time: 'asc' },
        include: {
          party: {
            select: { id: true, name: true, email: true, phone_normalized: true },
          },
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      return ok(appointments);
    } catch (e) {
      this.logger.error('Error listing appointments', (e as Error).stack);
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async getAppointment(id: string): Promise<Result<any, AppointmentError>> {
    try {
      const tenantId = this.getTenantId();
      if (!tenantId) {
        return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant context missing' });
      }

      const appointment = await this.db.getClient().appointment.findFirst({
        where: { id, tenant_id: tenantId },
        include: {
          party: true,
          user: true,
        },
      });

      if (!appointment) {
        return err({ code: 'NOT_FOUND', message: 'Appointment not found' });
      }

      return ok(appointment);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async createAppointment(dto: CreateAppointmentDto): Promise<Result<any, AppointmentError>> {
    try {
      const tenantId = this.getTenantId();
      if (!tenantId) {
        return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant context missing' });
      }

      const appointment = await this.db.getClient().appointment.create({
        data: {
          tenant_id: tenantId,
          party_id: dto.party_id,
          user_id: dto.user_id,
          title: dto.title,
          description: dto.description,
          start_time: dto.start_time,
          end_time: dto.end_time,
          room: dto.room,
        },
        include: {
          party: true,
          user: true,
        },
      });

      await this.hooks.emit('appointment:created', appointment);

      return ok(appointment);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async updateAppointment(id: string, dto: UpdateAppointmentDto): Promise<Result<any, AppointmentError>> {
    try {
      const tenantId = this.getTenantId();
      if (!tenantId) {
        return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant context missing' });
      }

      const appointmentExists = await this.db.getClient().appointment.findFirst({
        where: { id, tenant_id: tenantId },
      });

      if (!appointmentExists) {
        return err({ code: 'NOT_FOUND', message: 'Appointment not found' });
      }

      const updated = await this.db.getClient().appointment.update({
        where: { id },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.start_time !== undefined && { start_time: dto.start_time }),
          ...(dto.end_time !== undefined && { end_time: dto.end_time }),
          ...(dto.room !== undefined && { room: dto.room }),
          ...(dto.status !== undefined && { status: dto.status }),
        },
        include: {
          party: true,
          user: true,
        },
      });

      await this.hooks.emit('appointment:updated', updated);

      return ok(updated);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async getAvailableSlots(dateStr: string, userId?: string): Promise<Result<any[], AppointmentError>> {
    try {
      const tenantId = this.getTenantId();
      if (!tenantId) {
        return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant context missing' });
      }

      const date = dayjs(dateStr);
      if (!date.isValid()) {
        return err({ code: 'INVALID_DATE', message: 'Invalid date format' });
      }

      const startOfDay = date.startOf('day').toDate();
      const endOfDay = date.endOf('day').toDate();

      const existingAppointments = await this.db.getClient().appointment.findMany({
        where: {
          tenant_id: tenantId,
          ...(userId && { user_id: userId }),
          status: { not: 'cancelled' },
          start_time: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        select: {
          start_time: true,
          end_time: true,
        },
      });

      const slots: any[] = [];
      const workStart = 9; // 9 AM
      const workEnd = 17; // 5 PM
      const slotDurationMinutes = 30;

      let currentSlot = date.hour(workStart).minute(0).second(0).millisecond(0);
      const endWorkTime = date.hour(workEnd).minute(0).second(0).millisecond(0);

      while (currentSlot.isBefore(endWorkTime)) {
        const slotStart = currentSlot.toDate();
        const slotEnd = currentSlot.add(slotDurationMinutes, 'minute').toDate();

        const isOverlapping = existingAppointments.some((appt) => {
          const apptStart = new Date(appt.start_time);
          const apptEnd = new Date(appt.end_time);
          return (
            (slotStart >= apptStart && slotStart < apptEnd) ||
            (slotEnd > apptStart && slotEnd <= apptEnd) ||
            (slotStart <= apptStart && slotEnd >= apptEnd)
          );
        });

        slots.push({
          start_time: slotStart,
          end_time: slotEnd,
          available: !isOverlapping,
        });

        currentSlot = currentSlot.add(slotDurationMinutes, 'minute');
      }

      return ok(slots);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }
}
