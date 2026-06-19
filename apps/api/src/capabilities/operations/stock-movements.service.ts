import { Injectable } from '@nestjs/common';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../../core/tenant/tenant-scoped-prisma.service';
import { ClsService } from 'nestjs-cls';
import type { RequestScope } from '../../core/tenant/request-scope.interface';

export type MovErrorCode = 'NOT_FOUND' | 'QUERY_FAILED' | 'INSUFFICIENT';
export interface MovError { code: MovErrorCode; message?: string }
export interface MovListParams { cursor?: string; limit?: number; product_id?: string; warehouse_id?: string; type?: string; }

@Injectable()
export class StockMovementsService {
  constructor(private readonly db: TenantScopedPrismaService, private readonly cls: ClsService) {}
  private getTenantId(): string | null { return this.cls.get<RequestScope>('scope')?.tenant_id ?? null; }

  async create(data: { product_id: string; warehouse_id: string; type: string; quantity: number; reference?: string; notes?: string }): Promise<Result<any, MovError>> {
    try {
      const tid = this.getTenantId(); if (!tid) return err({ code: 'QUERY_FAILED', message: 'No tenant' });
      return await this.db.getClient().$transaction(async (tx: any) => {
        const current = await tx.stock.findUnique({ where: { tenant_id_product_id_warehouse_id: { tenant_id: tid, product_id: data.product_id, warehouse_id: data.warehouse_id } } });
        const currentQty = current?.quantity ?? 0;
        const delta = data.type === 'out' ? -data.quantity : data.type === 'in' ? data.quantity : 0;
        if (data.type === 'out' && currentQty < data.quantity) return err<never, MovError>({ code: 'INSUFFICIENT', message: `Insufficient stock. Available: ${currentQty}, requested: ${data.quantity}` });
        const newQty = data.type === 'adjustment' ? data.quantity : currentQty + delta;
        if (current) {
          await tx.stock.update({ where: { id: current.id }, data: { quantity: newQty } });
        } else {
          await tx.stock.create({ data: { tenant_id: tid, product_id: data.product_id, warehouse_id: data.warehouse_id, quantity: newQty } });
        }
        const movement = await tx.stockMovement.create({ data: { tenant_id: tid, ...data } });
        return ok(movement);
      });
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }

  async list(params: MovListParams): Promise<Result<{ data: any[]; next_cursor?: string }, MovError>> {
    try {
      const tid = this.getTenantId(); if (!tid) return err({ code: 'QUERY_FAILED', message: 'No tenant' });
      const where: any = { tenant_id: tid };
      if (params.product_id) where.product_id = params.product_id;
      if (params.warehouse_id) where.warehouse_id = params.warehouse_id;
      if (params.type) where.type = params.type;
      const take = (params.limit ?? 20) + 1;
      const items = await this.db.getClient().stockMovement.findMany({
        where, take, orderBy: { created_at: 'desc' },
        ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
        include: { product: { select: { id: true, name: true, sku: true } }, warehouse: { select: { id: true, name: true } } },
      });
      let next_cursor: string | undefined;
      if (items.length > (params.limit ?? 20)) { next_cursor = items.pop()!.id; }
      return ok({ data: items, next_cursor });
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }
}
