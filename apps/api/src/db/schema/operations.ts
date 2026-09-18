import { pgTable, text, timestamp, doublePrecision, integer, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { tenants, users } from './tenants';

export const productCategories = pgTable(
  'product_categories',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    name: text('name').notNull(),
    description: text('description'),
    parentId: text('parent_id'),
  },
  (table) => [
    index('idx_categories_tenant').on(table.tenantId),
  ]
);

export const products = pgTable(
  'products',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    name: text('name').notNull(),
    sku: text('sku').notNull(),
    description: text('description'),
    unit: text('unit'),
    price: doublePrecision('price'),
    categoryId: text('category_id').references(() => productCategories.id, { onDelete: 'set null' }),
    status: text('status').default('active').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    uniqueIndex('idx_products_sku_tenant').on(table.tenantId, table.sku),
    index('idx_products_tenant').on(table.tenantId),
  ]
);

export const warehouses = pgTable(
  'warehouses',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    name: text('name').notNull(),
    location: text('location'),
    status: text('status').default('active').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_warehouses_tenant').on(table.tenantId),
  ]
);

export const stock = pgTable(
  'stock',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    productId: text('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
    warehouseId: text('warehouse_id').references(() => warehouses.id, { onDelete: 'cascade' }).notNull(),
    quantity: integer('quantity').default(0).notNull(),
    minStockLevel: integer('min_stock_level').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    uniqueIndex('idx_stock_unique').on(table.tenantId, table.productId, table.warehouseId),
    index('idx_stock_tenant').on(table.tenantId),
  ]
);

export const stockMovements = pgTable(
  'stock_movements',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    productId: text('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
    warehouseId: text('warehouse_id').references(() => warehouses.id, { onDelete: 'cascade' }).notNull(),
    type: text('type').notNull(), // in | out | transfer | adjustment
    quantity: integer('quantity').notNull(),
    reference: text('reference'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_movements_tenant').on(table.tenantId),
    index('idx_movements_product').on(table.productId),
    index('idx_movements_warehouse').on(table.warehouseId),
  ]
);

export const assets = pgTable(
  'assets',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    name: text('name').notNull(),
    assetCode: text('asset_code').notNull(),
    type: text('type'),
    status: text('status').default('available').notNull(),
    assignedToId: text('assigned_to_id').references(() => users.id, { onDelete: 'set null' }),
    purchaseDate: timestamp('purchase_date'),
    purchaseCost: doublePrecision('purchase_cost'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    uniqueIndex('idx_assets_code_tenant').on(table.tenantId, table.assetCode),
    index('idx_assets_tenant').on(table.tenantId),
  ]
);

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(productCategories, { fields: [products.categoryId], references: [productCategories.id] }),
  stock: many(stock),
}));

export const stockRelations = relations(stock, ({ one }) => ({
  product: one(products, { fields: [stock.productId], references: [products.id] }),
  warehouse: one(warehouses, { fields: [stock.warehouseId], references: [warehouses.id] }),
}));
