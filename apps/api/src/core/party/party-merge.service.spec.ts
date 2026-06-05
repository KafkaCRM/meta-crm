import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';
import { PartyMergeService } from './party-merge.service';
import type { RequestScope } from '../tenant/request-scope.interface';

function mockDb(overrides?: any) {
  return {
    getClient: vi.fn().mockReturnValue({
      party: {
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      case: { updateMany: vi.fn() },
      interaction: { updateMany: vi.fn() },
      partyMergeQueue: { updateMany: vi.fn() },
      $transaction: vi.fn((cb: any) => cb({
        party: { update: vi.fn(), updateMany: vi.fn() },
        case: { updateMany: vi.fn() },
        interaction: { updateMany: vi.fn() },
        partyMergeQueue: { updateMany: vi.fn() },
      })),
    }),
    ...overrides,
  } as unknown as TenantScopedPrismaService;
}

const scope: RequestScope = {
  user_id: 'user-a',
  tenant_id: 'tenant-a',
  assignment_ids: ['assign-1'],
  role: 'branch_user' as any,
};

const CANONICAL = { id: 'party-a', name: 'A', merge_status: 'canonical' };
const DUPLICATE = { id: 'party-b', name: 'B', merge_status: 'canonical' };

describe('PartyMergeService', () => {
  let db: TenantScopedPrismaService;
  let svc: PartyMergeService;

  beforeEach(() => {
    db = mockDb();
    svc = new PartyMergeService(db);
  });

  it('reassigns cases and interactions to canonical', async () => {
    const client = db.getClient();
    (client.party.findUnique as any).mockImplementation(({ where: { id } }: any) => {
      if (id === CANONICAL.id) return CANONICAL;
      if (id === DUPLICATE.id) return DUPLICATE;
      return null;
    });

    const result = await svc.mergeParties({ canonical_id: 'party-a', duplicate_id: 'party-b' }, scope);
    expect(result.isOk()).toBe(true);
  });

  it('returns SAME_PARTY error when both ids are equal', async () => {
    const result = await svc.mergeParties({ canonical_id: 'same-id', duplicate_id: 'same-id' }, scope);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('SAME_PARTY');
    }
  });

  it('returns PARTY_NOT_FOUND when canonical does not exist', async () => {
    const client = db.getClient();
    (client.party.findUnique as any).mockResolvedValue(null);

    const result = await svc.mergeParties({ canonical_id: 'nonexistent', duplicate_id: 'party-b' }, scope);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('PARTY_NOT_FOUND');
    }
  });

  it('returns PARTY_NOT_FOUND when duplicate already merged', async () => {
    const client = db.getClient();
    (client.party.findUnique as any).mockImplementation(({ where: { id } }: any) => {
      if (id === CANONICAL.id) return CANONICAL;
      return { ...DUPLICATE, merge_status: 'merged' };
    });

    const result = await svc.mergeParties({ canonical_id: 'party-a', duplicate_id: 'party-b' }, scope);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('PARTY_NOT_FOUND');
    }
  });

  it('updates canonical party with field_overrides inside transaction', async () => {
    const client = db.getClient();
    (client.party.findUnique as any).mockImplementation(({ where: { id } }: any) => {
      if (id === CANONICAL.id) return CANONICAL;
      if (id === DUPLICATE.id) return DUPLICATE;
      return null;
    });

    const partyUpdateSpy = vi.fn();
    const mockTx = {
      party: { update: partyUpdateSpy, updateMany: vi.fn() },
      case: { updateMany: vi.fn() },
      interaction: { updateMany: vi.fn() },
      partyMergeQueue: { updateMany: vi.fn() },
    };
    (client.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

    const fieldOverrides = { email: 'new-email@test.com', name: 'New Name' };
    const result = await svc.mergeParties({
      canonical_id: 'party-a',
      duplicate_id: 'party-b',
      field_overrides: fieldOverrides,
    }, scope);

    expect(result.isOk()).toBe(true);
    expect(partyUpdateSpy).toHaveBeenCalledWith({
      where: { id: 'party-a' },
      data: fieldOverrides,
    });
  });
});
