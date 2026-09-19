import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and, desc, ilike } from 'drizzle-orm';
import { db } from '../db';
import { fieldDefinitions } from '../db/schema';
import { validateJson } from '../middleware/validator';
import { requireAuth } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import type { AppEnv } from '../types/context';

export const fieldsRouter = new Hono<AppEnv>();

fieldsRouter.use('*', requireAuth, requireTenant);

fieldsRouter.get('/', async (c) => {
  const scope = c.get('scope');
  const entityType = c.req.query('entity_type');

  const conditions = [eq(fieldDefinitions.tenantId, scope.tenant_id)];
  if (entityType) conditions.push(ilike(fieldDefinitions.entityType, entityType));

  const results = await db.query.fieldDefinitions.findMany({
    where: and(...conditions),
    orderBy: [fieldDefinitions.order],
  });

  return c.json(results);
});

const fieldSchema = z.object({
  entity_type: z.string().min(1),
  name: z.string().min(1),
  label: z.string().min(1),
  field_type: z.string().min(1),
  options: z.array(z.string()).optional(),
  required: z.boolean().default(false),
  order: z.number().default(0),
  visibility_rules: z.array(z.any()).optional(),
  related_to: z.string().optional().nullable(),
});

fieldsRouter.post('/', validateJson(fieldSchema), async (c) => {
  const scope = c.get('scope');
  const body = c.get('validatedJson' as any) as z.infer<typeof fieldSchema>;

  const [created] = await db
    .insert(fieldDefinitions)
    .values({
      tenantId: scope.tenant_id,
      entityType: body.entity_type,
      name: body.name,
      label: body.label,
      fieldType: body.field_type,
      options: body.options || null,
      required: body.required,
      order: body.order,
      visibilityRules: body.visibility_rules || [],
      relatedTo: body.related_to || null,
    })
    .returning();

  return c.json(created, 201);
});

fieldsRouter.patch('/:id', async (c) => {
  const scope = c.get('scope');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));

  const updateFields: Record<string, any> = {};
  if (body.label !== undefined) updateFields['label'] = body.label;
  if (body.field_type !== undefined) updateFields['fieldType'] = body.field_type;
  if (body.options !== undefined) updateFields['options'] = body.options;
  if (body.required !== undefined) updateFields['required'] = body.required;
  if (body.order !== undefined) updateFields['order'] = body.order;
  if (body.visibility_rules !== undefined) updateFields['visibilityRules'] = body.visibility_rules;

  const [updated] = await db
    .update(fieldDefinitions)
    .set(updateFields)
    .where(and(eq(fieldDefinitions.id, id), eq(fieldDefinitions.tenantId, scope.tenant_id)))
    .returning();

  if (!updated) {
    return c.json({ code: 'NOT_FOUND', message: 'Field definition not found' }, 404);
  }

  return c.json(updated);
});

fieldsRouter.delete('/:id', async (c) => {
  const scope = c.get('scope');
  const id = c.req.param('id');

  const [deleted] = await db
    .delete(fieldDefinitions)
    .where(and(eq(fieldDefinitions.id, id), eq(fieldDefinitions.tenantId, scope.tenant_id)))
    .returning();

  if (!deleted) {
    return c.json({ code: 'NOT_FOUND', message: 'Field definition not found' }, 404);
  }

  return c.json({ message: 'Field definition deleted successfully' });
});
