import { pgTable, text, timestamp, jsonb, integer, doublePrecision, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { tenants, branches, verticals } from './tenants';
import { parties } from './core';

export const courses = pgTable(
  'courses',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    verticalId: text('vertical_id').references(() => verticals.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    code: text('code').notNull(),
    description: text('description'),
    category: text('category'),
    durationValue: integer('duration_value'),
    durationUnit: text('duration_unit'),
    mode: text('mode').default('offline').notNull(),
    fee: doublePrecision('fee'),
    syllabus: jsonb('syllabus'),
    status: text('status').default('active').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index('idx_courses_tenant_code').on(table.tenantId, table.code),
    index('idx_courses_tenant_vertical').on(table.tenantId, table.verticalId),
    index('idx_courses_tenant_status').on(table.tenantId, table.status),
  ]
);

export const batches = pgTable(
  'batches',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    courseId: text('course_id').references(() => courses.id, { onDelete: 'cascade' }).notNull(),
    branchId: text('branch_id').references(() => branches.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    code: text('code').notNull(),
    trainerId: text('trainer_id'),
    room: text('room'),
    startDate: timestamp('start_date'),
    endDate: timestamp('end_date'),
    scheduleJson: jsonb('schedule_json'),
    capacity: integer('capacity'),
    enrolledCount: integer('enrolled_count').default(0).notNull(),
    status: text('status').default('upcoming').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index('idx_batches_tenant_course').on(table.tenantId, table.courseId),
    index('idx_batches_tenant_branch').on(table.tenantId, table.branchId),
    index('idx_batches_tenant_status').on(table.tenantId, table.status),
  ]
);

export const enrollments = pgTable(
  'enrollments',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    batchId: text('batch_id').references(() => batches.id, { onDelete: 'set null' }),
    courseId: text('course_id').references(() => courses.id, { onDelete: 'set null' }),
    partyId: text('party_id').references(() => parties.id, { onDelete: 'cascade' }).notNull(),
    rollNumber: text('roll_number'),
    admissionDate: timestamp('admission_date').defaultNow().notNull(),
    status: text('status').default('active').notNull(),
    parentName: text('parent_name'),
    parentPhone: text('parent_phone'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index('idx_enrollments_tenant_party').on(table.tenantId, table.partyId),
    index('idx_enrollments_tenant_batch').on(table.tenantId, table.batchId),
    index('idx_enrollments_tenant_status').on(table.tenantId, table.status),
  ]
);

export const attendances = pgTable(
  'attendances',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    batchId: text('batch_id').references(() => batches.id, { onDelete: 'cascade' }).notNull(),
    enrollmentId: text('enrollment_id').references(() => enrollments.id, { onDelete: 'cascade' }).notNull(),
    date: timestamp('date').notNull(),
    status: text('status').notNull(), // present | absent | late | excused
    markedById: text('marked_by_id'),
    markedAt: timestamp('marked_at').defaultNow().notNull(),
    remarks: text('remarks'),
  },
  (table) => [
    uniqueIndex('idx_attendances_batch_enrollment_date').on(table.batchId, table.enrollmentId, table.date),
    index('idx_attendances_tenant_batch_date').on(table.tenantId, table.batchId, table.date),
  ]
);

export const tests = pgTable(
  'tests',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    courseId: text('course_id').references(() => courses.id, { onDelete: 'cascade' }).notNull(),
    batchId: text('batch_id').references(() => batches.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    type: text('type').default('exam').notNull(),
    maxMarks: doublePrecision('max_marks').notNull(),
    gradingScheme: jsonb('grading_scheme'),
    heldOn: timestamp('held_on'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index('idx_tests_tenant_course').on(table.tenantId, table.courseId),
    index('idx_tests_tenant_batch').on(table.tenantId, table.batchId),
  ]
);

export const testScores = pgTable(
  'test_scores',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    testId: text('test_id').references(() => tests.id, { onDelete: 'cascade' }).notNull(),
    enrollmentId: text('enrollment_id').references(() => enrollments.id, { onDelete: 'cascade' }).notNull(),
    marksObtained: doublePrecision('marks_obtained').notNull(),
    grade: text('grade'),
    remarks: text('remarks'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_test_scores_unique').on(table.testId, table.enrollmentId),
  ]
);

export const assignments = pgTable(
  'assignments',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    courseId: text('course_id').references(() => courses.id, { onDelete: 'cascade' }).notNull(),
    batchId: text('batch_id').references(() => batches.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    description: text('description'),
    dueDate: timestamp('due_date'),
    maxMarks: doublePrecision('max_marks'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index('idx_assignments_tenant_course').on(table.tenantId, table.courseId),
  ]
);

export const assignmentSubmissions = pgTable(
  'assignment_submissions',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    assignmentId: text('assignment_id').references(() => assignments.id, { onDelete: 'cascade' }).notNull(),
    enrollmentId: text('enrollment_id').references(() => enrollments.id, { onDelete: 'cascade' }).notNull(),
    submissionText: text('submission_text'),
    fileUrl: text('file_url'),
    submittedAt: timestamp('submitted_at').defaultNow().notNull(),
    marksObtained: doublePrecision('marks_obtained'),
    feedback: text('feedback'),
    status: text('status').default('submitted').notNull(),
  },
  (table) => [
    uniqueIndex('idx_submissions_unique').on(table.assignmentId, table.enrollmentId),
  ]
);

export const studyMaterials = pgTable(
  'study_materials',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    courseId: text('course_id').references(() => courses.id, { onDelete: 'cascade' }).notNull(),
    batchId: text('batch_id').references(() => batches.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    description: text('description'),
    type: text('type').default('pdf').notNull(),
    url: text('url').notNull(),
    uploadedBy: text('uploaded_by'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  }
);

export const certificateTemplates = pgTable(
  'certificate_templates',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    name: text('name').notNull(),
    description: text('description'),
    content: text('content').notNull(),
    variables: jsonb('variables'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  }
);

export const certificates = pgTable(
  'certificates',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    enrollmentId: text('enrollment_id').references(() => enrollments.id, { onDelete: 'cascade' }).notNull(),
    templateId: text('template_id').references(() => certificateTemplates.id, { onDelete: 'set null' }),
    serialNumber: text('serial_number').notNull().unique(),
    issuedDate: timestamp('issued_date').defaultNow().notNull(),
    completionDate: timestamp('completion_date'),
    metadata: jsonb('metadata'),
    status: text('status').default('active').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index('idx_certificates_tenant_serial').on(table.tenantId, table.serialNumber),
  ]
);

export const coursesRelations = relations(courses, ({ many }) => ({
  batches: many(batches),
  enrollments: many(enrollments),
}));

export const batchesRelations = relations(batches, ({ one, many }) => ({
  course: one(courses, { fields: [batches.courseId], references: [courses.id] }),
  enrollments: many(enrollments),
}));

export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
  batch: one(batches, { fields: [enrollments.batchId], references: [batches.id] }),
  course: one(courses, { fields: [enrollments.courseId], references: [courses.id] }),
  party: one(parties, { fields: [enrollments.partyId], references: [parties.id] }),
}));
