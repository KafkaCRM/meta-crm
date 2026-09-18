import { pgTable, text, timestamp, jsonb, boolean, integer, doublePrecision, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { tenants, users, branches } from './tenants';
import { products } from './operations';
import { parties } from './core';
import {
  appointmentStatusEnum,
  invoiceStatusEnum,
  orderStatusEnum,
  paymentStatusEnum,
  propertyStatusEnum,
  taskStatusEnum,
  taskPriorityEnum,
} from './enums';

export const appointments = pgTable(
  'appointments',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    partyId: text('party_id').references(() => parties.id, { onDelete: 'cascade' }).notNull(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    description: text('description'),
    startTime: timestamp('start_time').notNull(),
    endTime: timestamp('end_time').notNull(),
    room: text('room'),
    status: appointmentStatusEnum('status').default('scheduled').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index('idx_appointments_tenant_start').on(table.tenantId, table.startTime),
    index('idx_appointments_tenant_party').on(table.tenantId, table.partyId),
    index('idx_appointments_tenant_user').on(table.tenantId, table.userId),
  ]
);

export const invoices = pgTable(
  'invoices',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    partyId: text('party_id').references(() => parties.id, { onDelete: 'cascade' }).notNull(),
    orderId: text('order_id').references(() => orders.id, { onDelete: 'set null' }),
    branchId: text('branch_id').references(() => branches.id, { onDelete: 'set null' }),
    subtotal: doublePrecision('subtotal'),
    taxAmount: doublePrecision('tax_amount').default(0).notNull(),
    discountAmount: doublePrecision('discount_amount').default(0).notNull(),
    amount: doublePrecision('amount').notNull(),
    currency: text('currency').default('USD').notNull(),
    status: invoiceStatusEnum('status').default('draft').notNull(),
    issueDate: timestamp('issue_date').defaultNow().notNull(),
    dueDate: timestamp('due_date').notNull(),
    billingDetails: jsonb('billing_details'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index('idx_invoices_tenant_due').on(table.tenantId, table.dueDate),
    index('idx_invoices_tenant_party').on(table.tenantId, table.partyId),
    index('idx_invoices_tenant_order').on(table.tenantId, table.orderId),
    index('idx_invoices_tenant_branch').on(table.tenantId, table.branchId),
  ]
);

export const invoiceLineItems = pgTable(
  'invoice_line_items',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    invoiceId: text('invoice_id').references(() => invoices.id, { onDelete: 'cascade' }).notNull(),
    productId: text('product_id').references(() => products.id, { onDelete: 'set null' }),
    description: text('description').notNull(),
    quantity: doublePrecision('quantity').notNull(),
    unitPrice: doublePrecision('unit_price').notNull(),
    amount: doublePrecision('amount').notNull(),
  },
  (table) => [
    index('idx_invoice_items_invoice').on(table.invoiceId),
    index('idx_invoice_items_product').on(table.productId),
  ]
);

export const payments = pgTable(
  'payments',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    invoiceId: text('invoice_id').references(() => invoices.id, { onDelete: 'cascade' }).notNull(),
    amount: doublePrecision('amount').notNull(),
    paymentDate: timestamp('payment_date').defaultNow().notNull(),
    method: text('method').notNull(),
    reference: text('reference'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_payments_tenant_invoice').on(table.tenantId, table.invoiceId),
  ]
);

export const properties = pgTable(
  'properties',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    title: text('title').notNull(),
    description: text('description'),
    address: text('address').notNull(),
    city: text('city').notNull(),
    price: doublePrecision('price').notNull(),
    bedrooms: integer('bedrooms').notNull(),
    bathrooms: doublePrecision('bathrooms').notNull(),
    squareFootage: doublePrecision('square_footage').notNull(),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    status: propertyStatusEnum('status').default('available').notNull(),
    images: jsonb('images').default([]).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index('idx_properties_tenant_price').on(table.tenantId, table.price),
    index('idx_properties_tenant_status').on(table.tenantId, table.status),
  ]
);

export const orders = pgTable(
  'orders',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    partyId: text('party_id').references(() => parties.id, { onDelete: 'cascade' }).notNull(),
    branchId: text('branch_id').references(() => branches.id, { onDelete: 'set null' }),
    totalAmount: doublePrecision('total_amount').notNull(),
    currency: text('currency').default('USD').notNull(),
    status: orderStatusEnum('status').default('pending').notNull(),
    paymentMethod: text('payment_method'),
    paymentStatus: paymentStatusEnum('payment_status').default('unpaid').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index('idx_orders_tenant_status').on(table.tenantId, table.status),
    index('idx_orders_tenant_party').on(table.tenantId, table.partyId),
    index('idx_orders_tenant_branch').on(table.tenantId, table.branchId),
  ]
);

export const orderLineItems = pgTable(
  'order_line_items',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    orderId: text('order_id').references(() => orders.id, { onDelete: 'cascade' }).notNull(),
    productId: text('product_id').references(() => products.id, { onDelete: 'set null' }),
    productName: text('product_name').notNull(),
    quantity: integer('quantity').notNull(),
    unitPrice: doublePrecision('unit_price').notNull(),
    amount: doublePrecision('amount').notNull(),
  },
  (table) => [
    index('idx_order_items_order').on(table.orderId),
    index('idx_order_items_product').on(table.productId),
  ]
);

export const onboardings = pgTable(
  'onboardings',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    partyId: text('party_id').references(() => parties.id, { onDelete: 'cascade' }).notNull(),
    status: text('status').default('active').notNull(),
    contractValue: doublePrecision('contract_value'),
    setupCompleted: boolean('setup_completed').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index('idx_onboardings_tenant_status').on(table.tenantId, table.status),
    index('idx_onboardings_tenant_party').on(table.tenantId, table.partyId),
  ]
);

export const onboardingSteps = pgTable(
  'onboarding_steps',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    onboardingId: text('onboarding_id').references(() => onboardings.id, { onDelete: 'cascade' }).notNull(),
    title: text('title').notNull(),
    completed: boolean('completed').default(false).notNull(),
    completedAt: timestamp('completed_at'),
    order: integer('order').notNull(),
  },
  (table) => [
    index('idx_onboarding_steps_onboarding').on(table.onboardingId),
  ]
);

export const tasks = pgTable(
  'tasks',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    title: text('title').notNull(),
    description: text('description'),
    status: taskStatusEnum('status').default('todo').notNull(),
    priority: taskPriorityEnum('priority').default('medium').notNull(),
    dueDate: timestamp('due_date'),
    assigneeId: text('assignee_id').references(() => users.id, { onDelete: 'set null' }),
    relatedType: text('related_type'), // Lead | Party | Order | etc.
    relatedId: text('related_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index('idx_tasks_tenant').on(table.tenantId),
    index('idx_tasks_assignee').on(table.assigneeId),
    index('idx_tasks_status').on(table.status),
  ]
);

export const notes = pgTable(
  'notes',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    title: text('title').notNull(),
    content: text('content'),
    relatedType: text('related_type'),
    relatedId: text('related_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index('idx_notes_tenant').on(table.tenantId),
    index('idx_notes_related').on(table.relatedType, table.relatedId),
  ]
);

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  party: one(parties, { fields: [appointments.partyId], references: [parties.id] }),
  user: one(users, { fields: [appointments.userId], references: [users.id] }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  party: one(parties, { fields: [invoices.partyId], references: [parties.id] }),
  order: one(orders, { fields: [invoices.orderId], references: [orders.id] }),
  branch: one(branches, { fields: [invoices.branchId], references: [branches.id] }),
  items: many(invoiceLineItems),
  payments: many(payments),
}));

export const invoiceLineItemsRelations = relations(invoiceLineItems, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceLineItems.invoiceId], references: [invoices.id] }),
  product: one(products, { fields: [invoiceLineItems.productId], references: [products.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  party: one(parties, { fields: [orders.partyId], references: [parties.id] }),
  branch: one(branches, { fields: [orders.branchId], references: [branches.id] }),
  items: many(orderLineItems),
  invoices: many(invoices),
}));

export const orderLineItemsRelations = relations(orderLineItems, ({ one }) => ({
  order: one(orders, { fields: [orderLineItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderLineItems.productId], references: [products.id] }),
}));
