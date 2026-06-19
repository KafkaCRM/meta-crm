import { Injectable } from '@nestjs/common';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../../core/tenant/tenant-scoped-prisma.service';
import { ClsService } from 'nestjs-cls';
import type { RequestScope } from '../../core/tenant/request-scope.interface';

export type CatErrorCode = 'NOT_FOUND' | 'QUERY_FAILED';
export interface CatError { code: CatErrorCode; message?: string }

@Injectable()
export class ProductCategoriesService {
  constructor(private readonly db: TenantScopedPrismaService, private readonly cls: ClsService) {}
  private getTenantId(): string | null { return this.cls.get<RequestScope>('scope')?.tenant_id ?? null; }

  async create(data: { name: string; description?: string; parent_id?: string }): Promise<Result<any, CatError>> {
    try {
      const tid = this.getTenantId(); if (!tid) return err({ code: 'QUERY_FAILED', message: 'No tenant' });
      return ok(await this.db.getClient().productCategory.create({ data: { tenant_id: tid, ...data } as any }));
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }

  async list(): Promise<Result<any[], CatError>> {
    try {
      const tid = this.getTenantId(); if (!tid) return err({ code: 'QUERY_FAILED', message: 'No tenant' });
      return ok(await this.db.getClient().productCategory.findMany({ where: { tenant_id: tid }, include: { _count: { select: { products: true } } }, orderBy: { name: 'asc' } }));
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }

  async update(id: string, data: { name?: string; description?: string; parent_id?: string }): Promise<Result<any, CatError>> {
    try {
      const tid = this.getTenantId(); if (!tid) return err({ code: 'QUERY_FAILED', message: 'No tenant' });
      const existing = await this.db.getClient().productCategory.findFirst({ where: { id, tenant_id: tid } });
      if (!existing) return err({ code: 'NOT_FOUND' });
      return ok(await this.db.getClient().productCategory.update({ where: { id }, data }));
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }

  async remove(id: string): Promise<Result<{ message: string }, CatError>> {
    try {
      const tid = this.getTenantId(); if (!tid) return err({ code: 'QUERY_FAILED', message: 'No tenant' });
      const existing = await this.db.getClient().productCategory.findFirst({ where: { id, tenant_id: tid } });
      if (!existing) return err({ code: 'NOT_FOUND' });
      await this.db.getClient().productCategory.delete({ where: { id } });
      return ok({ message: 'Category deleted' });
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }
}
