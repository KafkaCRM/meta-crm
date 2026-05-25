import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';
import { HooksService } from '../hooks/hooks.service';
import type { RequestScope } from '../tenant/request-scope.interface';
import type { CampaignError } from './campaign.service';

@Injectable()
export class CampaignAutoTagService {
  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly cls: ClsService,
    private readonly hooks: HooksService,
  ) {}

  async autoTagCampaign(params: {
    caseId: string;
    channel: string;
    utmCampaign: string | null;
    verticalId: string;
    scope: RequestScope;
  }): Promise<Result<string | null, CampaignError>> {
    try {
      // Safely ensure the request scope is set in CLS context so that TenantScopedPrismaService can query correctly.
      if (this.cls.isActive()) {
        if (!this.cls.get('scope') && params.scope) {
          this.cls.set('scope', params.scope);
        }
      }

      // 1. UTM Match (highest priority)
      if (params.utmCampaign) {
        const matchedUtm = await this.db.getClient().campaign.findFirst({
          where: {
            utm_campaign: params.utmCampaign,
            status: 'active',
          },
        });

        if (matchedUtm) {
          await this.db.getClient().case.update({
            where: { id: params.caseId },
            data: { campaign_id: matchedUtm.id },
          });

          await this.hooks.emit('campaign:lead_added', {
            campaign_id: matchedUtm.id,
            case_id: params.caseId,
            tenant_id: params.scope.tenant_id,
            channel: params.channel,
            tagged_automatically: true,
          });

          return ok(matchedUtm.id);
        }
      }

      // 2. Channel + Vertical Match
      const now = new Date();
      const matchedChannel = await this.db.getClient().campaign.findFirst({
        where: {
          channel: params.channel,
          vertical_id: params.verticalId,
          status: 'active',
          start_date: { lte: now },
          OR: [
            { end_date: null },
            { end_date: { gte: now } },
          ],
        },
        orderBy: { created_at: 'desc' },
      });

      if (matchedChannel) {
        await this.db.getClient().case.update({
          where: { id: params.caseId },
          data: { campaign_id: matchedChannel.id },
        });

        await this.hooks.emit('campaign:lead_added', {
          campaign_id: matchedChannel.id,
          case_id: params.caseId,
          tenant_id: params.scope.tenant_id,
          channel: params.channel,
          tagged_automatically: true,
        });

        return ok(matchedChannel.id);
      }

      // 3. No match
      return ok(null);
    } catch (e: any) {
      return err({
        code: 'INTERNAL_ERROR',
        message: e?.message ?? 'Failed in auto-tagging campaign',
      });
    }
  }
}
