import { Injectable } from '@nestjs/common';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { PlatformPrismaService } from '../../tenant/platform-prisma.service';

export type PlatformReportErrorCode = 'QUERY_FAILED';

export interface PlatformReportError {
  code: PlatformReportErrorCode;
  message: string;
}

export interface TenantCountEntry {
  industry: string;
  count: number;
}

export interface TenantCountResponse {
  total: number;
  by_industry: TenantCountEntry[];
}

export interface MauEntry {
  tenant_id: string;
  active_users: number;
}

export interface MauResponse {
  monthly_active: MauEntry[];
}

export interface CasesPerDayEntry {
  date: string;
  count: number;
}

export interface CasesPerDayResponse {
  daily: CasesPerDayEntry[];
}

export interface PluginUsageEntry {
  plugin_package: string;
  tenant_count: number;
}

export interface PluginUsageResponse {
  plugins: PluginUsageEntry[];
}

export interface PlatformReportParams {
  date_from?: string;
  date_to?: string;
}

@Injectable()
export class PlatformReportService {
  constructor(private readonly db: PlatformPrismaService) {}

  async tenantCount(): Promise<Result<TenantCountResponse, PlatformReportError>> {
    try {
      const total = await this.db.client.tenant.count({ where: { status: 'active' } });

      const byIndustry = await this.db.client.tenant.groupBy({
        by: ['industry'],
        where: { status: 'active' },
        _count: { id: true },
        orderBy: { industry: 'asc' },
      });

      const by_industry: TenantCountEntry[] = byIndustry.map((g) => ({
        industry: g.industry ?? 'unknown',
        count: g._count.id,
      }));

      return ok({ total, by_industry });
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async mau(params: PlatformReportParams): Promise<Result<MauResponse, PlatformReportError>> {
    try {
      const filter: Record<string, unknown> = {};
      if (params.date_from || params.date_to) {
        const createdAt: Record<string, Date> = {};
        if (params.date_from) createdAt.gte = new Date(params.date_from);
        if (params.date_to) createdAt.lte = new Date(params.date_to);
        filter.created_at = createdAt;
      }

      const users = await this.db.client.user.groupBy({
        by: ['tenant_id'],
        where: { ...filter, status: 'active' },
        _count: { id: true },
      });

      const monthly_active: MauEntry[] = users.map((g) => ({
        tenant_id: g.tenant_id,
        active_users: g._count.id,
      }));

      return ok({ monthly_active });
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async casesPerDay(params: PlatformReportParams): Promise<Result<CasesPerDayResponse, PlatformReportError>> {
    try {
      const raw = await this.db.client.$queryRawUnsafe<{ date: string; count: bigint }[]>(
        `SELECT DATE(created_at) as date, COUNT(*)::int as count
         FROM cases
         ${params.date_from || params.date_to ? 'WHERE created_at >= $1 AND created_at <= $2' : ''}
         GROUP BY DATE(created_at)
         ORDER BY date ASC`,
        ...(params.date_from || params.date_to
          ? [params.date_from ? new Date(params.date_from) : new Date('1970-01-01'),
             params.date_to ? new Date(params.date_to) : new Date('2100-01-01')]
          : []),
      );

      const daily: CasesPerDayEntry[] = raw.map((r) => ({
        date: r.date,
        count: Number(r.count),
      }));

      return ok({ daily });
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async pluginUsage(): Promise<Result<PluginUsageResponse, PlatformReportError>> {
    try {
      const plugins = await this.db.client.pluginRegistry.findMany({
        select: {
          package_name: true,
          _count: { select: { tenantPlugins: true } },
        },
        orderBy: { package_name: 'asc' },
      });

      const entries: PluginUsageEntry[] = plugins.map((p) => ({
        plugin_package: p.package_name,
        tenant_count: p._count.tenantPlugins,
      }));

      return ok({ plugins: entries });
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }
}
