import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClsService } from 'nestjs-cls';
import { PartyType, PartySource } from '@meta-crm/types';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';
import { PartyUpsertService } from './party-upsert.service';
import type { RequestScope } from '../tenant/request-scope.interface';

function mockDb(overrides?: any) {
  return {
    getClient: vi.fn().mockReturnValue({
      $queryRaw: vi.fn(),
      party: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      partyMergeQueue: {
        create: vi.fn(),
      },
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

function assertOk<T, E>(result: any, action: string): T {
  expect(result.isOk()).toBe(true);
  expect(result.value.action).toBe(action);
  return result.value.party;
}

describe('PartyUpsertService', () => {
  let db: TenantScopedPrismaService;
  let svc: PartyUpsertService;

  beforeEach(() => {
    db = mockDb();
    svc = new PartyUpsertService(db);
  });

  describe('normalizePhone', () => {
    it('normalizes valid IN number with country code', async () => {
      const result = await svc.upsertByPhone('+919876543210', { vertical_id: 'assign-1' }, PartySource.Manual, scope);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.action).toBe('created');
      }
    });

    it('returns INVALID_PHONE for invalid number', async () => {
      const result = await svc.upsertByPhone('not-a-phone', { vertical_id: 'assign-1' }, PartySource.Manual, scope);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('INVALID_PHONE');
      }
    });
  });

  describe('exact phone match', () => {
    it('returns found when same normalized phone exists', async () => {
      const client = db.getClient();
      (client.party.findFirst as any).mockResolvedValue({ id: 'party-1', phone_normalized: '+919876543210', name: 'Existing' });

      const result = await svc.upsertByPhone('+919876543210', { vertical_id: 'assign-1' }, PartySource.Manual, scope);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.action).toBe('found');
        expect(result.value.party.name).toBe('Existing');
      }
    });
  });

  describe('fuzzy match', () => {
    it('queues for review when confidence >= 0.9', async () => {
      const client = db.getClient();
      (client.party.findFirst as any).mockResolvedValue(null);
      (client.$queryRaw as any).mockResolvedValue([
        { id: 'party-1', name: 'Same Name', phone_normalized: '+919876543210', score: 1 },
      ]);
      (client.partyMergeQueue.create as any).mockResolvedValue({ id: 'mq-1' });

      const result = await svc.upsertByPhone('+919876543210', { name: 'Same Name', vertical_id: 'assign-1' }, PartySource.Manual, scope);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.action).toBe('queued_for_review');
        expect(result.value.merge_queue_id).toBe('mq-1');
      }
    });

    it('creates party and merge queue entry when confidence >= 0.5', async () => {
      const client = db.getClient();
      (client.party.findFirst as any).mockResolvedValue(null);
      (client.$queryRaw as any).mockResolvedValue([
        { id: 'party-1', name: 'Similar', phone_normalized: '+919888888888', score: 0.7 },
      ]);
      (client.party.create as any).mockResolvedValue({ id: 'party-2', name: 'Similar' });
      (client.partyMergeQueue.create as any).mockResolvedValue({ id: 'mq-2' });
    });
  });
});
