import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and, or, inArray, desc, lt, isNull, ilike } from 'drizzle-orm';
import { db } from '../db';
import {
  parties,
  interactions,
  partyMergeQueues,
  leads,
  appointments,
  invoices,
  orders,
  onboardings,
  enrollments,
  callLogs,
} from '../db/schema';
import { validateJson } from '../middleware/validator';
import { requireAuth } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import type { AppEnv } from '../types/context';

export const partiesRouter = new Hono<AppEnv>();

partiesRouter.use('*', requireAuth, requireTenant);

// GET /parties - List parties
partiesRouter.get('/', async (c) => {
  const scope = c.get('scope');
  const query = c.req.query();

  const limit = Math.min(Number(query['limit']) || 50, 100);
  const cursor = query['cursor'];
  const search = query['search'];
  const type = query['type'];
  const verticalIdsParam = query['vertical_ids'];

  const conditions = [
    eq(parties.tenantId, scope.tenant_id),
    eq(parties.mergeStatus, 'canonical'),
    isNull(parties.deletedAt),
  ];

  let allowedVerticals = scope.vertical_ids;
  if (verticalIdsParam) {
    const requested = verticalIdsParam.split(',').filter(Boolean);
    allowedVerticals = allowedVerticals.length
      ? requested.filter((id) => allowedVerticals.includes(id))
      : requested;
  }
  if (allowedVerticals.length > 0) {
    conditions.push(inArray(parties.verticalId, allowedVerticals));
  }

  if (type) conditions.push(eq(parties.type, type as any));

  if (search) {
    conditions.push(
      or(
        ilike(parties.name, `%${search}%`),
        ilike(parties.email, `%${search}%`),
        ilike(parties.phoneRaw, `%${search}%`),
        ilike(parties.phoneNormalized, `%${search}%`)
      )!
    );
  }

  if (cursor) {
    const cursorParty = await db.query.parties.findFirst({
      where: eq(parties.id, cursor),
      columns: { createdAt: true },
    });
    if (cursorParty) {
      conditions.push(lt(parties.createdAt, cursorParty.createdAt));
    }
  }

  const results = await db.query.parties.findMany({
    where: and(...conditions),
    limit: limit + 1,
    orderBy: [desc(parties.createdAt)],
    with: {
      vertical: { columns: { id: true, name: true } },
      assignedTo: { columns: { id: true, name: true, email: true } },
    },
  });

  const hasMore = results.length > limit;
  const data = hasMore ? results.slice(0, limit) : results;
  const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

  return c.json({ data, next_cursor: nextCursor });
});

// GET /parties/:id - Get party with interactions
partiesRouter.get('/:id', async (c) => {
  const scope = c.get('scope');
  const id = c.req.param('id');

  const party = await db.query.parties.findFirst({
    where: and(
      eq(parties.id, id),
      eq(parties.tenantId, scope.tenant_id),
      isNull(parties.deletedAt)
    ),
    with: {
      vertical: true,
      assignedTo: { columns: { id: true, name: true, email: true } },
      interactions: {
        orderBy: [desc(interactions.createdAt)],
        limit: 50,
      },
    },
  });

  if (!party) {
    return c.json({ code: 'NOT_FOUND', message: 'Party not found' }, 404);
  }

  return c.json(party);
});

// POST /parties - Create party
const createPartySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email().optional().nullable(),
  phone_raw: z.string().min(1, 'Phone is required'),
  type: z.enum(['individual', 'organization']).default('individual'),
  source: z.string().default('manual'),
  vertical_id: z.string().optional().nullable(),
  assigned_to_id: z.string().optional().nullable(),
  attributes: z.record(z.string(), z.any()).optional().default({}),
});

partiesRouter.post('/', validateJson(createPartySchema), async (c) => {
  const scope = c.get('scope');
  const body = c.get('validatedJson' as any) as z.infer<typeof createPartySchema>;

  const verticalId = body.vertical_id || scope.vertical_ids[0];
  if (!verticalId) {
    return c.json({ code: 'VALIDATION_FAILED', message: 'vertical_id is required' }, 400);
  }

  const normalized = body.phone_raw.replace(/[^\d+]/g, '');

  // Check for existing duplicate phone in canonical parties
  const existingDuplicate = await db.query.parties.findFirst({
    where: and(
      eq(parties.tenantId, scope.tenant_id),
      eq(parties.phoneNormalized, normalized),
      eq(parties.mergeStatus, 'canonical'),
      isNull(parties.deletedAt)
    ),
  });

  const [created] = await db
    .insert(parties)
    .values({
      tenantId: scope.tenant_id,
      verticalId,
      assignedToId: body.assigned_to_id,
      type: body.type,
      name: body.name,
      email: body.email,
      phoneRaw: body.phone_raw,
      phoneNormalized: normalized,
      source: body.source as any,
      attributes: body.attributes || {},
      mergeStatus: existingDuplicate ? 'pending_review' : 'canonical',
    })
    .returning();

  // If duplicate found, queue for review
  if (existingDuplicate && created) {
    await db.insert(partyMergeQueues).values({
      tenantId: scope.tenant_id,
      primaryPartyId: existingDuplicate.id,
      duplicatePartyId: created.id,
      confidenceScore: 0.95,
      source: 'phone_match',
      status: 'pending_review',
    });
  }

  return c.json(created, 201);
});

// PATCH /parties/:id - Update party
partiesRouter.patch('/:id', async (c) => {
  const scope = c.get('scope');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));

  const updateData: Record<string, any> = {};
  if (body.name !== undefined) updateData['name'] = body.name;
  if (body.email !== undefined) updateData['email'] = body.email;
  if (body.phone_raw !== undefined) {
    updateData['phoneRaw'] = body.phone_raw;
    updateData['phoneNormalized'] = body.phone_raw.replace(/[^\d+]/g, '');
  }
  if (body.type !== undefined) updateData['type'] = body.type;
  if (body.vertical_id !== undefined) updateData['verticalId'] = body.vertical_id;
  if (body.assigned_to_id !== undefined) updateData['assignedToId'] = body.assigned_to_id;
  if (body.attributes !== undefined) updateData['attributes'] = body.attributes;

  const [updated] = await db
    .update(parties)
    .set(updateData)
    .where(and(eq(parties.id, id), eq(parties.tenantId, scope.tenant_id)))
    .returning();

  if (!updated) {
    return c.json({ code: 'NOT_FOUND', message: 'Party not found' }, 404);
  }

  return c.json(updated);
});

// DELETE /parties/:id - Soft-delete party
partiesRouter.delete('/:id', async (c) => {
  const scope = c.get('scope');
  const id = c.req.param('id');

  const [deleted] = await db
    .update(parties)
    .set({ deletedAt: new Date() })
    .where(and(eq(parties.id, id), eq(parties.tenantId, scope.tenant_id)))
    .returning();

  if (!deleted) {
    return c.json({ code: 'NOT_FOUND', message: 'Party not found' }, 404);
  }

  return c.json({ success: true });
});

// POST /parties/merge - Merge duplicate party into canonical party
const mergeSchema = z.object({
  primary_party_id: z.string().min(1),
  duplicate_party_id: z.string().min(1),
});

partiesRouter.post('/merge', validateJson(mergeSchema), async (c) => {
  const scope = c.get('scope');
  const { primary_party_id, duplicate_party_id } = c.get('validatedJson' as any) as z.infer<typeof mergeSchema>;

  if (primary_party_id === duplicate_party_id) {
    return c.json({ code: 'VALIDATION_FAILED', message: 'Cannot merge a party into itself' }, 400);
  }

  const primary = await db.query.parties.findFirst({
    where: and(eq(parties.id, primary_party_id), eq(parties.tenantId, scope.tenant_id)),
  });
  const duplicate = await db.query.parties.findFirst({
    where: and(eq(parties.id, duplicate_party_id), eq(parties.tenantId, scope.tenant_id)),
  });

  if (!primary || !duplicate) {
    return c.json({ code: 'NOT_FOUND', message: 'One or both parties not found' }, 404);
  }

  // Atomic merge transaction: transfer all related records
  await db.transaction(async (tx) => {
    // 1. Re-link interactions
    await tx.update(interactions).set({ partyId: primary_party_id }).where(eq(interactions.partyId, duplicate_party_id));

    // 2. Re-link leads
    await tx.update(leads).set({ partyId: primary_party_id }).where(eq(leads.partyId, duplicate_party_id));

    // 3. Re-link appointments, invoices, orders, onboardings, enrollments, call logs
    await tx.update(appointments).set({ partyId: primary_party_id }).where(eq(appointments.partyId, duplicate_party_id));
    await tx.update(invoices).set({ partyId: primary_party_id }).where(eq(invoices.partyId, duplicate_party_id));
    await tx.update(orders).set({ partyId: primary_party_id }).where(eq(orders.partyId, duplicate_party_id));
    await tx.update(onboardings).set({ partyId: primary_party_id }).where(eq(onboardings.partyId, duplicate_party_id));
    await tx.update(enrollments).set({ partyId: primary_party_id }).where(eq(enrollments.partyId, duplicate_party_id));
    await tx.update(callLogs).set({ partyId: primary_party_id }).where(eq(callLogs.partyId, duplicate_party_id));

    // 4. Mark duplicate party as merged
    await tx
      .update(parties)
      .set({
        mergeStatus: 'merged',
        mergedIntoId: primary_party_id,
      })
      .where(eq(parties.id, duplicate_party_id));

    // 5. Update merge queue item if exists
    await tx
      .update(partyMergeQueues)
      .set({
        status: 'approved',
        reviewedBy: scope.user_id,
      })
      .where(
        and(
          eq(partyMergeQueues.primaryPartyId, primary_party_id),
          eq(partyMergeQueues.duplicatePartyId, duplicate_party_id)
        )
      );
  });

  return c.json({ success: true, primary_party_id });
});
