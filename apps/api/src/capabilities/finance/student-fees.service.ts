import { Injectable } from '@nestjs/common';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../../core/tenant/tenant-scoped-prisma.service';
import { ClsService } from 'nestjs-cls';
import type { RequestScope } from '../../core/tenant/request-scope.interface';

export type StudentFeesErrorCode = 'NOT_FOUND' | 'QUERY_FAILED';
export interface StudentFeesError { code: StudentFeesErrorCode; message?: string }

@Injectable()
export class StudentFeesService {
  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly cls: ClsService,
  ) {}

  private getTenantId(): string | null {
    const scope = this.cls.get<RequestScope>('scope');
    return scope?.tenant_id ?? null;
  }

  async create(data: {
    enrollment_id: string; fee_plan_id?: string; total_fee: number;
    discount_amount?: number;
  }): Promise<Result<any, StudentFeesError>> {
    try {
      const tenantId = this.getTenantId();
      if (!tenantId) return err({ code: 'QUERY_FAILED', message: 'Tenant context missing' });

      const discount = data.discount_amount ?? 0;
      const netFee = data.total_fee - discount;

      let installmentData: any[] | undefined;

      if (data.fee_plan_id) {
        const plan = await this.db.getClient().feePlan.findUnique({
          where: { id: data.fee_plan_id },
          include: { installments: true },
        });
        if (plan) {
          const enrollment = await this.db.getClient().enrollment.findUnique({
            where: { id: data.enrollment_id },
            select: { admission_date: true },
          });
          const startDate = enrollment?.admission_date ?? new Date();
          const ratio = netFee / plan.total_fee;
          installmentData = plan.installments.map((inst: any) => {
            const dueDate = new Date(startDate);
            dueDate.setDate(dueDate.getDate() + inst.due_days);
            return {
              tenant_id: tenantId,
              name: inst.name,
              amount: Math.round(inst.amount * ratio * 100) / 100,
              due_date: dueDate,
              late_fee: inst.late_fee,
            };
          });
        }
      }

      const studentFee = await this.db.getClient().studentFee.create({
        data: {
          tenant_id: tenantId,
          enrollment_id: data.enrollment_id,
          fee_plan_id: data.fee_plan_id ?? null,
          total_fee: data.total_fee,
          discount_amount: discount,
          net_fee: netFee,
          installments: installmentData ? { create: installmentData } : undefined,
        } as any,
        include: { installments: { orderBy: { due_date: 'asc' } }, enrollment: { include: { party: { select: { id: true, name: true } } } } },
      });
      return ok(studentFee);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async findAll(params: {
    enrollment_id?: string; status?: string; cursor?: string; limit?: number;
  }): Promise<Result<{ data: any[]; next_cursor: string | undefined }, StudentFeesError>> {
    try {
      const limit = Math.min(params.limit ?? 50, 100);
      const where: Record<string, unknown> = {};
      if (params.enrollment_id) where.enrollment_id = params.enrollment_id;
      if (params.status) where.status = params.status;

      const fees = await this.db.getClient().studentFee.findMany({
        where,
        take: limit + 1,
        ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
        orderBy: { created_at: 'desc' },
        include: {
          installments: { orderBy: { due_date: 'asc' } },
          enrollment: { include: { party: { select: { id: true, name: true } } } },
          feePlan: { select: { id: true, name: true } },
        },
      });

      const hasMore = fees.length > limit;
      const data = hasMore ? fees.slice(0, limit) : fees;
      return ok({ data, next_cursor: hasMore ? data[data.length - 1]?.id : undefined });
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async findOne(id: string): Promise<Result<any, StudentFeesError>> {
    try {
      const fee = await this.db.getClient().studentFee.findUnique({
        where: { id },
        include: {
          installments: { orderBy: { due_date: 'asc' } },
          enrollment: { include: { party: { select: { id: true, name: true } } } },
          feePlan: { select: { id: true, name: true } },
        },
      });
      if (!fee) return err({ code: 'NOT_FOUND', message: 'Student fee not found' });
      return ok(fee);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async recordPayment(installmentId: string, data: {
    amount: number; paid_date?: string; notes?: string;
  }): Promise<Result<any, StudentFeesError>> {
    try {
      const installment = await this.db.getClient().studentFeeInstallment.findUnique({
        where: { id: installmentId },
      });
      if (!installment) return err({ code: 'NOT_FOUND', message: 'Installment not found' });

      const newPaid = (installment.paid_amount ?? 0) + data.amount;
      const newStatus = newPaid >= installment.amount ? 'paid' : 'partial';

      const updated = await this.db.getClient().studentFeeInstallment.update({
        where: { id: installmentId },
        data: {
          paid_amount: newPaid,
          status: newStatus,
          paid_date: data.paid_date ? new Date(data.paid_date) : new Date(),
          notes: data.notes,
        } as any,
      });

      // Recalculate parent student fee paid_amount and status
      const parentFee = await this.db.getClient().studentFee.findUnique({
        where: { id: installment.student_fee_id },
        include: { installments: true },
      });
      if (parentFee) {
        const totalPaid = parentFee.installments.reduce((sum: number, i: any) => sum + (i.paid_amount ?? 0), 0);
        const feeStatus = totalPaid >= parentFee.net_fee ? 'paid' : totalPaid > 0 ? 'partial' : 'pending';
        await this.db.getClient().studentFee.update({
          where: { id: parentFee.id },
          data: { paid_amount: totalPaid, status: feeStatus },
        });
      }

      return ok(updated);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async remove(id: string): Promise<Result<void, StudentFeesError>> {
    try {
      await this.db.getClient().studentFee.delete({ where: { id } });
      return ok(undefined);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }
}
