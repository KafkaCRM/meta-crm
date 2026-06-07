import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PlatformPrismaService } from '../tenant/platform-prisma.service';
import type { RequestScope } from '../tenant/request-scope.interface';

@Injectable()
export class SetupAuditTrailService {
  constructor(
    private readonly platformDb: PlatformPrismaService,
    private readonly cls: ClsService,
  ) {}

  async log(action: string, section: string, details: any): Promise<void> {
    try {
      const scope = this.cls.get<RequestScope>('scope');
      if (!scope) return;

      const tenantId = scope.tenant_id;
      const userId = scope.user_id;
      
      let userEmail = 'system@meta-crm.local';

      // 1. Resolve user email dynamically based on platform vs tenant scope
      if (userId) {
        if (scope.platform_role) {
          const platformUser = await this.platformDb.client.platformUser.findUnique({
            where: { id: userId },
            select: { email: true },
          });
          if (platformUser) {
            userEmail = platformUser.email;
          }
        } else {
          const tenantUser = await this.platformDb.client.user.findFirst({
            where: { id: userId, tenant_id: tenantId },
            select: { email: true },
          });
          if (tenantUser) {
            userEmail = tenantUser.email || '';
          }
        }
      }

      // 2. Write setup audit trail log
      await this.platformDb.client.setupAuditTrail.create({
        data: {
          tenant_id: tenantId,
          user_email: userEmail,
          action,
          section,
          details: JSON.stringify(details || {}),
        },
      });
    } catch (e) {
      console.error('Failed to log setup audit trail:', e);
    }
  }

  async findMany(): Promise<any[]> {
    try {
      const scope = this.cls.get<RequestScope>('scope');
      if (!scope) return [];

      return await this.platformDb.client.setupAuditTrail.findMany({
        where: { tenant_id: scope.tenant_id },
        orderBy: { created_at: 'desc' },
        take: 100,
      });
    } catch (e) {
      console.error('Failed to retrieve setup audit trail:', e);
      return [];
    }
  }
}
