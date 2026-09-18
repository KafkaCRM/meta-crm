import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and, desc, sql, lt, ilike, or } from 'drizzle-orm';
import { db } from '../db';
import { customObjects, flexRecords, fieldDefinitions, users, branches } from '../db/schema';
import { validateJson } from '../middleware/validator';
import { requireAuth } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import type { AppEnv } from '../types/context';

export const objectsRouter = new Hono<AppEnv>();

objectsRouter.use('*', requireAuth, requireTenant);

/* ------------------------------------------------------------------ */
/*  1. Custom Object Metadata CRUD                                     */
/* ------------------------------------------------------------------ */

// GET / - List all custom objects for current workspace
objectsRouter.get('/', async (c) => {
  const scope = c.get('scope');

  const list = await db.query.customObjects.findMany({
    where: eq(customObjects.tenantId, scope.tenant_id),
    orderBy: [desc(customObjects.createdAt)],
  });

  const withCounts = await Promise.all(
    list.map(async (obj) => {
      const [recordStat] = await db
        .select({ count: sql<number>`count(*)` })
        .from(flexRecords)
        .where(and(eq(flexRecords.tenantId, scope.tenant_id), eq(flexRecords.customObjectId, obj.id)));

      return {
        id: obj.id,
        key: obj.key,
        api_name: obj.key,
        label: obj.label,
        singular_label: obj.label,
        plural_label: obj.pluralLabel,
        domain: obj.domain,
        description: obj.description,
        icon: obj.icon,
        primary_field: obj.primaryField,
        record_count: Number(recordStat?.count || 0),
        created_at: obj.createdAt.toISOString(),
      };
    })
  );

  return c.json(withCounts);
});

// POST / - Create a new Custom Object definition
const createObjectSchema = z.object({
  key: z.string().min(2).max(64).regex(/^[a-z0-9_]+$/, 'Key must be lowercase alphanumeric with underscores').optional(),
  api_name: z.string().min(2).max(64).optional(),
  label: z.string().min(1).optional(),
  singular_label: z.string().min(1).optional(),
  plural_label: z.string().min(1),
  domain: z.string().default('Custom Objects'),
  description: z.string().optional().nullable(),
  icon: z.string().default('Layers'),
  primary_field: z.string().default('name'),
  fields: z.array(
    z.object({
      name: z.string().min(1),
      label: z.string().min(1),
      field_type: z.string().default('text'),
      options: z.array(z.string()).optional(),
      required: z.boolean().default(false),
    })
  ).optional(),
});

objectsRouter.post('/', validateJson(createObjectSchema), async (c) => {
  const scope = c.get('scope');
  const b = c.get('validatedJson' as any) as z.infer<typeof createObjectSchema>;

  const rawKey = (b.key || b.api_name || '').trim().toLowerCase();
  const rawLabel = (b.label || b.singular_label || '').trim();

  if (!rawKey) {
    return c.json({ code: 'VALIDATION_ERROR', message: 'key or api_name is required' }, 400);
  }
  if (!rawLabel) {
    return c.json({ code: 'VALIDATION_ERROR', message: 'label or singular_label is required' }, 400);
  }

  const existing = await db.query.customObjects.findFirst({
    where: and(eq(customObjects.tenantId, scope.tenant_id), eq(customObjects.key, rawKey)),
  });

  if (existing) {
    return c.json({ code: 'KEY_IN_USE', message: `Object key '${rawKey}' already exists in this workspace` }, 409);
  }

  const result = await db.transaction(async (tx) => {
    const [createdObj] = await tx
      .insert(customObjects)
      .values({
        tenantId: scope.tenant_id,
        key: rawKey,
        label: rawLabel,
        pluralLabel: b.plural_label,
        domain: b.domain,
        description: b.description || null,
        icon: b.icon,
        primaryField: b.primary_field,
      })
      .returning();

    if (b.fields && b.fields.length > 0) {
      for (let i = 0; i < b.fields.length; i++) {
        const f = b.fields[i]!;
        await tx.insert(fieldDefinitions).values({
          tenantId: scope.tenant_id,
          entityType: rawKey,
          name: f.name,
          label: f.label,
          fieldType: f.field_type,
          options: f.options || null,
          required: f.required,
          order: i + 1,
        });
      }
    }

    return createdObj!;
  });

  return c.json({
    ...result,
    api_name: result.key,
    singular_label: result.label,
    plural_label: result.pluralLabel,
  }, 201);
});

// GET /:key - Get object schema & fields (supports lookup by key or id)
objectsRouter.get('/:key', async (c) => {
  const scope = c.get('scope');
  const key = c.req.param('key');

  const obj = await db.query.customObjects.findFirst({
    where: and(
      eq(customObjects.tenantId, scope.tenant_id),
      or(eq(customObjects.key, key), eq(customObjects.id, key))
    ),
  });

  if (!obj) {
    return c.json({ code: 'NOT_FOUND', message: `Custom object '${key}' not found` }, 404);
  }

  const fields = await db.query.fieldDefinitions.findMany({
    where: and(eq(fieldDefinitions.tenantId, scope.tenant_id), eq(fieldDefinitions.entityType, obj.key)),
    orderBy: [fieldDefinitions.order],
  });

  return c.json({
    id: obj.id,
    key: obj.key,
    api_name: obj.key,
    label: obj.label,
    singular_label: obj.label,
    plural_label: obj.pluralLabel,
    domain: obj.domain,
    description: obj.description,
    icon: obj.icon,
    primary_field: obj.primaryField,
    fields: fields.map((f) => ({
      id: f.id,
      name: f.name,
      label: f.label,
      field_type: f.fieldType,
      options: f.options,
      required: f.required,
      order: f.order,
    })),
  });
});

// PATCH /:key - Update custom object metadata
const updateObjectSchema = z.object({
  label: z.string().min(1).optional(),
  singular_label: z.string().min(1).optional(),
  plural_label: z.string().min(1).optional(),
  domain: z.string().optional(),
  description: z.string().optional().nullable(),
  icon: z.string().optional(),
  primary_field: z.string().optional(),
});

objectsRouter.patch('/:key', validateJson(updateObjectSchema), async (c) => {
  const scope = c.get('scope');
  const key = c.req.param('key');
  const b = c.get('validatedJson' as any) as z.infer<typeof updateObjectSchema>;

  const obj = await db.query.customObjects.findFirst({
    where: and(
      eq(customObjects.tenantId, scope.tenant_id),
      or(eq(customObjects.key, key), eq(customObjects.id, key))
    ),
  });

  if (!obj) {
    return c.json({ code: 'NOT_FOUND', message: `Custom object '${key}' not found` }, 404);
  }

  const updates: Partial<typeof customObjects.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (b.label || b.singular_label) updates.label = b.label || b.singular_label;
  if (b.plural_label) updates.pluralLabel = b.plural_label;
  if (b.domain) updates.domain = b.domain;
  if (b.description !== undefined) updates.description = b.description;
  if (b.icon) updates.icon = b.icon;
  if (b.primary_field) updates.primaryField = b.primary_field;

  const [updated] = await db
    .update(customObjects)
    .set(updates)
    .where(eq(customObjects.id, obj.id))
    .returning();

  return c.json({
    ...updated,
    api_name: updated!.key,
    singular_label: updated!.label,
    plural_label: updated!.pluralLabel,
  });
});

// DELETE /:key - Delete custom object and all associated records
objectsRouter.delete('/:key', async (c) => {
  const scope = c.get('scope');
  const key = c.req.param('key');

  const obj = await db.query.customObjects.findFirst({
    where: and(
      eq(customObjects.tenantId, scope.tenant_id),
      or(eq(customObjects.key, key), eq(customObjects.id, key))
    ),
  });

  if (!obj) {
    return c.json({ code: 'NOT_FOUND', message: `Custom object '${key}' not found` }, 404);
  }

  await db.transaction(async (tx) => {
    await tx.delete(fieldDefinitions).where(and(eq(fieldDefinitions.tenantId, scope.tenant_id), eq(fieldDefinitions.entityType, obj.key)));
    await tx.delete(flexRecords).where(and(eq(flexRecords.tenantId, scope.tenant_id), eq(flexRecords.customObjectId, obj.id)));
    await tx.delete(customObjects).where(eq(customObjects.id, obj.id));
  });

  return c.json({ message: `Custom object '${obj.key}' deleted successfully` });
});

/* ------------------------------------------------------------------ */
/*  2. Flex Records CRUD                                              */
/* ------------------------------------------------------------------ */

// GET /:key/records - List records with pagination and search
objectsRouter.get('/:key/records', async (c) => {
  const scope = c.get('scope');
  const key = c.req.param('key');
  const query = c.req.query('q');
  const status = c.req.query('status');
  const cursor = c.req.query('cursor');
  const limit = Math.min(Math.max(Number(c.req.query('limit')) || 50, 1), 100);

  const obj = await db.query.customObjects.findFirst({
    where: and(eq(customObjects.tenantId, scope.tenant_id), eq(customObjects.key, key)),
  });

  if (!obj) {
    return c.json({ code: 'NOT_FOUND', message: `Custom object '${key}' not found` }, 404);
  }

  const conditions = [
    eq(flexRecords.tenantId, scope.tenant_id),
    eq(flexRecords.customObjectId, obj.id),
  ];

  if (status) conditions.push(eq(flexRecords.status, status));
  if (query) conditions.push(ilike(flexRecords.name, `%${query}%`));
  if (cursor) {
    const cursorDate = new Date(cursor);
    if (!isNaN(cursorDate.getTime())) {
      conditions.push(lt(flexRecords.createdAt, cursorDate));
    }
  }

  const list = await db.query.flexRecords.findMany({
    where: and(...conditions),
    orderBy: [desc(flexRecords.createdAt)],
    limit: limit + 1,
    with: {
      assignedTo: { columns: { id: true, name: true, email: true } },
      branch: { columns: { id: true, name: true } },
    },
  });

  const hasNext = list.length > limit;
  const items = hasNext ? list.slice(0, limit) : list;
  const nextCursor = hasNext && items.length > 0 ? items[items.length - 1]!.createdAt.toISOString() : undefined;

  return c.json({
    data: items.map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      data: r.data,
      assigned_to: r.assignedTo,
      branch: r.branch,
      created_at: r.createdAt.toISOString(),
      updated_at: r.updatedAt.toISOString(),
    })),
    next_cursor: nextCursor,
  });
});

// POST /:key/records - Create a new flex record
objectsRouter.post('/:key/records', async (c) => {
  const scope = c.get('scope');
  const key = c.req.param('key');
  const body = await c.req.json().catch(() => ({}));

  const obj = await db.query.customObjects.findFirst({
    where: and(eq(customObjects.tenantId, scope.tenant_id), eq(customObjects.key, key)),
  });

  if (!obj) {
    return c.json({ code: 'NOT_FOUND', message: `Custom object '${key}' not found` }, 404);
  }

  const name = body.name || body[obj.primaryField] || 'Untitled Record';

  const [created] = await db
    .insert(flexRecords)
    .values({
      tenantId: scope.tenant_id,
      customObjectId: obj.id,
      objectKey: obj.key,
      name: String(name),
      status: body.status || 'active',
      data: body.data || body,
      assignedToId: body.assigned_to_id || null,
      branchId: body.branch_id || scope.branch_id || null,
    })
    .returning();

  return c.json(created, 201);
});

// GET /:key/records/:recordId - Get single flex record
objectsRouter.get('/:key/records/:recordId', async (c) => {
  const scope = c.get('scope');
  const key = c.req.param('key');
  const recordId = c.req.param('recordId');

  const record = await db.query.flexRecords.findFirst({
    where: and(
      eq(flexRecords.id, recordId),
      eq(flexRecords.tenantId, scope.tenant_id),
      eq(flexRecords.objectKey, key)
    ),
    with: {
      assignedTo: { columns: { id: true, name: true, email: true } },
      branch: { columns: { id: true, name: true } },
    },
  });

  if (!record) {
    return c.json({ code: 'NOT_FOUND', message: 'Record not found' }, 404);
  }

  return c.json({
    id: record.id,
    name: record.name,
    status: record.status,
    data: record.data,
    assigned_to: record.assignedTo,
    branch: record.branch,
    created_at: record.createdAt.toISOString(),
    updated_at: record.updatedAt.toISOString(),
  });
});

// PATCH /:key/records/:recordId - Update single flex record
objectsRouter.patch('/:key/records/:recordId', async (c) => {
  const scope = c.get('scope');
  const key = c.req.param('key');
  const recordId = c.req.param('recordId');
  const body = await c.req.json().catch(() => ({}));

  const updateFields: Record<string, any> = {};
  if (body.name !== undefined) updateFields['name'] = body.name;
  if (body.status !== undefined) updateFields['status'] = body.status;
  if (body.assigned_to_id !== undefined) updateFields['assignedToId'] = body.assigned_to_id;
  if (body.branch_id !== undefined) updateFields['branchId'] = body.branch_id;

  if (body.data !== undefined) {
    const existing = await db.query.flexRecords.findFirst({
      where: and(eq(flexRecords.id, recordId), eq(flexRecords.tenantId, scope.tenant_id)),
    });
    if (existing) {
      updateFields['data'] = {
        ...(existing.data as Record<string, any>),
        ...body.data,
      };
    }
  }

  const [updated] = await db
    .update(flexRecords)
    .set(updateFields)
    .where(and(eq(flexRecords.id, recordId), eq(flexRecords.tenantId, scope.tenant_id), eq(flexRecords.objectKey, key)))
    .returning();

  if (!updated) {
    return c.json({ code: 'NOT_FOUND', message: 'Record not found' }, 404);
  }

  return c.json(updated);
});

// DELETE /:key/records/:recordId - Delete record
objectsRouter.delete('/:key/records/:recordId', async (c) => {
  const scope = c.get('scope');
  const key = c.req.param('key');
  const recordId = c.req.param('recordId');

  await db
    .delete(flexRecords)
    .where(and(eq(flexRecords.id, recordId), eq(flexRecords.tenantId, scope.tenant_id), eq(flexRecords.objectKey, key)));

  return c.json({ message: 'Record deleted successfully' });
});

/* ------------------------------------------------------------------ */
/*  3. Package Manifest Instant Importer (The 2-AM Solution)           */
/* ------------------------------------------------------------------ */

const packageSchema = z.object({
  domain: z.string().min(1),
  objects: z.array(
    z.object({
      key: z.string().min(2),
      label: z.string().min(1),
      plural_label: z.string().min(1),
      icon: z.string().default('Layers'),
      primary_field: z.string().default('name'),
      fields: z.array(
        z.object({
          name: z.string().min(1),
          label: z.string().min(1),
          field_type: z.string().default('text'),
          options: z.array(z.string()).optional(),
          required: z.boolean().default(false),
        })
      ),
    })
  ),
});

objectsRouter.post('/package/install', validateJson(packageSchema), async (c) => {
  const scope = c.get('scope');
  const pkg = c.get('validatedJson' as any) as z.infer<typeof packageSchema>;

  const createdSummary = await db.transaction(async (tx) => {
    const installedObjects = [];

    for (const objDef of pkg.objects) {
      let [existing] = await tx
        .select()
        .from(customObjects)
        .where(and(eq(customObjects.tenantId, scope.tenant_id), eq(customObjects.key, objDef.key)));

      if (!existing) {
        const [inserted] = await tx
          .insert(customObjects)
          .values({
            tenantId: scope.tenant_id,
            key: objDef.key,
            label: objDef.label,
            pluralLabel: objDef.plural_label,
            domain: pkg.domain,
            icon: objDef.icon,
            primaryField: objDef.primary_field,
          })
          .returning();
        existing = inserted!;
      }

      for (let i = 0; i < objDef.fields.length; i++) {
        const f = objDef.fields[i]!;
        const [fieldExisting] = await tx
          .select()
          .from(fieldDefinitions)
          .where(
            and(
              eq(fieldDefinitions.tenantId, scope.tenant_id),
              eq(fieldDefinitions.entityType, objDef.key),
              eq(fieldDefinitions.name, f.name)
            )
          );

        if (!fieldExisting) {
          await tx.insert(fieldDefinitions).values({
            tenantId: scope.tenant_id,
            entityType: objDef.key,
            name: f.name,
            label: f.label,
            fieldType: f.field_type,
            options: f.options || null,
            required: f.required,
            order: i + 1,
          });
        }
      }

      installedObjects.push(existing);
    }

    return installedObjects;
  });

  return c.json({
    success: true,
    domain: pkg.domain,
    installed_objects: createdSummary.map((o) => ({ key: o.key, label: o.label })),
  });
});
