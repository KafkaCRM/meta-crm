import { Hono } from 'hono';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { db } from '../db';
import {
  tenants,
  products,
  productCategories,
  warehouses,
  stock,
  stockMovements,
  assets,
} from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import type { AppEnv } from '../types/context';

export const operationsRouter = new Hono<AppEnv>();

operationsRouter.use('*', requireAuth, requireTenant);

// --- PRODUCTS & CATEGORIES ---
operationsRouter.get('/products', async (c) => {
  const scope = c.get('scope');

  const currentTenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, scope.tenant_id),
    columns: { id: true, parentTenantId: true },
  });

  const targetTenantIds = [scope.tenant_id];
  if (currentTenant?.parentTenantId) {
    targetTenantIds.push(currentTenant.parentTenantId);
  }

  const list = await db.query.products.findMany({
    where: inArray(products.tenantId, targetTenantIds),
    orderBy: [desc(products.createdAt)],
    with: {
      category: { columns: { id: true, name: true } },
    },
  });

  const formatted = list.map((p) => ({
    ...p,
    is_master_catalog: p.tenantId !== scope.tenant_id,
  }));

  return c.json(formatted);
});

operationsRouter.post('/products', async (c) => {
  const scope = c.get('scope');
  const b = await c.req.json();

  const [created] = await db
    .insert(products)
    .values({
      tenantId: scope.tenant_id,
      name: b.name,
      sku: b.sku,
      description: b.description,
      unit: b.unit,
      price: b.price ? Number(b.price) : null,
      categoryId: b.category_id || null,
      status: b.status || 'active',
    })
    .returning();

  return c.json(created, 201);
});

operationsRouter.get('/product-categories', async (c) => {
  const scope = c.get('scope');
  const list = await db.query.productCategories.findMany({
    where: eq(productCategories.tenantId, scope.tenant_id),
  });
  return c.json(list);
});

operationsRouter.post('/product-categories', async (c) => {
  const scope = c.get('scope');
  const b = await c.req.json();

  const [created] = await db
    .insert(productCategories)
    .values({
      tenantId: scope.tenant_id,
      name: b.name,
      description: b.description,
      parentId: b.parent_id || null,
    })
    .returning();

  return c.json(created, 201);
});

// --- WAREHOUSES & STOCK ---
operationsRouter.get('/warehouses', async (c) => {
  const scope = c.get('scope');
  const list = await db.query.warehouses.findMany({
    where: eq(warehouses.tenantId, scope.tenant_id),
  });
  return c.json(list);
});

operationsRouter.post('/warehouses', async (c) => {
  const scope = c.get('scope');
  const b = await c.req.json();

  const [created] = await db
    .insert(warehouses)
    .values({
      tenantId: scope.tenant_id,
      name: b.name,
      location: b.location,
      status: b.status || 'active',
    })
    .returning();

  return c.json(created, 201);
});

operationsRouter.get('/stock', async (c) => {
  const scope = c.get('scope');
  const list = await db.query.stock.findMany({
    where: eq(stock.tenantId, scope.tenant_id),
    with: {
      product: { columns: { id: true, name: true, sku: true } },
      warehouse: { columns: { id: true, name: true } },
    },
  });
  return c.json(list);
});

operationsRouter.get('/stock-movements', async (c) => {
  const scope = c.get('scope');
  const list = await db.query.stockMovements.findMany({
    where: eq(stockMovements.tenantId, scope.tenant_id),
    orderBy: [desc(stockMovements.createdAt)],
    with: {
      product: { columns: { id: true, name: true, sku: true } },
      warehouse: { columns: { id: true, name: true } },
    },
  });
  return c.json(list);
});

// --- ASSETS ---
operationsRouter.get('/assets', async (c) => {
  const scope = c.get('scope');
  const list = await db.query.assets.findMany({
    where: eq(assets.tenantId, scope.tenant_id),
    orderBy: [desc(assets.createdAt)],
  });
  return c.json(list);
});

operationsRouter.post('/assets', async (c) => {
  const scope = c.get('scope');
  const b = await c.req.json();

  const [created] = await db
    .insert(assets)
    .values({
      tenantId: scope.tenant_id,
      name: b.name,
      assetCode: b.asset_code,
      type: b.type,
      status: b.status || 'available',
      assignedToId: b.assigned_to_id || null,
      purchaseDate: b.purchase_date ? new Date(b.purchase_date) : null,
      purchaseCost: b.purchase_cost ? Number(b.purchase_cost) : null,
      notes: b.notes,
    })
    .returning();

  return c.json(created, 201);
});
