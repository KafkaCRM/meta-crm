import { Injectable } from '@nestjs/common';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../../core/tenant/tenant-scoped-prisma.service';
import { ClsService } from 'nestjs-cls';
import type { RequestScope } from '../../core/tenant/request-scope.interface';

export type AssetErrorCode = 'NOT_FOUND' | 'QUERY_FAILED';
export interface AssetError { code: AssetErrorCode; message?: string }
export interface AssetListParams { cursor?: string; limit?: number; status?: string; type?: string; search?: string; }

@Injectable()
export class AssetsService {
  constructor(private readonly db: TenantScopedPrismaService, private readonly cls: ClsService) {}
  private getTenantId(): string | null { return this.cls.get<RequestScope>('scope')?.tenant_id ?? null; }

  async create(data: { name: string; asset_code: string; type?: string; status?: string; assigned_to_id?: string; purchase_date?: string; purchase_cost?: number; notes?: string }): Promise<Result<any, AssetError>> {
    try {
      const tid = this.getTenantId(); if (!tid) return err({ code: 'QUERY_FAILED', message: 'No tenant' });
      return ok(await this.db.getClient().asset.create({ data: { tenant_id: tid, ...data, purchase_date: data.purchase_date ? new Date(data.purchase_date) : undefined } as any }));
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }

  async list(params: AssetListParams): Promise<Result<{ data: any[]; next_cursor?: string }, AssetError>> {
    try {
      const tid = this.getTenantId(); if (!tid) return err({ code: 'QUERY_FAILED', message: 'No tenant' });
      const where: any = { tenant_id: tid };
      if (params.status) where.status = params.status;
      if (params.type) where.type = params.type;
      if (params.search) where.name = { contains: params.search, mode: 'insensitive' };
      const take = (params.limit ?? 20) + 1;
      const items = await this.db.getClient().asset.findMany({
        where, take, orderBy: { created_at: 'desc' },
        ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
        include: { assigned_to: { select: { id: true, name: true } } },
      });
      let next_cursor: string | undefined;
      if (items.length > (params.limit ?? 20)) { next_cursor = items.pop()!.id; }
      return ok({ data: items, next_cursor });
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }

  async get(id: string): Promise<Result<any, AssetError>> {
    try {
      const tid = this.getTenantId(); if (!tid) return err({ code: 'QUERY_FAILED', message: 'No tenant' });
      const item = await this.db.getClient().asset.findFirst({ where: { id, tenant_id: tid }, include: { assigned_to: { select: { id: true, name: true } } } });
      if (!item) return err({ code: 'NOT_FOUND' });
      return ok(item);
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }

  async update(id: string, data: { name?: string; asset_code?: string; type?: string; status?: string; assigned_to_id?: string; purchase_date?: string; purchase_cost?: number; notes?: string }): Promise<Result<any, AssetError>> {
    try {
      const tid = this.getTenantId(); if (!tid) return err({ code: 'QUERY_FAILED', message: 'No tenant' });
      const existing = await this.db.getClient().asset.findFirst({ where: { id, tenant_id: tid } });
      if (!existing) return err({ code: 'NOT_FOUND' });
      return ok(await this.db.getClient().asset.update({ where: { id }, data: { ...data, purchase_date: data.purchase_date ? new Date(data.purchase_date) : undefined } as any }));
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }

  async remove(id: string): Promise<Result<{ message: string }, AssetError>> {
    try {
      const tid = this.getTenantId(); if (!tid) return err({ code: 'QUERY_FAILED', message: 'No tenant' });
      const existing = await this.db.getClient().asset.findFirst({ where: { id, tenant_id: tid } });
      if (!existing) return err({ code: 'NOT_FOUND' });
      await this.db.getClient().asset.delete({ where: { id } });
      return ok({ message: 'Asset deleted' });
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }
}
