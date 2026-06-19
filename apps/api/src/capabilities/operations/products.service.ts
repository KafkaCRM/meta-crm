import { Injectable } from '@nestjs/common';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../../core/tenant/tenant-scoped-prisma.service';
import { ClsService } from 'nestjs-cls';
import type { RequestScope } from '../../core/tenant/request-scope.interface';

export type ProdErrorCode = 'NOT_FOUND' | 'QUERY_FAILED';
export interface ProdError { code: ProdErrorCode; message?: string }
export interface ProdListParams { cursor?: string; limit?: number; category_id?: string; status?: string; search?: string; }

@Injectable()
export class ProductsService {
  constructor(private readonly db: TenantScopedPrismaService, private readonly cls: ClsService) {}
  private getTenantId(): string | null { return this.cls.get<RequestScope>('scope')?.tenant_id ?? null; }

  async create(data: { name: string; sku: string; description?: string; unit?: string; price?: number; category_id?: string; status?: string }): Promise<Result<any, ProdError>> {
    try {
      const tid = this.getTenantId(); if (!tid) return err({ code: 'QUERY_FAILED', message: 'No tenant' });
      return ok(await this.db.getClient().product.create({ data: { tenant_id: tid, ...data } as any }));
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }

  async list(params: ProdListParams): Promise<Result<{ data: any[]; next_cursor?: string }, ProdError>> {
    try {
      const tid = this.getTenantId(); if (!tid) return err({ code: 'QUERY_FAILED', message: 'No tenant' });
      const where: any = { tenant_id: tid };
      if (params.category_id) where.category_id = params.category_id;
      if (params.status) where.status = params.status;
      if (params.search) where.name = { contains: params.search, mode: 'insensitive' };
      const take = (params.limit ?? 20) + 1;
      const items = await this.db.getClient().product.findMany({
        where, take, orderBy: { created_at: 'desc' },
        ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
        include: { category: { select: { id: true, name: true } } },
      });
      let next_cursor: string | undefined;
      if (items.length > (params.limit ?? 20)) { next_cursor = items.pop()!.id; }
      return ok({ data: items, next_cursor });
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }

  async get(id: string): Promise<Result<any, ProdError>> {
    try {
      const tid = this.getTenantId(); if (!tid) return err({ code: 'QUERY_FAILED', message: 'No tenant' });
      const item = await this.db.getClient().product.findFirst({ where: { id, tenant_id: tid }, include: { category: { select: { id: true, name: true } } } });
      if (!item) return err({ code: 'NOT_FOUND' });
      return ok(item);
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }

  async update(id: string, data: { name?: string; sku?: string; description?: string; unit?: string; price?: number; category_id?: string; status?: string }): Promise<Result<any, ProdError>> {
    try {
      const tid = this.getTenantId(); if (!tid) return err({ code: 'QUERY_FAILED', message: 'No tenant' });
      const existing = await this.db.getClient().product.findFirst({ where: { id, tenant_id: tid } });
      if (!existing) return err({ code: 'NOT_FOUND' });
      return ok(await this.db.getClient().product.update({ where: { id }, data }));
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }

  async remove(id: string): Promise<Result<{ message: string }, ProdError>> {
    try {
      const tid = this.getTenantId(); if (!tid) return err({ code: 'QUERY_FAILED', message: 'No tenant' });
      const existing = await this.db.getClient().product.findFirst({ where: { id, tenant_id: tid } });
      if (!existing) return err({ code: 'NOT_FOUND' });
      await this.db.getClient().product.delete({ where: { id } });
      return ok({ message: 'Product deleted' });
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }
}
