import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import {
  departments,
  employees,
  leaveRequests,
  leaveTypes,
  employeeAttendance,
  payslips,
} from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import type { AppEnv } from '../types/context';

export const hrRouter = new Hono<AppEnv>();

hrRouter.use('*', requireAuth, requireTenant);

// --- DEPARTMENTS ---
hrRouter.get('/departments', async (c) => {
  const scope = c.get('scope');
  const list = await db.query.departments.findMany({
    where: eq(departments.tenantId, scope.tenant_id),
    orderBy: [desc(departments.createdAt)],
  });
  return c.json(list);
});

hrRouter.post('/departments', async (c) => {
  const scope = c.get('scope');
  const b = await c.req.json();

  const [created] = await db
    .insert(departments)
    .values({
      tenantId: scope.tenant_id,
      name: b.name,
      description: b.description,
      status: b.status || 'active',
    })
    .returning();

  return c.json(created, 201);
});

// --- EMPLOYEES ---
hrRouter.get('/employees', async (c) => {
  const scope = c.get('scope');
  const list = await db.query.employees.findMany({
    where: eq(employees.tenantId, scope.tenant_id),
    orderBy: [desc(employees.createdAt)],
    with: {
      department: { columns: { id: true, name: true } },
      user: { columns: { id: true, name: true, email: true } },
    },
  });
  return c.json(list);
});

hrRouter.post('/employees', async (c) => {
  const scope = c.get('scope');
  const b = await c.req.json();

  const [created] = await db
    .insert(employees)
    .values({
      tenantId: scope.tenant_id,
      userId: b.user_id || null,
      departmentId: b.department_id || null,
      employeeCode: b.employee_code,
      designation: b.designation,
      joiningDate: b.joining_date ? new Date(b.joining_date) : new Date(),
      salary: b.salary ? Number(b.salary) : null,
      status: b.status || 'active',
    })
    .returning();

  return c.json(created, 201);
});

// --- LEAVE REQUESTS ---
hrRouter.get('/leave-requests', async (c) => {
  const scope = c.get('scope');
  const list = await db.query.leaveRequests.findMany({
    where: eq(leaveRequests.tenantId, scope.tenant_id),
    orderBy: [desc(leaveRequests.createdAt)],
    with: {
      employee: { columns: { id: true, employeeCode: true } },
    },
  });
  return c.json(list);
});

hrRouter.post('/leave-requests', async (c) => {
  const scope = c.get('scope');
  const b = await c.req.json();

  const [created] = await db
    .insert(leaveRequests)
    .values({
      tenantId: scope.tenant_id,
      employeeId: b.employee_id,
      leaveTypeId: b.leave_type_id,
      fromDate: new Date(b.from_date),
      toDate: new Date(b.to_date),
      reason: b.reason,
      status: 'pending',
    })
    .returning();

  return c.json(created, 201);
});

// --- PAYSLIPS ---
hrRouter.get('/payslips', async (c) => {
  const scope = c.get('scope');
  const month = c.req.query('month');
  const year = c.req.query('year');

  const conditions = [eq(payslips.tenantId, scope.tenant_id)];
  if (month) conditions.push(eq(payslips.month, Number(month)));
  if (year) conditions.push(eq(payslips.year, Number(year)));

  const list = await db.query.payslips.findMany({
    where: and(...conditions),
    orderBy: [desc(payslips.createdAt)],
    with: {
      employee: { columns: { id: true, employeeCode: true, designation: true } },
    },
  });
  return c.json(list);
});

// --- EMPLOYEE ATTENDANCE ---
hrRouter.get('/employee-attendance', async (c) => {
  const scope = c.get('scope');
  const list = await db.query.employeeAttendance.findMany({
    where: eq(employeeAttendance.tenantId, scope.tenant_id),
    orderBy: [desc(employeeAttendance.date)],
    with: {
      employee: { columns: { id: true, employeeCode: true } },
    },
  });
  return c.json(list);
});
