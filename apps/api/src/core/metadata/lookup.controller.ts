import {
  Controller,
  Get,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';
import type { RequestScope } from '../tenant/request-scope.interface';

@Controller('metadata/lookup')
@UseGuards(JwtAuthGuard)
export class LookupController {
  constructor(private readonly db: TenantScopedPrismaService) {}

  @Get('search')
  async search(
    @Query('relatedTo') relatedTo: string,
    @Query('q') q: string = '',
    @CurrentUser() scope: RequestScope,
  ) {
    if (!relatedTo) {
      throw new BadRequestException('Query parameter "relatedTo" is required');
    }

    const tenantId = scope.tenant_id;

    // 1. If it's a custom dynamic object
    if (relatedTo.endsWith('__c')) {
      const records = await this.db.getClient().flexRecord.findMany({
        where: {
          tenant_id: tenantId,
          object_type: relatedTo,
        },
      });

      const queryLower = q.toLowerCase();
      const filtered = records.filter((r) => {
        const data = (r.data_json ?? {}) as Record<string, any>;
        return Object.values(data).some(
          (val) =>
            typeof val === 'string' && val.toLowerCase().includes(queryLower),
        );
      });

      return filtered.slice(0, 15).map((r) => {
        const data = (r.data_json ?? {}) as Record<string, any>;
        // Try common display fields for the label, fallback to ID
        const label = data.name || data.title || data.label || r.id;
        // Collect some subtext context from other attributes
        const subtext = Object.entries(data)
          .filter(([key, val]) => key !== 'name' && key !== 'title' && typeof val === 'string')
          .map(([_, val]) => val)
          .slice(0, 1)
          .join(', ') || '';

        return {
          id: r.id,
          label,
          subtext,
        };
      });
    }

    // 2. Standard CRM objects
    const prismaModelName = relatedTo.charAt(0).toLowerCase() + relatedTo.slice(1);
    const client = this.db.getClient() as any;

    if (client[prismaModelName]) {
      try {
        const where: any = {
          ...(prismaModelName !== 'user' ? { tenant_id: tenantId } : {}),
        };

        if (q) {
          if (prismaModelName === 'party') {
            where.OR = [
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ];
          } else if (prismaModelName === 'user') {
            where.name = { contains: q, mode: 'insensitive' };
          } else if (prismaModelName === 'appointment') {
            where.title = { contains: q, mode: 'insensitive' };
          } else if (prismaModelName === 'property') {
            where.OR = [
              { title: { contains: q, mode: 'insensitive' } },
              { city: { contains: q, mode: 'insensitive' } },
            ];
          } else {
            where.id = { contains: q };
          }
        }

        const results = await client[prismaModelName].findMany({
          where,
          take: 15,
        });

        return results.map((r: any) => ({
          id: r.id,
          label: r.name || r.title || r.id,
          subtext: r.email || r.stage || r.status || '',
        }));
      } catch (error) {
        return [];
      }
    }

    return [];
  }
}
