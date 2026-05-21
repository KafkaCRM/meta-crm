import { Injectable, Logger } from '@nestjs/common';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../../core/tenant/tenant-scoped-prisma.service';
import { ClsService } from 'nestjs-cls';
import type { RequestScope } from '../../core/tenant/request-scope.interface';

export type BillingErrorCode = 'QUERY_FAILED' | 'NOT_FOUND' | 'TENANT_NOT_FOUND' | 'INSUFFICIENT_PAYMENT';

export interface BillingError {
  code: BillingErrorCode;
  message?: string;
}

export interface CreateInvoiceLineItemDto {
  description: string;
  quantity: number;
  unit_price: number;
}

export interface CreateInvoiceDto {
  party_id: string;
  due_date: Date;
  billing_details?: any;
  items: CreateInvoiceLineItemDto[];
}

export interface RegisterPaymentDto {
  amount: number;
  method: string;
  reference?: string;
  payment_date?: Date;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly cls: ClsService,
  ) {}

  private getTenantId(): string | null {
    const scope = this.cls.get<RequestScope>('scope');
    return scope?.tenant_id ?? null;
  }

  async listInvoices(filters: {
    party_id?: string;
    status?: string;
  }): Promise<Result<any[], BillingError>> {
    try {
      const tenantId = this.getTenantId();
      if (!tenantId) {
        return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant context missing' });
      }

      const where: any = { tenant_id: tenantId };
      if (filters.party_id) {
        where.party_id = filters.party_id;
      }
      if (filters.status) {
        where.status = filters.status;
      }

      const invoices = await this.db.getClient().invoice.findMany({
        where,
        orderBy: { issue_date: 'desc' },
        include: {
          party: {
            select: { id: true, name: true, email: true },
          },
          items: true,
          payments: true,
        },
      });

      return ok(invoices);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async getInvoice(id: string): Promise<Result<any, BillingError>> {
    try {
      const tenantId = this.getTenantId();
      if (!tenantId) {
        return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant context missing' });
      }

      const invoice = await this.db.getClient().invoice.findFirst({
        where: { id, tenant_id: tenantId },
        include: {
          party: true,
          items: true,
          payments: true,
        },
      });

      if (!invoice) {
        return err({ code: 'NOT_FOUND', message: 'Invoice not found' });
      }

      return ok(invoice);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async createInvoice(dto: CreateInvoiceDto): Promise<Result<any, BillingError>> {
    try {
      const tenantId = this.getTenantId();
      if (!tenantId) {
        return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant context missing' });
      }

      // Calculate total amount
      let totalAmount = 0;
      const lineItems = dto.items.map((item) => {
        const amount = item.quantity * item.unit_price;
        totalAmount += amount;
        return {
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          amount,
        };
      });

      const invoice = await this.db.getClient().invoice.create({
        data: {
          tenant_id: tenantId,
          party_id: dto.party_id,
          amount: totalAmount,
          status: 'sent', // default status is sent
          due_date: dto.due_date,
          billing_details: dto.billing_details || {},
          items: {
            create: lineItems,
          },
        },
        include: {
          party: true,
          items: true,
        },
      });

      return ok(invoice);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async registerPayment(invoiceId: string, dto: RegisterPaymentDto): Promise<Result<any, BillingError>> {
    try {
      const tenantId = this.getTenantId();
      if (!tenantId) {
        return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant context missing' });
      }

      // Fetch invoice with payments
      const invoice = await this.db.getClient().invoice.findFirst({
        where: { id: invoiceId, tenant_id: tenantId },
        include: { payments: true },
      });

      if (!invoice) {
        return err({ code: 'NOT_FOUND', message: 'Invoice not found' });
      }

      // Add new payment
      const payment = await this.db.getClient().payment.create({
        data: {
          tenant_id: tenantId,
          invoice_id: invoiceId,
          amount: dto.amount,
          method: dto.method,
          reference: dto.reference,
          payment_date: dto.payment_date || new Date(),
        },
      });

      // Calculate total paid including this new payment
      const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0) + dto.amount;

      // Update invoice status if fully paid
      let newStatus = invoice.status;
      if (totalPaid >= invoice.amount) {
        newStatus = 'paid';
      }

      const updatedInvoice = await this.db.getClient().invoice.update({
        where: { id: invoiceId },
        data: { status: newStatus },
        include: {
          payments: true,
          items: true,
        },
      });

      return ok({ payment, invoice: updatedInvoice });
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async getStats(): Promise<Result<any, BillingError>> {
    try {
      const tenantId = this.getTenantId();
      if (!tenantId) {
        return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant context missing' });
      }

      const invoices = await this.db.getClient().invoice.findMany({
        where: { tenant_id: tenantId },
        include: { payments: true },
      });

      let totalBilled = 0;
      let totalPaid = 0;
      let totalOutstanding = 0;
      let overdueCount = 0;
      const now = new Date();

      for (const inv of invoices) {
        totalBilled += inv.amount;
        const paidForInv = inv.payments.reduce((sum, p) => sum + p.amount, 0);
        totalPaid += paidForInv;

        const outstanding = inv.amount - paidForInv;
        if (outstanding > 0) {
          totalOutstanding += outstanding;
          if (new Date(inv.due_date) < now && inv.status !== 'paid') {
            overdueCount++;
          }
        }
      }

      return ok({
        total_billed: totalBilled,
        total_paid: totalPaid,
        total_outstanding: totalOutstanding,
        overdue_count: overdueCount,
        invoice_count: invoices.length,
      });
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }
}
