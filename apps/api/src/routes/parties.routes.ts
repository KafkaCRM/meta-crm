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
  branches,
  verticals,
} from '../db/schema';
import { validateJson } from '../middleware/validator';
import { requireAuth } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import type { AppEnv } from '../types/context';

function formatParty(p: any) {
  if (!p) return p;
  const createdAtIso = p.createdAt instanceof Date ? p.createdAt.toISOString() : (p.createdAt || new Date().toISOString());
  const updatedAtIso = p.updatedAt instanceof Date ? p.updatedAt.toISOString() : (p.updatedAt || new Date().toISOString());
  const deletedAtIso = p.deletedAt instanceof Date ? p.deletedAt.toISOString() : (p.deletedAt || null);

  return {
    ...p,
    id: p.id,
    tenant_id: p.tenantId,
    tenantId: p.tenantId,
    vertical_id: p.verticalId,
    verticalId: p.verticalId,
    assigned_to_id: p.assignedToId,
    assignedToId: p.assignedToId,
    type: p.type,
    name: p.name,
    email: p.email,
    phone_raw: p.phoneRaw || p.phone_raw || '',
    phoneRaw: p.phoneRaw || p.phone_raw || '',
    phone_normalized: p.phoneNormalized || p.phone_normalized || '',
    phoneNormalized: p.phoneNormalized || p.phone_normalized || '',
    source: p.source,
    attributes: p.attributes || {},
    merge_status: p.mergeStatus || p.merge_status || 'canonical',
    mergeStatus: p.mergeStatus || p.merge_status || 'canonical',
    merged_into_id: p.mergedIntoId || p.merged_into_id || null,
    mergedIntoId: p.mergedIntoId || p.merged_into_id || null,
    deleted_at: deletedAtIso,
    deletedAt: deletedAtIso,
    created_at: createdAtIso,
    createdAt: createdAtIso,
    updated_at: updatedAtIso,
    updatedAt: updatedAtIso,
  };
}

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

  const isAdmin = ['admin', 'tenant_admin', 'super_admin', 'platform_admin', 'owner'].includes(scope.role);
  let allowedVerticals = isAdmin ? [] : scope.vertical_ids;
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
  const data = (hasMore ? results.slice(0, limit) : results).map(formatParty);
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

  return c.json(formatParty(party));
});

// POST /parties - Create party
const createPartySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email().optional().nullable(),
  phone_raw: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  type: z.enum(['individual', 'organization']).default('individual'),
  source: z.string().default('manual'),
  vertical_id: z.string().optional().nullable(),
  branch_brand_assignment_id: z.string().optional().nullable(),
  assigned_to_id: z.string().optional().nullable(),
  attributes: z.record(z.string(), z.any()).optional().default({}),
});

partiesRouter.post('/', validateJson(createPartySchema), async (c) => {
  const scope = c.get('scope');
  const body = c.get('validatedJson' as any) as z.infer<typeof createPartySchema>;

  const rawPhone = body.phone_raw || body.phone || '';
  if (!rawPhone.trim()) {
    return c.json({ code: 'VALIDATION_FAILED', message: 'Phone number is required' }, 400);
  }

  let verticalId = body.vertical_id || body.branch_brand_assignment_id || scope.vertical_ids[0];
  if (!verticalId) {
    const defaultVert = await db.query.verticals.findFirst({
      where: eq(verticals.tenantId, scope.tenant_id),
    });
    if (defaultVert) {
      verticalId = defaultVert.id;
    } else {
      let defaultBranch = await db.query.branches.findFirst({
        where: eq(branches.tenantId, scope.tenant_id),
      });
      if (!defaultBranch) {
        const [nb] = await db.insert(branches).values({
          tenantId: scope.tenant_id,
          name: 'Main Location',
        }).returning();
        defaultBranch = nb;
      }
      const [nv] = await db.insert(verticals).values({
        tenantId: scope.tenant_id,
        branchId: defaultBranch!.id,
        name: 'General Services',
      }).returning();
      verticalId = nv!.id;
    }
  }

  const normalized = rawPhone.replace(/[^\d+]/g, '');

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
      phoneRaw: rawPhone,
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

  return c.json(formatParty(created), 201);
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
