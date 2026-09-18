import { Hono } from 'hono';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  courses,
  batches,
  enrollments,
  attendances,
  tests,
  testScores,
  assignments,
  assignmentSubmissions,
  certificates,
  studyMaterials,
} from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import type { AppEnv } from '../types/context';

export const academicsRouter = new Hono<AppEnv>();

academicsRouter.use('*', requireAuth, requireTenant);

// --- COURSES ---
academicsRouter.get('/courses', async (c) => {
  const scope = c.get('scope');
  const verticalId = c.req.query('vertical_id');

  const conditions = [eq(courses.tenantId, scope.tenant_id)];
  if (verticalId) conditions.push(eq(courses.verticalId, verticalId));

  const list = await db.query.courses.findMany({
    where: and(...conditions),
    orderBy: [desc(courses.createdAt)],
  });
  return c.json(list);
});

academicsRouter.post('/courses', async (c) => {
  const scope = c.get('scope');
  const b = await c.req.json();

  const [created] = await db
    .insert(courses)
    .values({
      tenantId: scope.tenant_id,
      verticalId: b.vertical_id || scope.vertical_ids[0] || null,
      name: b.name,
      code: b.code,
      description: b.description,
      category: b.category,
      durationValue: b.duration_value ? Number(b.duration_value) : null,
      durationUnit: b.duration_unit,
      mode: b.mode || 'offline',
      fee: b.fee ? Number(b.fee) : null,
      syllabus: b.syllabus,
      status: b.status || 'active',
    })
    .returning();

  return c.json(created, 201);
});

// --- BATCHES ---
academicsRouter.get('/batches', async (c) => {
  const scope = c.get('scope');
  const courseId = c.req.query('course_id');
  const branchId = c.req.query('branch_id');

  const conditions = [eq(batches.tenantId, scope.tenant_id)];
  if (courseId) conditions.push(eq(batches.courseId, courseId));
  if (branchId) conditions.push(eq(batches.branchId, branchId));

  const list = await db.query.batches.findMany({
    where: and(...conditions),
    orderBy: [desc(batches.createdAt)],
    with: {
      course: { columns: { id: true, name: true, code: true } },
    },
  });
  return c.json(list);
});

academicsRouter.post('/batches', async (c) => {
  const scope = c.get('scope');
  const b = await c.req.json();

  const [created] = await db
    .insert(batches)
    .values({
      tenantId: scope.tenant_id,
      courseId: b.course_id,
      branchId: b.branch_id || null,
      name: b.name,
      code: b.code,
      trainerId: b.trainer_id,
      room: b.room,
      startDate: b.start_date ? new Date(b.start_date) : null,
      endDate: b.end_date ? new Date(b.end_date) : null,
      capacity: b.capacity ? Number(b.capacity) : null,
      status: b.status || 'upcoming',
    })
    .returning();

  return c.json(created, 201);
});

// --- ENROLLMENTS (Fixes BUG-08 by maintaining enrolledCount) ---
academicsRouter.get('/enrollments', async (c) => {
  const scope = c.get('scope');
  const batchId = c.req.query('batch_id');
  const courseId = c.req.query('course_id');

  const conditions = [eq(enrollments.tenantId, scope.tenant_id)];
  if (batchId) conditions.push(eq(enrollments.batchId, batchId));
  if (courseId) conditions.push(eq(enrollments.courseId, courseId));

  const list = await db.query.enrollments.findMany({
    where: and(...conditions),
    orderBy: [desc(enrollments.createdAt)],
    with: {
      party: { columns: { id: true, name: true, email: true, phoneRaw: true } },
      batch: { columns: { id: true, name: true, code: true } },
      course: { columns: { id: true, name: true, code: true } },
    },
  });
  return c.json(list);
});

academicsRouter.post('/enrollments', async (c) => {
  const scope = c.get('scope');
  const b = await c.req.json();

  const result = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(enrollments)
      .values({
        tenantId: scope.tenant_id,
        batchId: b.batch_id || null,
        courseId: b.course_id || null,
        partyId: b.party_id,
        rollNumber: b.roll_number,
        admissionDate: b.admission_date ? new Date(b.admission_date) : new Date(),
        status: b.status || 'active',
        parentName: b.parent_name,
        parentPhone: b.parent_phone,
      })
      .returning();

    // Fix BUG-08: increment enrolled_count on batch
    if (b.batch_id) {
      await tx
        .update(batches)
        .set({ enrolledCount: sql`${batches.enrolledCount} + 1` })
        .where(eq(batches.id, b.batch_id));
    }

    return created;
  });

  return c.json(result, 201);
});

// --- ATTENDANCE ---
academicsRouter.get('/attendance', async (c) => {
  const scope = c.get('scope');
  const batchId = c.req.query('batch_id');
  const dateStr = c.req.query('date');

  const conditions = [eq(attendances.tenantId, scope.tenant_id)];
  if (batchId) conditions.push(eq(attendances.batchId, batchId));

  const list = await db.query.attendances.findMany({
    where: and(...conditions),
    orderBy: [desc(attendances.date)],
    with: {
      enrollment: {
        with: { party: { columns: { id: true, name: true } } },
      },
    },
  });
  return c.json(list);
});

academicsRouter.post('/attendance', async (c) => {
  const scope = c.get('scope');
  const b = await c.req.json(); // Array of records or single record
  const records = Array.isArray(b) ? b : [b];

  const inserted = await db.transaction(async (tx) => {
    const results = [];
    for (const r of records) {
      const [att] = await tx
        .insert(attendances)
        .values({
          tenantId: scope.tenant_id,
          batchId: r.batch_id,
          enrollmentId: r.enrollment_id,
          date: new Date(r.date),
          status: r.status,
          markedById: scope.user_id,
          remarks: r.remarks,
        })
        .onConflictDoUpdate({
          target: [attendances.batchId, attendances.enrollmentId, attendances.date],
          set: {
            status: r.status,
            remarks: r.remarks,
            markedById: scope.user_id,
          },
        })
        .returning();
      results.push(att);
    }
    return results;
  });

  return c.json(inserted, 201);
});

// --- TESTS & ASSIGNMENTS ---
academicsRouter.get('/tests', async (c) => {
  const scope = c.get('scope');
  const courseId = c.req.query('course_id');
  const conditions = [eq(tests.tenantId, scope.tenant_id)];
  if (courseId) conditions.push(eq(tests.courseId, courseId));

  const list = await db.query.tests.findMany({
    where: and(...conditions),
    orderBy: [desc(tests.createdAt)],
  });
  return c.json(list);
});

academicsRouter.post('/tests', async (c) => {
  const scope = c.get('scope');
  const b = await c.req.json();

  const [created] = await db
    .insert(tests)
    .values({
      tenantId: scope.tenant_id,
      courseId: b.course_id,
      batchId: b.batch_id || null,
      name: b.name,
      type: b.type || 'exam',
      maxMarks: Number(b.max_marks) || 100,
      heldOn: b.held_on ? new Date(b.held_on) : null,
    })
    .returning();

  return c.json(created, 201);
});

academicsRouter.get('/certificates', async (c) => {
  const scope = c.get('scope');
  const list = await db.query.certificates.findMany({
    where: eq(certificates.tenantId, scope.tenant_id),
    orderBy: [desc(certificates.issuedDate)],
    with: {
      enrollment: {
        with: { party: { columns: { id: true, name: true } } },
      },
    },
  });
  return c.json(list);
});

academicsRouter.get('/study-materials', async (c) => {
  const scope = c.get('scope');
  const courseId = c.req.query('course_id');
  const conditions = [eq(studyMaterials.tenantId, scope.tenant_id)];
  if (courseId) conditions.push(eq(studyMaterials.courseId, courseId));

  const list = await db.query.studyMaterials.findMany({
    where: and(...conditions),
    orderBy: [desc(studyMaterials.createdAt)],
  });
  return c.json(list);
});
