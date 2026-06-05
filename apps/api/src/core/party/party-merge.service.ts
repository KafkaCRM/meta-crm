import { Injectable } from '@nestjs/common';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';
import type { RequestScope } from '../tenant/request-scope.interface';

export interface MergeInput {
  canonical_id: string;
  duplicate_id: string;
  field_overrides?: Record<string, any>;
}

export type MergeErrorCode = 'PARTY_NOT_FOUND' | 'ALREADY_MERGED' | 'SAME_PARTY';

export interface MergeError {
  code: MergeErrorCode;
  message: string;
}

@Injectable()
export class PartyMergeService {
  constructor(private readonly db: TenantScopedPrismaService) {}

  async mergeParties(
    input: MergeInput,
    _scope: RequestScope,
  ): Promise<Result<{ party: any }, MergeError>> {
    if (input.canonical_id === input.duplicate_id) {
      return err({ code: 'SAME_PARTY', message: 'Cannot merge a party into itself' });
    }

    const canonical = await this.db.getClient().party.findUnique({
      where: { id: input.canonical_id },
    });

    if (!canonical || canonical.merge_status === 'merged') {
      return err({ code: 'PARTY_NOT_FOUND', message: 'Canonical party not found or already merged' });
    }

    const duplicate = await this.db.getClient().party.findUnique({
      where: { id: input.duplicate_id },
    });

    if (!duplicate || duplicate.merge_status === 'merged') {
      return err({ code: 'PARTY_NOT_FOUND', message: 'Duplicate party not found or already merged' });
    }

    await this.db.getClient().$transaction(async (tx) => {
      await tx.case.updateMany({
        where: { party_id: input.duplicate_id },
        data: { party_id: input.canonical_id },
      });

      await tx.interaction.updateMany({
        where: { party_id: input.duplicate_id },
        data: { party_id: input.canonical_id },
      });

      await tx.partyMergeQueue.updateMany({
        where: { duplicate_party_id: input.duplicate_id, status: 'pending_review' },
        data: { status: 'confirmed_merge' },
      });

      await tx.party.update({
        where: { id: input.duplicate_id },
        data: { merge_status: 'merged', merged_into_id: input.canonical_id },
      });

      if (input.field_overrides && Object.keys(input.field_overrides).length > 0) {
        await tx.party.update({
          where: { id: input.canonical_id },
          data: input.field_overrides,
        });
      }
    });

    const updated = await this.db.getClient().party.findUnique({
      where: { id: input.canonical_id },
    });

    return ok({ party: updated });
  }
}
