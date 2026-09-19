import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and, desc, lt, isNull } from 'drizzle-orm';
import { db } from '../db';
import { interactions, parties } from '../db/schema';
import { validateJson } from '../middleware/validator';
import { requireAuth } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import type { AppEnv } from '../types/context';

export const interactionsRouter = new Hono<AppEnv>();

interactionsRouter.use('*', requireAuth, requireTenant);

function mapChannelToDb(channel: string): 'whatsapp' | 'email' | 'phone' | 'sms' | 'system' | 'note' {
  const c = channel.toLowerCase();
  if (c === 'call' || c === 'phone') return 'phone';
  if (c === 'whatsapp') return 'whatsapp';
  if (c === 'email') return 'email';
  if (c === 'sms') return 'sms';
  if (c === 'note') return 'note';
  return 'system';
}

function formatInteraction(i: any) {
  const createdAtIso = i.createdAt instanceof Date ? i.createdAt.toISOString() : (i.createdAt || new Date().toISOString());
  const caseId = (i.metadata && typeof i.metadata === 'object' && (i.metadata as any).case_id) || null;

  return {
    id: i.id,
    tenant_id: i.tenantId,
    party_id: i.partyId,
    case_id: caseId,
    channel: i.channel === 'phone' ? 'call' : i.channel,
    direction: i.direction,
    content: i.content,
    thread_id: i.threadId || null,
    is_pinned: Boolean(i.isPinned),
    pinned_by: i.pinnedBy || null,
    metadata: (i.metadata as Record<string, unknown>) || {},
    created_at: createdAtIso,
  };
}

// GET /interactions - List interactions
interactionsRouter.get('/', async (c) => {
  const scope = c.get('scope');
  const query = c.req.query();

  const partyId = query['party_id'];
  const caseId = query['case_id'];
  const cursor = query['cursor'];
  const limit = Math.min(Number(query['limit']) || 50, 100);

  const conditions = [
    eq(interactions.tenantId, scope.tenant_id),
  ];

  if (partyId) {
    conditions.push(eq(interactions.partyId, partyId));
  }

  if (cursor) {
    const cursorRecord = await db.query.interactions.findFirst({
      where: eq(interactions.id, cursor),
      columns: { createdAt: true },
    });
    if (cursorRecord) {
      conditions.push(lt(interactions.createdAt, cursorRecord.createdAt));
    }
  }

  const results = await db.query.interactions.findMany({
    where: and(...conditions),
    limit: limit + 1,
    orderBy: [desc(interactions.isPinned), desc(interactions.createdAt)],
  });

  // Filter in-memory for case_id if specified in metadata
  let filtered = results;
  if (caseId) {
    filtered = results.filter((r) => (r.metadata as any)?.case_id === caseId || r.threadId === caseId);
  }

  const hasMore = filtered.length > limit;
  const pageData = hasMore ? filtered.slice(0, limit) : filtered;
  const nextCursor = hasMore ? pageData[pageData.length - 1]?.id : null;

  const items = pageData.map((record) => ({
    kind: 'interaction' as const,
    data: formatInteraction(record),
  }));

  return c.json({
    items,
    next_cursor: nextCursor,
  });
});

// POST /interactions - Create interaction
const createInteractionSchema = z.object({
  party_id: z.string().min(1, 'Party ID is required'),
  case_id: z.string().optional().nullable(),
  channel: z.string().default('note'),
  direction: z.enum(['inbound', 'outbound']).default('outbound'),
  content: z.string().min(1, 'Content is required'),
  thread_id: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

interactionsRouter.post('/', validateJson(createInteractionSchema), async (c) => {
  const scope = c.get('scope');
  const body = c.get('validatedJson' as any) as z.infer<typeof createInteractionSchema>;

  // Verify party belongs to tenant
  const party = await db.query.parties.findFirst({
    where: and(eq(parties.id, body.party_id), eq(parties.tenantId, scope.tenant_id)),
  });

  if (!party) {
    return c.json({ code: 'NOT_FOUND', message: 'Party not found' }, 404);
  }

  const dbChannel = mapChannelToDb(body.channel);
  const metadata = {
    ...(body.metadata || {}),
    case_id: body.case_id || null,
    created_by_user_id: scope.user_id,
  };

  const [created] = await db
    .insert(interactions)
    .values({
      tenantId: scope.tenant_id,
      partyId: body.party_id,
      channel: dbChannel,
      direction: body.direction,
      content: body.content,
      threadId: body.thread_id || null,
      metadata,
      isPinned: false,
    })
    .returning();

  return c.json(formatInteraction(created), 201);
});

// POST /interactions/:id/pin - Pin an interaction
interactionsRouter.post('/:id/pin', async (c) => {
  const scope = c.get('scope');
  const id = c.req.param('id');

  const [updated] = await db
    .update(interactions)
    .set({
      isPinned: true,
      pinnedBy: scope.user_id,
    })
    .where(and(eq(interactions.id, id), eq(interactions.tenantId, scope.tenant_id)))
    .returning();

  if (!updated) {
    return c.json({ code: 'NOT_FOUND', message: 'Interaction not found' }, 404);
  }

  return c.json(formatInteraction(updated));
});

// DELETE /interactions/:id/pin - Unpin an interaction
interactionsRouter.delete('/:id/pin', async (c) => {
  const scope = c.get('scope');
  const id = c.req.param('id');

  const [updated] = await db
    .update(interactions)
    .set({
      isPinned: false,
      pinnedBy: null,
    })
    .where(and(eq(interactions.id, id), eq(interactions.tenantId, scope.tenant_id)))
    .returning();

  if (!updated) {
    return c.json({ code: 'NOT_FOUND', message: 'Interaction not found' }, 404);
  }

  return c.json(formatInteraction(updated));
});
