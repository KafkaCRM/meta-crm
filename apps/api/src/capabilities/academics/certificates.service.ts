import { Injectable } from '@nestjs/common';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../../core/tenant/tenant-scoped-prisma.service';
import { ClsService } from 'nestjs-cls';
import type { RequestScope } from '../../core/tenant/request-scope.interface';
import { createId } from '@paralleldrive/cuid2';

export type CertificatesErrorCode = 'NOT_FOUND' | 'QUERY_FAILED';
export interface CertificatesError { code: CertificatesErrorCode; message?: string }

@Injectable()
export class CertificatesService {
  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly cls: ClsService,
  ) {}

  private getTenantId(): string | null {
    return this.cls.get<RequestScope>('scope')?.tenant_id ?? null;
  }

  async createTemplate(data: { name: string; description?: string; content: string; variables?: any }): Promise<Result<any, CertificatesError>> {
    try {
      const tenantId = this.getTenantId();
      if (!tenantId) return err({ code: 'QUERY_FAILED', message: 'Tenant context missing' });
      const tpl = await this.db.getClient().certificateTemplate.create({
        data: { tenant_id: tenantId, name: data.name, description: data.description, content: data.content, variables: data.variables ?? {} } as any,
      });
      return ok(tpl);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async listTemplates(): Promise<Result<any[], CertificatesError>> {
    try {
      const items = await this.db.getClient().certificateTemplate.findMany({ orderBy: { created_at: 'desc' } });
      return ok(items);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async issue(data: { enrollment_id: string; template_id?: string; serial_number?: string; completion_date?: string; metadata?: any }): Promise<Result<any, CertificatesError>> {
    try {
      const scope = this.cls.get<RequestScope>('scope');
      const tenantId = this.getTenantId();
      if (!tenantId) return err({ code: 'QUERY_FAILED', message: 'Tenant context missing' });

      if (scope?.vertical_ids?.length) {
        const enrollment = await this.db.getClient().enrollment.findUnique({
          where: { id: data.enrollment_id },
          include: { course: { select: { vertical_id: true } } },
        });
        if (!enrollment || !enrollment.course?.vertical_id || !scope.vertical_ids.includes(enrollment.course.vertical_id)) {
          return err({ code: 'NOT_FOUND', message: 'Enrollment not found' });
        }
      }

      const cert = await this.db.getClient().certificate.create({
        data: {
          tenant_id: tenantId, enrollment_id: data.enrollment_id, template_id: data.template_id ?? null,
          serial_number: data.serial_number ?? `CERT-${createId().slice(0, 8).toUpperCase()}`,
          completion_date: data.completion_date ? new Date(data.completion_date) : null,
          metadata: data.metadata ?? {},
        } as any,
      });
      return ok(cert);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async findByEnrollment(enrollment_id: string): Promise<Result<any[], CertificatesError>> {
    try {
      const certs = await this.db.getClient().certificate.findMany({
        where: { enrollment_id },
        include: { template: { select: { name: true } } },
        orderBy: { issued_date: 'desc' },
      });
      return ok(certs);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }
}
