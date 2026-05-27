import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClsService } from 'nestjs-cls';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';
import { PartyService } from './party.service';
import type { RequestScope } from '../tenant/request-scope.interface';
import { FieldValidationService } from '../metadata/field-validation.service';
import { HooksService } from '../hooks/hooks.service';
import { ok } from 'neverthrow';

function mockCls(scope: RequestScope): ClsService {
  return { get: vi.fn().mockReturnValue(scope) } as unknown as ClsService;
}

function mockFieldValidation(): FieldValidationService {
  return {
    validateAttributes: vi.fn().mockResolvedValue(ok(undefined)),
  } as unknown as FieldValidationService;
}

function mockHooks(): HooksService {
  return {
    emit: vi.fn(),
  } as unknown as HooksService;
}

function mockDb() {
  return {
    getClient: vi.fn().mockReturnValue({
      party: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    }),
  } as unknown as TenantScopedPrismaService;
}

const scope: RequestScope = {
  user_id: 'user-a',
  tenant_id: 'tenant-a',
  assignment_ids: ['assign-1'],
  role: 'branch_user' as any,
};

const PARTY = {
  id: 'party-1',
  type: 'individual',
  name: 'John',
  email: 'john@example.com',
  phone_raw: '+919876543210',
  phone_normalized: '+919876543210',
  source: 'manual',
  branch_brand_assignment_id: 'assign-1',
  attributes: {},
  merge_status: 'canonical',
  created_at: new Date('2025-01-01'),
};

describe('PartyService', () => {
  let db: TenantScopedPrismaService;
  let cls: ClsService;
  let fieldValidation: FieldValidationService;
  let hooks: HooksService;
  let svc: PartyService;

  beforeEach(() => {
    db = mockDb();
    cls = mockCls(scope);
    fieldValidation = mockFieldValidation();
    hooks = mockHooks();
    svc = new PartyService(db, cls, fieldValidation, hooks);
  });

  describe('findMany', () => {
    it('returns paginated results', async () => {
      const client = db.getClient();
      (client.party.findMany as any).mockResolvedValue([PARTY]);

      const result = await svc.findMany({ limit: 10 });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.data).toHaveLength(1);
      }
    });
  });

  describe('findOne', () => {
    it('returns party when found', async () => {
      const client = db.getClient();
      (client.party.findUnique as any).mockResolvedValue({ ...PARTY, cases: [] });

      const result = await svc.findOne('party-1');
      expect(result.isOk()).toBe(true);
    });

    it('returns NOT_FOUND when missing', async () => {
      const client = db.getClient();
      (client.party.findUnique as any).mockResolvedValue(null);

      const result = await svc.findOne('nonexistent');
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('create', () => {
    it('creates and returns a party', async () => {
      const client = db.getClient();
      (client.party.create as any).mockResolvedValue(PARTY);

      const result = await svc.create({
        type: 'individual',
        name: 'John',
        email: 'john@example.com',
        branch_brand_assignment_id: 'assign-1',
      });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.name).toBe('John');
      }
    });
  });

  describe('update', () => {
    it('updates party name', async () => {
      const client = db.getClient();
      (client.party.findUnique as any).mockResolvedValue(PARTY);
      (client.party.update as any).mockResolvedValue({ ...PARTY, name: 'Jane' });

      const result = await svc.update('party-1', { name: 'Jane' });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.name).toBe('Jane');
      }
    });

    it('returns NOT_FOUND for missing party', async () => {
      const client = db.getClient();
      (client.party.findUnique as any).mockResolvedValue(null);

      const result = await svc.update('nonexistent', { name: 'Jane' });
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('softDelete', () => {
    it('marks party as merged', async () => {
      const client = db.getClient();
      (client.party.findUnique as any).mockResolvedValue(PARTY);
      (client.party.update as any).mockResolvedValue({ ...PARTY, merge_status: 'merged' });

      const result = await svc.softDelete('party-1');
      expect(result.isOk()).toBe(true);
      expect(client.party.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'party-1' },
          data: { merge_status: 'merged' },
        }),
      );
    });

    it('returns NOT_FOUND for missing party', async () => {
      const client = db.getClient();
      (client.party.findUnique as any).mockResolvedValue(null);

      const result = await svc.softDelete('nonexistent');
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });
});
