import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClsService } from 'nestjs-cls';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';
import { InteractionService } from './interaction.service';

function mockDb() {
  const client = {
    interaction: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    caseEvent: {
      findMany: vi.fn(),
    },
    party: { findUnique: vi.fn() },
    case: { findUnique: vi.fn() },
  };

  return {
    getClient: vi.fn().mockReturnValue(client),
    client,
  } as unknown as TenantScopedPrismaService & { client: any };
}

function buildSvc() {
  const db = mockDb();
  const cls = { get: vi.fn().mockReturnValue({ user_id: 'user-1', tenant_id: 'tenant-a' }) } as unknown as ClsService;
  const svc = new InteractionService(db, cls);
  return { db, cls, svc, client: (db as any).client };
}

function makeInteraction(overrides: Record<string, any> = {}) {
  return {
    id: overrides.id ?? 'int-1',
    party_id: 'party-1',
    case_id: null,
    channel: 'whatsapp',
    direction: 'inbound',
    content: overrides.content ?? 'Hello',
    thread_id: null,
    is_pinned: false,
    pinned_by: null,
    metadata: {},
    created_at: new Date(overrides.created_at ?? '2025-06-01T12:00:00Z'),
    ...overrides,
  };
}

describe('InteractionService', () => {
  /* ------------------------------------------------------------------ */
  /*  Thread grouping                                                     */
  /* ------------------------------------------------------------------ */
  describe('thread grouping', () => {
    it('groups 3 interactions with same thread_id into one thread object', async () => {
      const { svc, client } = buildSvc();
      const threadId = 'thread-abc';
      (client.interaction.findMany as any).mockResolvedValue([
        makeInteraction({ id: 'msg-1', thread_id: threadId, content: 'First', created_at: new Date('2025-06-01T12:00:00Z') }),
        makeInteraction({ id: 'msg-2', thread_id: threadId, content: 'Second message', created_at: new Date('2025-06-01T12:05:00Z') }),
        makeInteraction({ id: 'msg-3', thread_id: threadId, content: 'Third', created_at: new Date('2025-06-01T12:10:00Z') }),
      ]);
      (client.caseEvent.findMany as any).mockResolvedValue([]);

      const result = await svc.findTimeline({ party_id: 'party-1' });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.items).toHaveLength(1);
        const item = result.value.items[0]!;
        expect(item.kind).toBe('thread');
        if (item.kind === 'thread') {
          expect(item.data.thread_id).toBe(threadId);
          expect(item.data.message_count).toBe(3);
          expect(item.data.last_message_preview).toBe('Third');
          expect(item.data.messages).toHaveLength(3);

        }
      }
    });

    it('keeps standalone interactions separate from threads', async () => {
      const { svc, client } = buildSvc();
      (client.interaction.findMany as any).mockResolvedValue([
        makeInteraction({ id: 'threaded-1', thread_id: 't-1', content: 'In thread', created_at: new Date('2025-06-01T12:00:00Z') }),
        makeInteraction({ id: 'standalone-1', thread_id: null, content: 'Alone', created_at: new Date('2025-06-01T12:01:00Z') }),
      ]);
      (client.caseEvent.findMany as any).mockResolvedValue([]);

      const result = await svc.findTimeline({ party_id: 'party-1' });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const kinds = result.value.items.map((i) => i.kind);
        expect(kinds).toContain('thread');
        expect(kinds).toContain('interaction');
        const standaloneItems = result.value.items.filter((i) => i.kind === 'interaction');
        expect(standaloneItems).toHaveLength(1);
      }
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Pinned interactions                                                 */
  /* ------------------------------------------------------------------ */
  describe('pinned interactions', () => {
    it('pinned interactions appear before non-pinned regardless of date', async () => {
      const { svc, client } = buildSvc();
      (client.interaction.findMany as any).mockResolvedValue([
        makeInteraction({ id: 'old-pinned', content: 'Old pinned', is_pinned: true, created_at: '2025-01-01T00:00:00Z' }),
        makeInteraction({ id: 'recent-unpinned', content: 'Recent', is_pinned: false, created_at: '2025-06-01T00:00:00Z' }),
      ]);
      (client.caseEvent.findMany as any).mockResolvedValue([]);

      const result = await svc.findTimeline({ party_id: 'party-1' });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.items).toHaveLength(2);
        expect(result.value.items[0]!.kind).toBe('interaction');
        if (result.value.items[0]!.kind === 'interaction') {
          expect(result.value.items[0]!.data.id).toBe('old-pinned');
        }
        expect(result.value.items[1]!.kind).toBe('interaction');
        if (result.value.items[1]!.kind === 'interaction') {
          expect(result.value.items[1]!.data.id).toBe('recent-unpinned');
        }
      }
    });

    it('sorts pinned items among themselves by created_at desc', async () => {
      const { svc, client } = buildSvc();
      (client.interaction.findMany as any).mockResolvedValue([
        makeInteraction({ id: 'pin-1', content: 'First', is_pinned: true, created_at: '2025-06-01T00:00:00Z' }),
        makeInteraction({ id: 'pin-2', content: 'Second', is_pinned: true, created_at: '2025-05-01T00:00:00Z' }),
      ]);
      (client.caseEvent.findMany as any).mockResolvedValue([]);

      const result = await svc.findTimeline({ party_id: 'party-1' });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const pinned = result.value.items.filter((i) => i.kind === 'interaction');
        expect(pinned).toHaveLength(2);
        if (pinned[0]!.kind === 'interaction' && pinned[1]!.kind === 'interaction') {
          expect(pinned[0]!.data.id).toBe('pin-1');
          expect(pinned[1]!.data.id).toBe('pin-2');
        }
      }
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Timeline merge — interactions + case_events                         */
  /* ------------------------------------------------------------------ */
  describe('timeline merge', () => {
    it('interleaves case_events and interactions by timestamp', async () => {
      const { svc, client } = buildSvc();
      (client.interaction.findMany as any).mockResolvedValue([
        makeInteraction({ id: 'int-1', content: 'A', created_at: '2025-06-01T12:00:00Z' }),
        makeInteraction({ id: 'int-2', content: 'C', created_at: '2025-06-01T14:00:00Z' }),
      ]);
      (client.caseEvent.findMany as any).mockResolvedValue([
        { id: 'evt-1', case_id: 'case-1', event_type: 'stage_changed', from_stage: 'a', to_stage: 'b', actor_id: 'u1', actor_type: 'user', payload: {}, occurred_at: new Date('2025-06-01T13:00:00Z') },
      ]);

      const result = await svc.findTimeline({ case_id: 'case-1' });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const kinds = result.value.items.map((i) => i.kind);
        const ids = result.value.items.map((i) =>
          i.kind === 'interaction' ? i.data.id :
          i.kind === 'system_event' ? i.data.id : ''
        );
        expect(ids).toEqual(['int-2', 'evt-1', 'int-1']);
      }
    });

    it('only fetches case_events when case_id is provided', async () => {
      const { svc, client } = buildSvc();
      (client.interaction.findMany as any).mockResolvedValue([
        makeInteraction({ id: 'int-1', created_at: '2025-06-01T12:00:00Z' }),
      ]);

      const result = await svc.findTimeline({ party_id: 'party-1' });

      expect(result.isOk()).toBe(true);
      expect(client.caseEvent.findMany).not.toHaveBeenCalled();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Cursor pagination                                                   */
  /* ------------------------------------------------------------------ */
  describe('cursor pagination', () => {
    it('returns next_cursor when there are more items', async () => {
      const { svc, client } = buildSvc();
      const items = Array.from({ length: 5 }, (_, i) =>
        makeInteraction({
          id: `int-${i}`,
          content: `Msg ${i}`,
          created_at: new Date(`2025-06-01T${10 + i}:00:00Z`),
        }),
      );
      (client.interaction.findMany as any).mockResolvedValue(items);
      (client.caseEvent.findMany as any).mockResolvedValue([]);

      const result = await svc.findTimeline({ party_id: 'party-1', limit: 3 });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.items).toHaveLength(3);
        expect(result.value.next_cursor).toBeTruthy();
      }
    });

    it('returns null next_cursor when no more items', async () => {
      const { svc, client } = buildSvc();
      (client.interaction.findMany as any).mockResolvedValue([
        makeInteraction({ id: 'int-1', created_at: new Date('2025-06-01T12:00:00Z') }),
      ]);
      (client.caseEvent.findMany as any).mockResolvedValue([]);

      const result = await svc.findTimeline({ party_id: 'party-1', limit: 10 });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.items).toHaveLength(1);
        expect(result.value.next_cursor).toBeNull();
      }
    });

    it('supports cursor-based pagination through pages', async () => {
      const { svc, client } = buildSvc();
      const items = [
        makeInteraction({ id: 'int-3', content: 'Third', created_at: new Date('2025-06-01T14:00:00Z') }),
        makeInteraction({ id: 'int-2', content: 'Second', created_at: new Date('2025-06-01T13:00:00Z') }),
        makeInteraction({ id: 'int-1', content: 'First', created_at: new Date('2025-06-01T12:00:00Z') }),
      ];
      (client.interaction.findMany as any).mockResolvedValue(items);
      (client.caseEvent.findMany as any).mockResolvedValue([]);

      const page1 = await svc.findTimeline({ party_id: 'party-1', limit: 2 });
      expect(page1.isOk()).toBe(true);
      if (page1.isOk()) {
        expect(page1.value.items).toHaveLength(2);
        expect(page1.value.next_cursor).toBeTruthy();
      }
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Create                                                              */
  /* ------------------------------------------------------------------ */
  describe('create', () => {
    it('creates an interaction and returns it', async () => {
      const { svc, client } = buildSvc();
      (client.party.findUnique as any).mockResolvedValue({ id: 'party-1' });
      (client.interaction.create as any).mockResolvedValue(
        makeInteraction({ id: 'int-new', content: 'Test message', created_at: new Date('2025-06-01T12:00:00Z') }),
      );

      const result = await svc.create({
        party_id: 'party-1',
        channel: 'whatsapp',
        direction: 'inbound',
        content: 'Test message',
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.id).toBe('int-new');
        expect(result.value.content).toBe('Test message');
      }
    });

    it('returns PARTY_NOT_FOUND when party does not exist', async () => {
      const { svc, client } = buildSvc();
      (client.party.findUnique as any).mockResolvedValue(null);

      const result = await svc.create({
        party_id: 'nonexistent',
        channel: 'whatsapp',
        direction: 'inbound',
        content: 'Test',
      });

      expect(result.isErr()).toBe(true);
      expect(result.error.code).toBe('PARTY_NOT_FOUND');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Pin / Unpin                                                        */
  /* ------------------------------------------------------------------ */
  describe('pin and unpin', () => {
    it('pins an interaction', async () => {
      const { svc, client } = buildSvc();
      (client.interaction.findUnique as any).mockResolvedValue(makeInteraction({ id: 'int-1' }));
      (client.interaction.update as any).mockResolvedValue(
        makeInteraction({ id: 'int-1', is_pinned: true, pinned_by: 'user-1' }),
      );

      const result = await svc.pin('int-1', 'user-1');
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.is_pinned).toBe(true);
        expect(result.value.pinned_by).toBe('user-1');
      }
    });

    it('unpins an interaction', async () => {
      const { svc, client } = buildSvc();
      (client.interaction.findUnique as any).mockResolvedValue(
        makeInteraction({ id: 'int-1', is_pinned: true, pinned_by: 'user-1' }),
      );
      (client.interaction.update as any).mockResolvedValue(
        makeInteraction({ id: 'int-1', is_pinned: false, pinned_by: null }),
      );

      const result = await svc.unpin('int-1');
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.is_pinned).toBe(false);
        expect(result.value.pinned_by).toBeNull();
      }
    });

    it('returns NOT_FOUND when pinning nonexistent interaction', async () => {
      const { svc, client } = buildSvc();
      (client.interaction.findUnique as any).mockResolvedValue(null);

      const result = await svc.pin('nonexistent', 'user-1');
      expect(result.error.code).toBe('NOT_FOUND');
    });

    it('returns NOT_FOUND when unpinning nonexistent interaction', async () => {
      const { svc, client } = buildSvc();
      (client.interaction.findUnique as any).mockResolvedValue(null);

      const result = await svc.unpin('nonexistent');
      expect(result.error.code).toBe('NOT_FOUND');
    });
  });
});
