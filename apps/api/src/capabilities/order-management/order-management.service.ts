import { Injectable, Logger } from '@nestjs/common';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../../core/tenant/tenant-scoped-prisma.service';
import { ClsService } from 'nestjs-cls';
import type { RequestScope } from '../../core/tenant/request-scope.interface';

export type OrderErrorCode = 'QUERY_FAILED' | 'NOT_FOUND' | 'TENANT_NOT_FOUND';

export interface OrderError {
  code: OrderErrorCode;
  message?: string;
}

export interface CreateOrderDto {
  party_id: string;
  total_amount: number;
  payment_method?: string;
  items: {
    product_name: string;
    quantity: number;
    unit_price: number;
  }[];
}

export interface UpdateOrderDto {
  status?: string;
  payment_status?: string;
  payment_method?: string;
}

@Injectable()
export class OrderManagementService {
  private readonly logger = new Logger(OrderManagementService.name);

  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly cls: ClsService,
  ) {}

  private getTenantId(): string | null {
    const scope = this.cls.get<RequestScope>('scope');
    return scope?.tenant_id ?? null;
  }

  async listOrders(filters: {
    party_id?: string;
    status?: string;
  }): Promise<Result<any[], OrderError>> {
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

      const orders = await this.db.getClient().order.findMany({
        where,
        orderBy: { created_at: 'desc' },
        include: {
          party: {
            select: { id: true, name: true, email: true, phone_normalized: true },
          },
          items: true,
        },
      });

      return ok(orders);
    } catch (e) {
      this.logger.error('Error listing orders', (e as Error).stack);
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async getOrder(id: string): Promise<Result<any, OrderError>> {
    try {
      const tenantId = this.getTenantId();
      if (!tenantId) {
        return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant context missing' });
      }

      const order = await this.db.getClient().order.findFirst({
        where: { id, tenant_id: tenantId },
        include: {
          party: {
            select: { id: true, name: true, email: true, phone_normalized: true },
          },
          items: true,
        },
      });

      if (!order) {
        return err({ code: 'NOT_FOUND', message: `Order with ID ${id} not found` });
      }

      return ok(order);
    } catch (e) {
      this.logger.error('Error getting order', (e as Error).stack);
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async createOrder(dto: CreateOrderDto): Promise<Result<any, OrderError>> {
    try {
      const tenantId = this.getTenantId();
      if (!tenantId) {
        return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant context missing' });
      }

      const order = await this.db.getClient().order.create({
        data: {
          tenant_id: tenantId,
          party_id: dto.party_id,
          total_amount: dto.total_amount,
          payment_method: dto.payment_method || null,
          items: {
            create: dto.items.map(item => ({
              product_name: item.product_name,
              quantity: item.quantity,
              unit_price: item.unit_price,
              amount: item.quantity * item.unit_price,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      return ok(order);
    } catch (e) {
      this.logger.error('Error creating order', (e as Error).stack);
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async updateOrder(id: string, dto: UpdateOrderDto): Promise<Result<any, OrderError>> {
    try {
      const tenantId = this.getTenantId();
      if (!tenantId) {
        return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant context missing' });
      }

      const orderExists = await this.db.getClient().order.findFirst({
        where: { id, tenant_id: tenantId },
      });

      if (!orderExists) {
        return err({ code: 'NOT_FOUND', message: `Order with ID ${id} not found` });
      }

      const updated = await this.db.getClient().order.update({
        where: { id },
        data: {
          ...(dto.status && { status: dto.status }),
          ...(dto.payment_status && { payment_status: dto.payment_status }),
          ...(dto.payment_method && { payment_method: dto.payment_method }),
        },
        include: {
          items: true,
        },
      });

      return ok(updated);
    } catch (e) {
      this.logger.error('Error updating order', (e as Error).stack);
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }
}
