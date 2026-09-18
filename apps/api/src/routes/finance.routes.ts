import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import {
  feePlans,
  feePlanInstallments,
  studentFees,
  studentFeeInstallments,
  scholarships,
} from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import type { AppEnv } from '../types/context';

export const financeRouter = new Hono<AppEnv>();

financeRouter.use('*', requireAuth, requireTenant);

// --- FEE PLANS ---
financeRouter.get('/fee-plans', async (c) => {
  const scope = c.get('scope');
  const courseId = c.req.query('course_id');

  const conditions = [eq(feePlans.tenantId, scope.tenant_id)];
  if (courseId) conditions.push(eq(feePlans.courseId, courseId));

  const list = await db.query.feePlans.findMany({
    where: and(...conditions),
    orderBy: [desc(feePlans.createdAt)],
    with: {
      course: { columns: { id: true, name: true } },
      installments: true,
    },
  });
  return c.json(list);
});

financeRouter.post('/fee-plans', async (c) => {
  const scope = c.get('scope');
  const b = await c.req.json();

  const created = await db.transaction(async (tx) => {
    const [plan] = await tx
      .insert(feePlans)
      .values({
        tenantId: scope.tenant_id,
        courseId: b.course_id,
        name: b.name,
        totalAmount: Number(b.total_amount) || 0,
        installmentsCount: Array.isArray(b.installments) ? b.installments.length : 1,
      })
      .returning();

    if (Array.isArray(b.installments) && b.installments.length > 0) {
      await tx.insert(feePlanInstallments).values(
        b.installments.map((inst: any, idx: number) => ({
          feePlanId: plan!.id,
          installmentNumber: idx + 1,
          amount: Number(inst.amount) || 0,
          dueDaysAfterAdmission: Number(inst.due_days_after_admission) || 0,
        }))
      );
    }

    return tx.query.feePlans.findFirst({
      where: eq(feePlans.id, plan!.id),
      with: { installments: true },
    });
  });

  return c.json(created, 201);
});

// --- STUDENT FEES ---
financeRouter.get('/student-fees', async (c) => {
  const scope = c.get('scope');
  const list = await db.query.studentFees.findMany({
    where: eq(studentFees.tenantId, scope.tenant_id),
    orderBy: [desc(studentFees.createdAt)],
    with: {
      enrollment: {
        with: { party: { columns: { id: true, name: true } } },
      },
      feePlan: true,
      installments: true,
    },
  });
  return c.json(list);
});

// --- SCHOLARSHIPS ---
financeRouter.get('/scholarships', async (c) => {
  const scope = c.get('scope');
  const list = await db.query.scholarships.findMany({
    where: eq(scholarships.tenantId, scope.tenant_id),
    orderBy: [desc(scholarships.createdAt)],
  });
  return c.json(list);
});

financeRouter.post('/scholarships', async (c) => {
  const scope = c.get('scope');
  const b = await c.req.json();

  const [created] = await db
    .insert(scholarships)
    .values({
      tenantId: scope.tenant_id,
      name: b.name,
      description: b.description,
      discountType: b.discount_type || 'percentage',
      discountValue: Number(b.discount_value) || 0,
      criteria: b.criteria,
      status: b.status || 'active',
    })
    .returning();

  return c.json(created, 201);
});
