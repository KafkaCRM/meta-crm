import { Hono } from 'hono';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { db } from '../db';
import { tenants } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import type { AppEnv } from '../types/context';

export const pageLayoutsRouter = new Hono<AppEnv>();

pageLayoutsRouter.use('*', requireAuth, requireTenant);

function getDefaultLayoutForObject(objectType: string) {
  return {
    id: `default-${objectType.toLowerCase()}-layout`,
    object_type: objectType,
    name: `Default ${objectType} Layout`,
    is_default: true,
    layout_json: {
      sections: [
        {
          id: 'sec-basic',
          name: 'Basic Information',
          columns: 2,
          fields: [
            { name: 'name', required: true },
            { name: 'email', required: false },
            { name: 'phone', required: true },
            { name: 'source', required: false },
            { name: 'type', required: false },
          ],
        },
      ],
    },
  };
}

// GET /page-layouts - List layouts by object_type
pageLayoutsRouter.get('/', async (c) => {
  const scope = c.get('scope');
  const objectType = c.req.query('object_type') || 'Party';

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, scope.tenant_id),
    columns: { configJson: true },
  });

  const config = (tenant?.configJson as Record<string, any>) || {};
  const allLayouts: any[] = config.page_layouts || [];
  const filtered = allLayouts.filter((l) => l.object_type?.toLowerCase() === objectType.toLowerCase());

  if (filtered.length === 0) {
    return c.json([getDefaultLayoutForObject(objectType)]);
  }

  return c.json(filtered);
});

// GET /page-layouts/default - Get default layout
pageLayoutsRouter.get('/default', async (c) => {
  const scope = c.get('scope');
  const objectType = c.req.query('object_type') || 'Party';

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, scope.tenant_id),
    columns: { configJson: true },
  });

  const config = (tenant?.configJson as Record<string, any>) || {};
  const allLayouts: any[] = config.page_layouts || [];
  const found = allLayouts.find(
    (l) => l.object_type?.toLowerCase() === objectType.toLowerCase() && l.is_default
  ) || allLayouts.find((l) => l.object_type?.toLowerCase() === objectType.toLowerCase());

  if (found) {
    return c.json(found);
  }

  return c.json(getDefaultLayoutForObject(objectType));
});

// POST /page-layouts - Create layout
pageLayoutsRouter.post('/', async (c) => {
  const scope = c.get('scope');
  const body = await c.req.json().catch(() => ({}));
  const { object_type, name, layout_json, is_default } = body;

  if (!object_type || !name) {
    return c.json({ code: 'VALIDATION_FAILED', message: 'object_type and name are required' }, 400);
  }

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, scope.tenant_id),
    columns: { configJson: true },
  });

  const config = (tenant?.configJson as Record<string, any>) || {};
  const allLayouts: any[] = Array.isArray(config.page_layouts) ? [...config.page_layouts] : [];

  const newLayout = {
    id: createId(),
    object_type,
    name,
    is_default: Boolean(is_default),
    layout_json: layout_json || { sections: [] },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (newLayout.is_default) {
    allLayouts.forEach((l) => {
      if (l.object_type === object_type) {
        l.is_default = false;
      }
    });
  }

  allLayouts.push(newLayout);
  config.page_layouts = allLayouts;

  await db
    .update(tenants)
    .set({ configJson: config })
    .where(eq(tenants.id, scope.tenant_id));

  return c.json(newLayout, 201);
});

// PATCH /page-layouts/:id - Update layout
pageLayoutsRouter.patch('/:id', async (c) => {
  const scope = c.get('scope');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, scope.tenant_id),
    columns: { configJson: true },
  });

  const config = (tenant?.configJson as Record<string, any>) || {};
  const allLayouts: any[] = Array.isArray(config.page_layouts) ? [...config.page_layouts] : [];
  const index = allLayouts.findIndex((l) => l.id === id);

  if (index === -1) {
    // If it was the virtual default, save it as real
    const newLayout = {
      id: id || createId(),
      object_type: body.object_type || 'Party',
      name: body.name || 'Custom Layout',
      is_default: true,
      layout_json: body.layout_json || body,
      updated_at: new Date().toISOString(),
    };
    allLayouts.push(newLayout);
    config.page_layouts = allLayouts;
    await db.update(tenants).set({ configJson: config }).where(eq(tenants.id, scope.tenant_id));
    return c.json(newLayout);
  }

  const existing = allLayouts[index];
  const updated = {
    ...existing,
    ...body,
    layout_json: body.layout_json || existing.layout_json,
    updated_at: new Date().toISOString(),
  };

  allLayouts[index] = updated;
  config.page_layouts = allLayouts;

  await db.update(tenants).set({ configJson: config }).where(eq(tenants.id, scope.tenant_id));

  return c.json(updated);
});
