import { pgTable, text, timestamp, doublePrecision, integer, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { tenants } from './tenants';
import { courses, enrollments } from './academics';

export const feePlans = pgTable(
  'fee_plans',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    courseId: text('course_id').references(() => courses.id, { onDelete: 'cascade' }).notNull(),
    name: text('name').notNull(),
    totalAmount: doublePrecision('total_amount').notNull(),
    installmentsCount: integer('installments_count').default(1).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index('idx_fee_plans_tenant_course').on(table.tenantId, table.courseId),
  ]
);

export const feePlanInstallments = pgTable(
  'fee_plan_installments',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    feePlanId: text('fee_plan_id').references(() => feePlans.id, { onDelete: 'cascade' }).notNull(),
    installmentNumber: integer('installment_number').notNull(),
    amount: doublePrecision('amount').notNull(),
    dueDaysAfterAdmission: integer('due_days_after_admission').default(0).notNull(),
  },
  (table) => [
    index('idx_plan_installments_plan').on(table.feePlanId),
  ]
);

export const studentFees = pgTable(
  'student_fees',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    enrollmentId: text('enrollment_id').references(() => enrollments.id, { onDelete: 'cascade' }).notNull(),
    feePlanId: text('fee_plan_id').references(() => feePlans.id, { onDelete: 'set null' }),
    totalAmount: doublePrecision('total_amount').notNull(),
    status: text('status').default('unpaid').notNull(), // unpaid | partially_paid | paid
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index('idx_student_fees_tenant_enrollment').on(table.tenantId, table.enrollmentId),
  ]
);

export const studentFeeInstallments = pgTable(
  'student_fee_installments',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    studentFeeId: text('student_fee_id').references(() => studentFees.id, { onDelete: 'cascade' }).notNull(),
    installmentNumber: integer('installment_number').notNull(),
    amount: doublePrecision('amount').notNull(),
    dueDate: timestamp('due_date').notNull(),
    paidAmount: doublePrecision('paid_amount').default(0).notNull(),
    status: text('status').default('pending').notNull(), // pending | paid | overdue
    paidAt: timestamp('paid_at'),
  },
  (table) => [
    index('idx_student_installments_fee').on(table.studentFeeId),
  ]
);

export const scholarships = pgTable(
  'scholarships',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    name: text('name').notNull(),
    description: text('description'),
    discountType: text('discount_type').notNull(), // percentage | fixed
    discountValue: doublePrecision('discount_value').notNull(),
    criteria: text('criteria'),
    status: text('status').default('active').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index('idx_scholarships_tenant').on(table.tenantId),
  ]
);

export const studentScholarships = pgTable(
  'student_scholarships',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    enrollmentId: text('enrollment_id').references(() => enrollments.id, { onDelete: 'cascade' }).notNull(),
    scholarshipId: text('scholarship_id').references(() => scholarships.id, { onDelete: 'cascade' }).notNull(),
    grantedAmount: doublePrecision('granted_amount').notNull(),
    grantedAt: timestamp('granted_at').defaultNow().notNull(),
    approvedBy: text('approved_by'),
  },
  (table) => [
    index('idx_student_scholarships_tenant').on(table.tenantId, table.enrollmentId),
  ]
);

export const feePlansRelations = relations(feePlans, ({ one, many }) => ({
  course: one(courses, { fields: [feePlans.courseId], references: [courses.id] }),
  installments: many(feePlanInstallments),
}));

export const studentFeesRelations = relations(studentFees, ({ one, many }) => ({
  enrollment: one(enrollments, { fields: [studentFees.enrollmentId], references: [enrollments.id] }),
  feePlan: one(feePlans, { fields: [studentFees.feePlanId], references: [feePlans.id] }),
  installments: many(studentFeeInstallments),
}));
