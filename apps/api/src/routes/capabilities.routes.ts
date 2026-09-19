import { Hono } from 'hono';
import { eq, and, desc, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  tenants,
  appointments,
  invoices,
  invoiceLineItems,
  payments,
  properties,
  orders,
  orderLineItems,
  onboardings,
  onboardingSteps,
  tasks,
  notes,
  callLogs,
  stock,
  stockMovements,
} from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import type { AppEnv } from '../types/context';

export const capabilitiesRouter = new Hono<AppEnv>();

capabilitiesRouter.use('*', requireAuth, requireTenant);

const ALL_CAPABILITIES = [
  { id: 'capability/appointment', name: 'Appointments', description: 'Schedule and manage client appointments and rooms' },
  { id: 'capability/billing', name: 'Billing & Invoices', description: 'Generate invoices, line items, and record payments' },
  { id: 'capability/property-listing', name: 'Real Estate & Properties', description: 'Manage properties, units, and real estate inventory' },
  { id: 'capability/order-management', name: 'Order Management', description: 'Manage orders, fulfillment, and product transactions' },
  { id: 'capability/customer-onboarding', name: 'Customer Onboarding', description: 'Track client onboarding checklists and milestones' },
  { id: 'capability/workspace', name: 'Workspace (Tasks & Notes)', description: 'Collaborative team tasks and contextual notes' },
  { id: 'capability/academics', name: 'Academics & Education', description: 'Courses, batches, enrollments, exams, and attendance' },
  { id: 'capability/finance', name: 'Tuition & Fee Plans', description: 'Fee plans, installments, and student scholarships' },
  { id: 'capability/hr', name: 'HR & People Management', description: 'Departments, employees, leave requests, and payroll' },
  { id: 'capability/operations', name: 'Operations & Inventory', description: 'Warehouses, stock levels, movements, and fixed assets' },
  { id: 'capability/telephony', name: 'Telephony & Call Logs', description: 'Call logging, outcomes, and recording links' },
];

// GET /capabilities - List capability enablement for current workspace
capabilitiesRouter.get('/capabilities', async (c) => {
  const scope = c.get('scope');

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, scope.tenant_id),
    columns: { configJson: true },
  });

  const enabledList: string[] = (tenant?.configJson as any)?.enabled_capabilities || [];

  const results = ALL_CAPABILITIES.map((cap) => ({
    ...cap,
    enabled: enabledList.includes(cap.id),
  }));

  return c.json(results);
});

// PATCH /capabilities/:id - Toggle capability
capabilitiesRouter.patch('/capabilities/:id{.+}', async (c) => {
  const scope = c.get('scope');
  const capId = decodeURIComponent(c.req.param('id'));
  const { enabled } = await c.req.json().catch(() => ({}));

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, scope.tenant_id),
  });

  if (!tenant) {
    return c.json({ code: 'NOT_FOUND', message: 'Tenant not found' }, 404);
  }

  const currentConfig = (tenant.configJson as Record<string, any>) || {};
  let currentList: string[] = currentConfig['enabled_capabilities'] || [];

  if (enabled) {
    if (!currentList.includes(capId)) currentList.push(capId);
  } else {
    currentList = currentList.filter((id) => id !== capId);
  }

  const newConfig = { ...currentConfig, enabled_capabilities: currentList };

  await db.update(tenants).set({ configJson: newConfig }).where(eq(tenants.id, scope.tenant_id));

  return c.json({ id: capId, enabled: Boolean(enabled) });
});

// --- APPOINTMENTS ---
capabilitiesRouter.get('/appointments', async (c) => {
  const scope = c.get('scope');
  const partyId = c.req.query('party_id');
  const conditions = [eq(appointments.tenantId, scope.tenant_id)];
  if (partyId) conditions.push(eq(appointments.partyId, partyId));

  const list = await db.query.appointments.findMany({
    where: and(...conditions),
    orderBy: [desc(appointments.startTime)],
    with: {
      party: { columns: { id: true, name: true, email: true, phoneNormalized: true } },
      user: { columns: { id: true, name: true, email: true } },
    },
  });

  return c.json(list);
});

capabilitiesRouter.post('/appointments', async (c) => {
  const scope = c.get('scope');
  const b = await c.req.json();

  const [created] = await db
    .insert(appointments)
    .values({
      tenantId: scope.tenant_id,
      partyId: b.party_id,
      userId: b.user_id || scope.user_id,
      title: b.title,
      description: b.description,
      startTime: new Date(b.start_time),
      endTime: new Date(b.end_time),
      room: b.room,
      status: b.status || 'scheduled',
    })
    .returning();

  return c.json(created, 201);
});

capabilitiesRouter.patch('/appointments/:id', async (c) => {
  const scope = c.get('scope');
  const id = c.req.param('id');
  const b = await c.req.json();

  const updateFields: Record<string, any> = {};
  if (b.title !== undefined) updateFields['title'] = b.title;
  if (b.description !== undefined) updateFields['description'] = b.description;
  if (b.start_time !== undefined) updateFields['startTime'] = new Date(b.start_time);
  if (b.end_time !== undefined) updateFields['endTime'] = new Date(b.end_time);
  if (b.room !== undefined) updateFields['room'] = b.room;
  if (b.status !== undefined) updateFields['status'] = b.status;

  const [updated] = await db
    .update(appointments)
    .set(updateFields)
    .where(and(eq(appointments.id, id), eq(appointments.tenantId, scope.tenant_id)))
    .returning();

  if (!updated) return c.json({ code: 'NOT_FOUND', message: 'Appointment not found' }, 404);
  return c.json(updated);
});

// --- INVOICES & BILLING ---
capabilitiesRouter.get('/invoices', async (c) => {
  const scope = c.get('scope');
  const partyId = c.req.query('party_id');
  const conditions = [eq(invoices.tenantId, scope.tenant_id)];
  if (partyId) conditions.push(eq(invoices.partyId, partyId));

  const list = await db.query.invoices.findMany({
    where: and(...conditions),
    orderBy: [desc(invoices.issueDate)],
    with: {
      party: { columns: { id: true, name: true, email: true } },
      items: true,
      payments: true,
    },
  });
  return c.json(list);
});

capabilitiesRouter.get('/invoices/stats', async (c) => {
  const scope = c.get('scope');

  const invStats = await db
    .select({
      totalBilled: sql<number>`coalesce(sum(${invoices.amount}), 0)`,
    })
    .from(invoices)
    .where(eq(invoices.tenantId, scope.tenant_id));

  const payStats = await db
    .select({
      totalPaid: sql<number>`coalesce(sum(${payments.amount}), 0)`,
    })
    .from(payments)
    .where(eq(payments.tenantId, scope.tenant_id));

  const totalBilled = Number(invStats[0]?.totalBilled || 0);
  const totalPaid = Number(payStats[0]?.totalPaid || 0);

  return c.json({
    total_billed: totalBilled,
    total_paid: totalPaid,
    outstanding: Math.max(totalBilled - totalPaid, 0),
  });
});

capabilitiesRouter.post('/invoices', async (c) => {
  const scope = c.get('scope');
  const b = await c.req.json();

  const result = await db.transaction(async (tx) => {
    const [inv] = await tx
      .insert(invoices)
      .values({
        tenantId: scope.tenant_id,
        partyId: b.party_id,
        orderId: b.order_id || null,
        branchId: b.branch_id || scope.branch_id || null,
        subtotal: b.subtotal !== undefined ? Number(b.subtotal) : null,
        taxAmount: Number(b.tax_amount) || 0,
        discountAmount: Number(b.discount_amount) || 0,
        amount: Number(b.amount) || 0,
        currency: b.currency || 'USD',
        status: b.status || 'draft',
        issueDate: b.issue_date ? new Date(b.issue_date) : new Date(),
        dueDate: new Date(b.due_date),
        billingDetails: b.billing_details || {},
      })
      .returning();

    if (Array.isArray(b.items) && b.items.length > 0) {
      await tx.insert(invoiceLineItems).values(
        b.items.map((item: any) => ({
          invoiceId: inv!.id,
          productId: item.product_id || null,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          amount: item.amount,
        }))
      );
    }

    return tx.query.invoices.findFirst({
      where: eq(invoices.id, inv!.id),
      with: { items: true, payments: true },
    });
  });

  return c.json(result, 201);
});

capabilitiesRouter.post('/invoices/:id/payments', async (c) => {
  const scope = c.get('scope');
  const invoiceId = c.req.param('id');
  const b = await c.req.json();

  const [payment] = await db
    .insert(payments)
    .values({
      tenantId: scope.tenant_id,
      invoiceId,
      amount: Number(b.amount),
      method: b.method,
      reference: b.reference,
      paymentDate: b.payment_date ? new Date(b.payment_date) : new Date(),
    })
    .returning();

  // If invoice is fully paid, update status
  const totalPaidRes = await db
    .select({ total: sql<number>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .where(eq(payments.invoiceId, invoiceId));

  const totalPaid = Number(totalPaidRes[0]?.total || 0);
  const inv = await db.query.invoices.findFirst({ where: eq(invoices.id, invoiceId) });

  if (inv && totalPaid >= inv.amount) {
    await db.update(invoices).set({ status: 'paid' }).where(eq(invoices.id, invoiceId));
  }

  return c.json(payment, 201);
});

// --- ORDERS ---
capabilitiesRouter.get('/orders', async (c) => {
  const scope = c.get('scope');
  const partyId = c.req.query('party_id');
  const status = c.req.query('status');

  const conditions = [eq(orders.tenantId, scope.tenant_id)];
  if (partyId) conditions.push(eq(orders.partyId, partyId));
  if (status) conditions.push(eq(orders.status, status as any));

  const list = await db.query.orders.findMany({
    where: and(...conditions),
    orderBy: [desc(orders.createdAt)],
    with: {
      party: { columns: { id: true, name: true, email: true } },
      items: true,
    },
  });
  return c.json(list);
});

capabilitiesRouter.get('/orders/:id', async (c) => {
  const scope = c.get('scope');
  const id = c.req.param('id');

  const order = await db.query.orders.findFirst({
    where: and(eq(orders.id, id), eq(orders.tenantId, scope.tenant_id)),
    with: {
      party: { columns: { id: true, name: true, email: true } },
      items: true,
      invoices: true,
    },
  });

  if (!order) return c.json({ code: 'NOT_FOUND', message: 'Order not found' }, 404);
  return c.json(order);
});

capabilitiesRouter.post('/orders', async (c) => {
  const scope = c.get('scope');
  const b = await c.req.json();

  const result = await db.transaction(async (tx) => {
    const [ord] = await tx
      .insert(orders)
      .values({
        tenantId: scope.tenant_id,
        partyId: b.party_id,
        branchId: b.branch_id || scope.branch_id || null,
        totalAmount: Number(b.total_amount) || 0,
        currency: b.currency || 'USD',
        status: b.status || 'pending',
        paymentMethod: b.payment_method || null,
        paymentStatus: b.payment_status || 'unpaid',
        notes: b.notes || null,
      })
      .returning();

    if (Array.isArray(b.items) && b.items.length > 0) {
      await tx.insert(orderLineItems).values(
        b.items.map((it: any) => ({
          orderId: ord!.id,
          productId: it.product_id || null,
          productName: it.product_name,
          quantity: Number(it.quantity) || 1,
          unitPrice: Number(it.unit_price) || 0,
          amount: Number(it.amount) || (Number(it.quantity) || 1) * (Number(it.unit_price) || 0),
        }))
      );

      // Optional ERP stock deduction if warehouse specified
      if (b.deduct_stock && b.warehouse_id) {
        for (const it of b.items) {
          if (it.product_id) {
            const qty = Number(it.quantity) || 1;
            const currentStock = await tx.query.stock.findFirst({
              where: and(
                eq(stock.tenantId, scope.tenant_id),
                eq(stock.productId, it.product_id),
                eq(stock.warehouseId, b.warehouse_id)
              ),
            });

            if (currentStock) {
              await tx
                .update(stock)
                .set({
                  quantity: Math.max(currentStock.quantity - qty, 0),
                })
                .where(eq(stock.id, currentStock.id));

              await tx.insert(stockMovements).values({
                tenantId: scope.tenant_id,
                productId: it.product_id,
                warehouseId: b.warehouse_id,
                type: 'out',
                quantity: qty,
                reference: ord!.id,
                notes: `Fulfilled for Order ${ord!.id}`,
              });
            }
          }
        }
      }
    }

    return tx.query.orders.findFirst({
      where: eq(orders.id, ord!.id),
      with: { items: true },
    });
  });

  return c.json(result, 201);
});

capabilitiesRouter.patch('/orders/:id', async (c) => {
  const scope = c.get('scope');
  const id = c.req.param('id');
  const b = await c.req.json();

  const updateFields: Record<string, any> = {};
  if (b.status !== undefined) updateFields['status'] = b.status;
  if (b.payment_status !== undefined) updateFields['paymentStatus'] = b.payment_status;
  if (b.payment_method !== undefined) updateFields['paymentMethod'] = b.payment_method;
  if (b.notes !== undefined) updateFields['notes'] = b.notes;
  if (b.total_amount !== undefined) updateFields['totalAmount'] = Number(b.total_amount);

  const [updated] = await db
    .update(orders)
    .set(updateFields)
    .where(and(eq(orders.id, id), eq(orders.tenantId, scope.tenant_id)))
    .returning();

  if (!updated) return c.json({ code: 'NOT_FOUND', message: 'Order not found' }, 404);

  const fullOrder = await db.query.orders.findFirst({
    where: eq(orders.id, id),
    with: { items: true, party: { columns: { id: true, name: true, email: true } } },
  });

  return c.json(fullOrder);
});

// POST /orders/:id/create-invoice - Seamless CRM/ERP Conversion
capabilitiesRouter.post('/orders/:id/create-invoice', async (c) => {
  const scope = c.get('scope');
  const orderId = c.req.param('id');

  const order = await db.query.orders.findFirst({
    where: and(eq(orders.id, orderId), eq(orders.tenantId, scope.tenant_id)),
    with: { items: true },
  });

  if (!order) {
    return c.json({ code: 'NOT_FOUND', message: 'Order not found' }, 404);
  }

  const createdInvoice = await db.transaction(async (tx) => {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30); // 30-day payment term

    const [inv] = await tx
      .insert(invoices)
      .values({
        tenantId: scope.tenant_id,
        partyId: order.partyId,
        orderId: order.id,
        branchId: order.branchId,
        amount: order.totalAmount,
        subtotal: order.totalAmount,
        currency: order.currency,
        status: 'draft',
        issueDate: new Date(),
        dueDate,
        billingDetails: { source: 'order_conversion', order_id: order.id },
      })
      .returning();

    if (order.items && order.items.length > 0) {
      await tx.insert(invoiceLineItems).values(
        order.items.map((item) => ({
          invoiceId: inv!.id,
          productId: item.productId,
          description: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount,
        }))
      );
    }

    return tx.query.invoices.findFirst({
      where: eq(invoices.id, inv!.id),
      with: { items: true, order: true },
    });
  });

  return c.json(createdInvoice, 201);
});

// --- PROPERTIES ---
capabilitiesRouter.get('/properties', async (c) => {
  const scope = c.get('scope');
  const list = await db.query.properties.findMany({
    where: eq(properties.tenantId, scope.tenant_id),
    orderBy: [desc(properties.createdAt)],
  });
  return c.json(list);
});

capabilitiesRouter.post('/properties', async (c) => {
  const scope = c.get('scope');
  const b = await c.req.json();

  const [prop] = await db
    .insert(properties)
    .values({
      tenantId: scope.tenant_id,
      title: b.title,
      description: b.description,
      address: b.address,
      city: b.city,
      price: Number(b.price) || 0,
      bedrooms: Number(b.bedrooms) || 0,
      bathrooms: Number(b.bathrooms) || 0,
      squareFootage: Number(b.square_footage) || 0,
      status: b.status || 'available',
      images: b.images || [],
    })
    .returning();

  return c.json(prop, 201);
});

// --- ONBOARDINGS ---
capabilitiesRouter.get('/onboardings', async (c) => {
  const scope = c.get('scope');
  const list = await db.query.onboardings.findMany({
    where: eq(onboardings.tenantId, scope.tenant_id),
    orderBy: [desc(onboardings.createdAt)],
    with: {
      party: { columns: { id: true, name: true } },
      steps: { orderBy: (steps: any, { asc }: any) => [asc(steps.order)] },
    },
  });
  return c.json(list);
});

capabilitiesRouter.post('/onboardings', async (c) => {
  const scope = c.get('scope');
  const b = await c.req.json();

  const result = await db.transaction(async (tx) => {
    const [onb] = await tx
      .insert(onboardings)
      .values({
        tenantId: scope.tenant_id,
        partyId: b.party_id,
        status: b.status || 'active',
        contractValue: b.contract_value ? Number(b.contract_value) : null,
        setupCompleted: false,
      })
      .returning();

    if (Array.isArray(b.steps) && b.steps.length > 0) {
      await tx.insert(onboardingSteps).values(
        b.steps.map((st: any, idx: number) => ({
          onboardingId: onb!.id,
          title: st.title,
          completed: false,
          order: idx,
        }))
      );
    }

    return tx.query.onboardings.findFirst({
      where: eq(onboardings.id, onb!.id),
      with: { steps: true },
    });
  });

  return c.json(result, 201);
});

// --- WORKSPACE: TASKS & NOTES ---
capabilitiesRouter.get('/tasks', async (c) => {
  const scope = c.get('scope');
  const list = await db.query.tasks.findMany({
    where: eq(tasks.tenantId, scope.tenant_id),
    orderBy: [desc(tasks.createdAt)],
    with: {
      assignee: { columns: { id: true, name: true } },
    },
  });
  return c.json(list);
});

capabilitiesRouter.post('/tasks', async (c) => {
  const scope = c.get('scope');
  const b = await c.req.json();

  const [task] = await db
    .insert(tasks)
    .values({
      tenantId: scope.tenant_id,
      title: b.title,
      description: b.description,
      status: b.status || 'todo',
      priority: b.priority || 'medium',
      dueDate: b.due_date ? new Date(b.due_date) : null,
      assigneeId: b.assignee_id || scope.user_id,
      relatedType: b.related_type,
      relatedId: b.related_id,
    })
    .returning();

  return c.json(task, 201);
});

capabilitiesRouter.patch('/tasks/:id', async (c) => {
  const scope = c.get('scope');
  const id = c.req.param('id');
  const b = await c.req.json();

  const updateFields: Record<string, any> = {};
  if (b.title !== undefined) updateFields['title'] = b.title;
  if (b.description !== undefined) updateFields['description'] = b.description;
  if (b.status !== undefined) updateFields['status'] = b.status;
  if (b.priority !== undefined) updateFields['priority'] = b.priority;
  if (b.due_date !== undefined) updateFields['dueDate'] = b.due_date ? new Date(b.due_date) : null;
  if (b.assignee_id !== undefined) updateFields['assigneeId'] = b.assignee_id;

  const [updated] = await db
    .update(tasks)
    .set(updateFields)
    .where(and(eq(tasks.id, id), eq(tasks.tenantId, scope.tenant_id)))
    .returning();

  if (!updated) return c.json({ code: 'NOT_FOUND', message: 'Task not found' }, 404);
  return c.json(updated);
});

capabilitiesRouter.delete('/tasks/:id', async (c) => {
  const scope = c.get('scope');
  const id = c.req.param('id');
  await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.tenantId, scope.tenant_id)));
  return c.json({ success: true });
});

capabilitiesRouter.get('/notes', async (c) => {
  const scope = c.get('scope');
  const relType = c.req.query('related_type');
  const relId = c.req.query('related_id');

  const conditions = [eq(notes.tenantId, scope.tenant_id)];
  if (relType && relId) {
    conditions.push(eq(notes.relatedType, relType), eq(notes.relatedId, relId));
  }

  const list = await db.query.notes.findMany({
    where: and(...conditions),
    orderBy: [desc(notes.createdAt)],
  });
  return c.json(list);
});

capabilitiesRouter.post('/notes', async (c) => {
  const scope = c.get('scope');
  const b = await c.req.json();

  const [note] = await db
    .insert(notes)
    .values({
      tenantId: scope.tenant_id,
      title: b.title,
      content: b.content,
      relatedType: b.related_type,
      relatedId: b.related_id,
    })
    .returning();

  return c.json(note, 201);
});

capabilitiesRouter.delete('/notes/:id', async (c) => {
  const scope = c.get('scope');
  const id = c.req.param('id');
  await db.delete(notes).where(and(eq(notes.id, id), eq(notes.tenantId, scope.tenant_id)));
  return c.json({ success: true });
});

// --- TELEPHONY: CALL LOGS ---
capabilitiesRouter.get('/call-logs', async (c) => {
  const scope = c.get('scope');
  const partyId = c.req.query('party_id');
  const leadId = c.req.query('lead_id');

  const conditions = [eq(callLogs.tenantId, scope.tenant_id)];
  if (partyId) conditions.push(eq(callLogs.partyId, partyId));
  if (leadId) conditions.push(eq(callLogs.leadId, leadId));

  const list = await db.query.callLogs.findMany({
    where: and(...conditions),
    orderBy: [desc(callLogs.createdAt)],
    with: {
      party: { columns: { id: true, name: true, phoneRaw: true } },
      lead: { columns: { id: true, name: true, phone: true } },
      user: { columns: { id: true, name: true } },
    },
  });
  return c.json({ data: list });
});

capabilitiesRouter.post('/call-logs', async (c) => {
  const scope = c.get('scope');
  const b = await c.req.json();

  const [log] = await db
    .insert(callLogs)
    .values({
      tenantId: scope.tenant_id,
      partyId: b.party_id || null,
      leadId: b.lead_id || null,
      userId: b.user_id || scope.user_id,
      direction: b.direction || 'outbound',
      durationSeconds: Number(b.duration_seconds) || 0,
      recordingUrl: b.recording_url,
      status: b.status || 'completed',
      outcome: b.outcome,
      notes: b.notes,
    })
    .returning();

  return c.json(log, 201);
});
