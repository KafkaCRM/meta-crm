import { pgTable, text, timestamp, doublePrecision, integer, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { tenants, users } from './tenants';
import { employeeStatusEnum, leaveStatusEnum } from './enums';

export const departments = pgTable(
  'departments',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    name: text('name').notNull(),
    description: text('description'),
    status: text('status').default('active').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index('idx_departments_tenant').on(table.tenantId),
  ]
);

export const employees = pgTable(
  'employees',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    departmentId: text('department_id').references(() => departments.id, { onDelete: 'set null' }),
    employeeCode: text('employee_code').notNull(),
    designation: text('designation'),
    joiningDate: timestamp('joining_date'),
    salary: doublePrecision('salary'),
    status: employeeStatusEnum('status').default('active').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index('idx_employees_tenant_code').on(table.tenantId, table.employeeCode),
    index('idx_employees_tenant_department').on(table.tenantId, table.departmentId),
  ]
);

export const leaveTypes = pgTable(
  'leave_types',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    name: text('name').notNull(),
    daysPerYear: integer('days_per_year').notNull(),
    carryForward: boolean('carry_forward').default(false).notNull(),
    status: text('status').default('active').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index('idx_leave_types_tenant').on(table.tenantId),
  ]
);

export const leaveRequests = pgTable(
  'leave_requests',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    employeeId: text('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
    leaveTypeId: text('leave_type_id').references(() => leaveTypes.id, { onDelete: 'cascade' }).notNull(),
    fromDate: timestamp('from_date').notNull(),
    toDate: timestamp('to_date').notNull(),
    reason: text('reason'),
    status: leaveStatusEnum('status').default('pending').notNull(),
    approvedBy: text('approved_by'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index('idx_leave_requests_tenant_employee').on(table.tenantId, table.employeeId),
  ]
);

export const employeeAttendance = pgTable(
  'employee_attendance',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    employeeId: text('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
    date: timestamp('date').notNull(),
    checkIn: timestamp('check_in'),
    checkOut: timestamp('check_out'),
    status: text('status').default('present').notNull(), // present | absent | half_day | leave
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_emp_attendance_unique').on(table.employeeId, table.date),
    index('idx_emp_attendance_tenant').on(table.tenantId, table.date),
  ]
);

export const payslips = pgTable(
  'payslips',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    employeeId: text('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
    month: integer('month').notNull(),
    year: integer('year').notNull(),
    basic: doublePrecision('basic').default(0).notNull(),
    hra: doublePrecision('hra').default(0).notNull(),
    allowances: doublePrecision('allowances').default(0).notNull(),
    deductions: doublePrecision('deductions').default(0).notNull(),
    netPay: doublePrecision('net_pay').notNull(),
    status: text('status').default('draft').notNull(), // draft | paid | cancelled
    generatedAt: timestamp('generated_at'),
    paidAt: timestamp('paid_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    uniqueIndex('idx_payslips_unique').on(table.employeeId, table.month, table.year),
    index('idx_payslips_tenant').on(table.tenantId, table.month, table.year),
  ]
);

export const departmentsRelations = relations(departments, ({ many }) => ({
  employees: many(employees),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
  department: one(departments, { fields: [employees.departmentId], references: [departments.id] }),
  user: one(users, { fields: [employees.userId], references: [users.id] }),
  leaves: many(leaveRequests),
  attendance: many(employeeAttendance),
  payslips: many(payslips),
}));
