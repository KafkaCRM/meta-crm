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
    leadId: string;
    channel: string;
    utmCampaign: string | null;
    verticalId: string;
    scope: RequestScope;
  }): Promise<Result<string | null, CampaignError>> {
    try {
      if (this.cls.isActive()) {
        if (!this.cls.get('scope') && params.scope) {
          this.cls.set('scope', params.scope);
        }
      }

      if (params.utmCampaign) {
        const matchedUtm = await this.db.getClient().campaign.findFirst({
          where: {
            utm_campaign: params.utmCampaign,
            status: 'active',
          },
        });

        if (matchedUtm) {
          await this.db.getClient().lead.update({
            where: { id: params.leadId },
            data: { campaign_id: matchedUtm.id },
          });

          await this.hooks.emit('campaign:lead_added', {
            campaign_id: matchedUtm.id,
            lead_id: params.leadId,
            tenant_id: params.scope.tenant_id,
            channel: params.channel,
            tagged_automatically: true,
          });

          return ok(matchedUtm.id);
        }
      }

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
        await this.db.getClient().lead.update({
          where: { id: params.leadId },
          data: { campaign_id: matchedChannel.id },
        });

        await this.hooks.emit('campaign:lead_added', {
          campaign_id: matchedChannel.id,
          lead_id: params.leadId,
          tenant_id: params.scope.tenant_id,
          channel: params.channel,
          tagged_automatically: true,
        });

        return ok(matchedChannel.id);
      }

      return ok(null);
    } catch (e: any) {
      return err({
        code: 'INTERNAL_ERROR',
        message: e?.message ?? 'Failed in auto-tagging campaign',
      });
    }
  }
}
