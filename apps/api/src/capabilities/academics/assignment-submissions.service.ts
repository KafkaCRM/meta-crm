import { Injectable } from '@nestjs/common';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../../core/tenant/tenant-scoped-prisma.service';
import { ClsService } from 'nestjs-cls';
import type { RequestScope } from '../../core/tenant/request-scope.interface';

export type SubmissionsErrorCode = 'NOT_FOUND' | 'DUPLICATE' | 'QUERY_FAILED';
export interface SubmissionsError { code: SubmissionsErrorCode; message?: string }

@Injectable()
export class AssignmentSubmissionsService {
  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly cls: ClsService,
  ) {}

  private getTenantId(): string | null {
    return this.cls.get<RequestScope>('scope')?.tenant_id ?? null;
  }

  async submit(data: { assignment_id: string; enrollment_id: string; submission_text?: string; file_url?: string }): Promise<Result<any, SubmissionsError>> {
    try {
      const tenantId = this.getTenantId();
      if (!tenantId) return err({ code: 'QUERY_FAILED', message: 'Tenant context missing' });
      const existing = await this.db.getClient().assignmentSubmission.findUnique({
        where: { assignment_id_enrollment_id: { assignment_id: data.assignment_id, enrollment_id: data.enrollment_id } },
      });
      if (existing) return err({ code: 'DUPLICATE', message: 'Already submitted' });
      const sub = await this.db.getClient().assignmentSubmission.create({
        data: { tenant_id: tenantId, assignment_id: data.assignment_id, enrollment_id: data.enrollment_id, submission_text: data.submission_text ?? null, file_url: data.file_url ?? null } as any,
      });
      return ok(sub);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async grade(id: string, data: { marks_obtained: number; feedback?: string }): Promise<Result<any, SubmissionsError>> {
    try {
      const sub = await this.db.getClient().assignmentSubmission.update({
        where: { id },
        data: { marks_obtained: data.marks_obtained, feedback: data.feedback ?? null, status: 'graded' },
      });
      return ok(sub);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async findByAssignment(assignment_id: string): Promise<Result<any[], SubmissionsError>> {
    try {
      const subs = await this.db.getClient().assignmentSubmission.findMany({
        where: { assignment_id },
        include: { enrollment: { include: { party: { select: { name: true } } } } },
        orderBy: { submitted_at: 'desc' },
      });
      return ok(subs);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }
}
