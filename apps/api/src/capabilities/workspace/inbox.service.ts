import { Injectable } from '@nestjs/common';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../../core/tenant/tenant-scoped-prisma.service';
import { ClsService } from 'nestjs-cls';
import type { RequestScope } from '../../core/tenant/request-scope.interface';

export type InboxErrorCode = 'QUERY_FAILED';
export interface InboxError { code: InboxErrorCode; message?: string }

@Injectable()
export class InboxService {
  constructor(private readonly db: TenantScopedPrismaService, private readonly cls: ClsService) {}
  private getTenantId(): string | null { return this.cls.get<RequestScope>('scope')?.tenant_id ?? null; }

  async conversations(): Promise<Result<any[], InboxError>> {
    try {
      const tid = this.getTenantId(); if (!tid) return err({ code: 'QUERY_FAILED', message: 'No tenant' });
      const latest = await this.db.getClient().interaction.findMany({
        distinct: ['party_id'],
        orderBy: { created_at: 'desc' },
        where: { tenant_id: tid },
        include: {
          party: { select: { id: true, name: true, phone_raw: true } },
        },
      });
      const enriched = await Promise.all(latest.map(async (i: any) => {
        const total = await this.db.getClient().interaction.count({ where: { tenant_id: tid, party_id: i.party_id } });
        return {
          party_id: i.party_id,
          party_name: i.party?.name,
          party_phone: i.party?.phone_raw,
          last_message: i.content?.substring(0, 120),
          last_channel: i.channel,
          last_direction: i.direction,
          last_at: i.created_at,
          message_count: total,
        };
      }));
      return ok(enriched);
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }
}
