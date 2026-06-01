import { Controller, Post, Body, Headers, Query, BadRequestException, NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { LeadService } from './lead.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { PlatformPrismaService } from '../tenant/platform-prisma.service';
import type { RequestScope } from '../tenant/request-scope.interface';
import { TenantRole } from '@meta-crm/types';

@Controller('leads/web-to-lead')
export class PublicLeadController {
  constructor(
    private readonly leadService: LeadService,
    private readonly platformDb: PlatformPrismaService,
    private readonly cls: ClsService,
  ) {}

  @Post()
  async createWebToLead(
    @Body() dto: CreateLeadDto,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Query('tenant_id') queryTenantId?: string,
  ) {
    const tenantId = headerTenantId || queryTenantId || dto.attributes?.tenant_id || (dto as any).tenant_id;

    if (!tenantId) {
      throw new BadRequestException({
        code: 'MISSING_TENANT_ID',
        message: 'Tenant ID must be provided via x-tenant-id header, query parameter, or payload attribute',
      });
    }

    // Verify tenant exists and is active
    let tenant = await this.platformDb.client.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      // Try looking up by slug as a fallback
      tenant = await this.platformDb.client.tenant.findUnique({
        where: { slug: tenantId },
      });
    }

    if (!tenant) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: `Tenant not found with ID or Slug: ${tenantId}`,
      });
    }

    if (tenant.status !== 'active') {
      throw new BadRequestException({
        code: 'TENANT_INACTIVE',
        message: 'The requested tenant is not active',
      });
    }

    // Run within a synthetic request scope so that the TenantScopedPrismaService interceptor
    // correctly applies the tenant context when executing database queries.
    const result = await this.cls.run(async () => {
      const syntheticScope: RequestScope = {
        tenant_id: tenant.id,
        user_id: 'system_web_form',
        assignment_ids: [],
        role: TenantRole.Member,
        vertical_ids: [],
      };
      this.cls.set('scope', syntheticScope);

      // Force source to be 'web_form' to guarantee correct attribution
      const leadPayload = {
        ...dto,
        source: 'web_form',
      };

      return this.leadService.create(leadPayload);
    });

    if (result.isErr()) {
      throw new BadRequestException({
        code: result.error.code,
        message: result.error.message,
      });
    }

    return result.value;
  }
}
