import { Injectable } from '@nestjs/common';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../../core/tenant/tenant-scoped-prisma.service';
import { ClsService } from 'nestjs-cls';
import type { RequestScope } from '../../core/tenant/request-scope.interface';

export type CallLogsErrorCode = 'NOT_FOUND' | 'QUERY_FAILED';
export interface CallLogsError { code: CallLogsErrorCode; message?: string }

@Injectable()
export class CallLogsService {
  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly cls: ClsService,
  ) {}

  private getTenantId(): string | null {
    const scope = this.cls.get<RequestScope>('scope');
    return scope?.tenant_id ?? null;
  }

  async create(data: {
    direction: string; from_number: string; to_number: string;
    party_id?: string; lead_id?: string; user_id?: string;
    duration_secs?: number; status?: string; recording_url?: string;
    twilio_call_sid?: string; notes?: string; started_at?: string; ended_at?: string;
  }): Promise<Result<any, CallLogsError>> {
    try {
      const tenantId = this.getTenantId();
      if (!tenantId) return err({ code: 'QUERY_FAILED', message: 'Tenant context missing' });

      const call = await this.db.getClient().callLog.create({
        data: { tenant_id: tenantId, ...data } as any,
      });
      return ok(call);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async findAll(params: {
    party_id?: string; lead_id?: string; user_id?: string;
    direction?: string; from_date?: string; to_date?: string;
    cursor?: string; limit?: number;
  }): Promise<Result<{ data: any[]; next_cursor: string | undefined }, CallLogsError>> {
    try {
      const limit = Math.min(params.limit ?? 50, 100);
      const where: Record<string, unknown> = {};
      if (params.party_id) where.party_id = params.party_id;
      if (params.lead_id) where.lead_id = params.lead_id;
      if (params.user_id) where.user_id = params.user_id;
      if (params.direction) where.direction = params.direction;

      const dateFilter: Record<string, unknown> = {};
      if (params.from_date) dateFilter.gte = new Date(params.from_date);
      if (params.to_date) dateFilter.lte = new Date(params.to_date);
      if (Object.keys(dateFilter).length) where.started_at = dateFilter;

      const calls = await this.db.getClient().callLog.findMany({
        where,
        take: limit + 1,
        ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
        orderBy: { started_at: 'desc' },
        include: {
          party: { select: { id: true, name: true, phone_raw: true } },
          lead: { select: { id: true, name: true } },
          user: { select: { id: true, name: true } },
        },
      });

      const hasMore = calls.length > limit;
      const data = hasMore ? calls.slice(0, limit) : calls;
      return ok({ data, next_cursor: hasMore ? data[data.length - 1]?.id : undefined });
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async findOne(id: string): Promise<Result<any, CallLogsError>> {
    try {
      const call = await this.db.getClient().callLog.findUnique({
        where: { id },
        include: {
          party: { select: { id: true, name: true, phone_raw: true } },
          lead: { select: { id: true, name: true } },
          user: { select: { id: true, name: true } },
        },
      });
      if (!call) return err({ code: 'NOT_FOUND', message: 'Call log not found' });
      return ok(call);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async update(id: string, data: Partial<{
    duration_secs: number; status: string; recording_url: string; notes: string; ended_at: string;
  }>): Promise<Result<any, CallLogsError>> {
    try {
      const call = await this.db.getClient().callLog.update({ where: { id }, data: data as any });
      return ok(call);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async remove(id: string): Promise<Result<void, CallLogsError>> {
    try {
      await this.db.getClient().callLog.delete({ where: { id } });
      return ok(undefined);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }
}
