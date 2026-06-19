import { Injectable } from '@nestjs/common';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../../core/tenant/tenant-scoped-prisma.service';
import { ClsService } from 'nestjs-cls';
import type { RequestScope } from '../../core/tenant/request-scope.interface';

export type StockErrorCode = 'NOT_FOUND' | 'QUERY_FAILED' | 'INSUFFICIENT';
export interface StockError { code: StockErrorCode; message?: string }
export interface StockListParams { cursor?: string; limit?: number; product_id?: string; warehouse_id?: string; low_stock?: boolean; }

@Injectable()
export class StockService {
  constructor(private readonly db: TenantScopedPrismaService, private readonly cls: ClsService) {}
  private getTenantId(): string | null { return this.cls.get<RequestScope>('scope')?.tenant_id ?? null; }

  async list(params: StockListParams): Promise<Result<{ data: any[]; next_cursor?: string }, StockError>> {
    try {
      const tid = this.getTenantId(); if (!tid) return err({ code: 'QUERY_FAILED', message: 'No tenant' });
      const where: any = { tenant_id: tid };
      if (params.product_id) where.product_id = params.product_id;
      if (params.warehouse_id) where.warehouse_id = params.warehouse_id;
      if (params.low_stock) where.AND = [{ quantity: { lte: 0 } }, { quantity: { not: undefined } }]; // handled via filter
      const take = (params.limit ?? 20) + 1;
      const items = await this.db.getClient().stock.findMany({
        where, take, orderBy: { updated_at: 'desc' },
        ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
        include: { product: { select: { id: true, name: true, sku: true, unit: true } }, warehouse: { select: { id: true, name: true } } },
      });
      let filtered = items;
      if (params.low_stock) filtered = items.filter((s: any) => s.quantity <= s.min_stock_level);
      let next_cursor: string | undefined;
      if (filtered.length > (params.limit ?? 20)) { next_cursor = filtered.pop()!.id; }
      return ok({ data: filtered, next_cursor });
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }

  async adjust(data: { product_id: string; warehouse_id: string; quantity: number }): Promise<Result<any, StockError>> {
    try {
      const tid = this.getTenantId(); if (!tid) return err({ code: 'QUERY_FAILED', message: 'No tenant' });
      const existing = await this.db.getClient().stock.findUnique({ where: { tenant_id_product_id_warehouse_id: { tenant_id: tid, product_id: data.product_id, warehouse_id: data.warehouse_id } } });
      if (existing) {
        return ok(await this.db.getClient().stock.update({ where: { id: existing.id }, data: { quantity: data.quantity } }));
      }
      return ok(await this.db.getClient().stock.create({ data: { tenant_id: tid, ...data } as any }));
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }
}
