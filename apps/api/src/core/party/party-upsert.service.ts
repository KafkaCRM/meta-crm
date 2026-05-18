import { Injectable } from '@nestjs/common';
import { parsePhoneNumber } from 'libphonenumber-js';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import type { PartySource } from '@meta-crm/types';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';
import type { RequestScope } from '../tenant/request-scope.interface';

export interface PartyUpsertResult {
  action: 'found' | 'created' | 'queued_for_review';
  party?: any;
  merge_queue_id?: string;
}

export type PartyErrorCode = 'INVALID_PHONE' | 'INTERNAL_ERROR';

export interface PartyError {
  code: PartyErrorCode;
  message: string;
  raw?: string;
}

function normalizePhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-()]/g, '');
  const stripped = cleaned.replace(/^0+/, '');

  try {
    const phone = parsePhoneNumber(stripped, 'IN');
    if (phone?.isValid()) {
      return phone.number;
    }
  } catch {}

  const forIntl = stripped.startsWith('+') ? stripped : '+' + stripped;
  try {
    const phone = parsePhoneNumber(forIntl);
    if (phone?.isValid()) {
      return phone.number;
    }
  } catch {}

  return null;
}

function prefixMatchScore(a: string, b: string): number {
  const a7 = a.slice(0, 7);
  const b7 = b.slice(0, 7);
  if (a7 === b7) return 1;
  if (a.slice(0, 5) === b.slice(0, 5)) return 0.5;
  return 0;
}

@Injectable()
export class PartyUpsertService {
  constructor(private readonly db: TenantScopedPrismaService) {}

  async upsertByPhone(
    phone: string,
    data: { name?: string; type?: string; email?: string; branch_brand_assignment_id: string; attributes?: Record<string, unknown> },
    source: PartySource,
    scope: RequestScope,
  ): Promise<Result<PartyUpsertResult, PartyError>> {
    const normalized = normalizePhone(phone);
    if (!normalized) {
      return err({ code: 'INVALID_PHONE', message: `Invalid phone number: ${phone}`, raw: phone });
    }

    const existing = await this.db.getClient().party.findFirst({
      where: {
        phone_normalized: normalized,
        merge_status: { not: 'merged' },
      },
    });

    if (existing) {
      return ok({ action: 'found', party: existing });
    }

    if (data.name) {
      const fuzzyRows: any[] = await this.db.getClient().$queryRaw`
        SELECT id, name, phone_normalized, similarity(name, ${data.name}) as score
        FROM party
        WHERE tenant_id = ${scope.tenant_id}
          AND merge_status = 'canonical'
          AND similarity(name, ${data.name}) > 0.5
        ORDER BY score DESC
        LIMIT 5
      `;

      if (fuzzyRows.length > 0) {
        const top = fuzzyRows[0]!;
        const simScore = Number(top.score);
        const phoneScore = prefixMatchScore(normalized.replace(/[^\d]/g, ''), top.phone_normalized?.replace(/[^\d]/g, '') ?? '');
        const confidence = simScore * 0.7 + phoneScore * 0.3;

        if (confidence >= 0.9) {
          const mq = await this.db.getClient().partyMergeQueue.create({
            data: {
              primary_party_id: top.id,
              duplicate_party_id: '', 
              confidence_score: confidence,
              source: 'webhook_upsert',
              status: 'pending_review',
            },
          });
          return ok({ action: 'queued_for_review', merge_queue_id: mq.id });
        }

        if (confidence >= 0.5) {
          const party = await this.db.getClient().party.create({
            data: {
              type: data.type ?? 'individual',
              name: data.name,
              email: data.email,
              phone_raw: phone,
              phone_normalized: normalized,
              source: source,
              branch_brand_assignment_id: data.branch_brand_assignment_id,
              attributes: (data.attributes ?? {}) as any,
              merge_status: 'canonical',
            },
          });

          await this.db.getClient().partyMergeQueue.create({
            data: {
              primary_party_id: top.id,
              duplicate_party_id: party.id,
              confidence_score: confidence,
              source: 'webhook_upsert',
              status: 'pending_review',
            },
          });

          return ok({ action: 'created', party });
        }
      }
    }

    const party = await this.db.getClient().party.create({
      data: {
        type: data.type ?? 'individual',
        name: data.name ?? '',
        email: data.email,
        phone_raw: phone,
        phone_normalized: normalized,
        source: source,
        branch_brand_assignment_id: data.branch_brand_assignment_id,
        attributes: (data.attributes ?? {}) as any,
        merge_status: 'canonical',
      },
    });

    return ok({ action: 'created', party });
  }
}
