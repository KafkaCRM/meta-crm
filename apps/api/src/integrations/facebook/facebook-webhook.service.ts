import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { ConnectionService } from '../../core/integration/connection.service';
import { IntakePipelineService } from '../../core/integration/intake-pipeline.service';

export interface FacebookLeadData {
  leadgen_id: string;
  page_id: string;
  form_id: string;
  adgroup_id: string;
  ad_id: string;
  created_time: string;
  field_data: Record<string, string>;
}

@Injectable()
export class FacebookWebhookService {
  private readonly logger = new Logger(FacebookWebhookService.name);

  constructor(
    private readonly connectionService: ConnectionService,
    private readonly intakePipeline: IntakePipelineService,
  ) {}

  verifySignature(
    rawBody: string,
    signatureHeader: string | undefined,
    appSecret: string,
  ): boolean {
    if (!signatureHeader) return false;

    const expected = signatureHeader.replace('sha256=', '');
    const computed = createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex');

    if (expected.length !== computed.length) return false;
    return timingSafeEqual(Buffer.from(expected), Buffer.from(computed));
  }

  parseWebhookPayload(body: Record<string, unknown>): {
    pageId: string;
    leadgenIds: string[];
  } | null {
    const entry = (body['entry'] as Array<Record<string, unknown>> | undefined)?.[0];
    if (!entry) return null;

    const pageId = entry['id'] as string | undefined;
    const changes = entry['changes'] as Array<Record<string, unknown>> | undefined;
    if (!pageId || !changes) return null;

    const leadgenIds: string[] = [];

    for (const change of changes) {
      const field = change['field'] as string | undefined;
      if (field !== 'leadgen') continue;

      const value = change['value'] as Record<string, unknown> | undefined;
      const leadgenId = value?.['leadgen_id'] as string | undefined;
      if (leadgenId) leadgenIds.push(leadgenId);
    }

    return leadgenIds.length > 0 ? { pageId, leadgenIds } : null;
  }

  async resolveTenantFromPageId(pageId: string): Promise<string | null> {
    return this.connectionService.resolveTenantForProvider('facebook', {
      page_id: pageId,
    });
  }

  async fetchLeadDetails(
    leadgenId: string,
    accessToken: string,
  ): Promise<FacebookLeadData | null> {
    try {
      const url = `https://graph.facebook.com/v19.0/${leadgenId}?access_token=${encodeURIComponent(accessToken)}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });

      if (!response.ok) {
        this.logger.warn(`Facebook Graph API returned ${response.status} for leadgen ${leadgenId}`);
        return null;
      }

      const data = (await response.json()) as Record<string, unknown>;
      const fieldDataArray = data['field_data'] as Array<Record<string, unknown>> | undefined;

      const fieldData: Record<string, string> = {};
      if (fieldDataArray) {
        for (const field of fieldDataArray) {
          const name = field['name'] as string | undefined;
          const values = field['values'] as string[] | undefined;
          if (name && values && values.length > 0) {
            fieldData[name] = values[0] ?? '';
          }
        }
      }

      return {
        leadgen_id: leadgenId,
        page_id: (data['page_id'] ?? '') as string,
        form_id: (data['form_id'] ?? '') as string,
        adgroup_id: (data['adgroup_id'] ?? '') as string,
        ad_id: (data['ad_id'] ?? '') as string,
        created_time: (data['created_time'] ?? '') as string,
        field_data: fieldData,
      };
    } catch (e) {
      this.logger.error(`Failed to fetch Facebook lead details for ${leadgenId}: ${(e as Error).message}`);
      return null;
    }
  }

  async processLead(
    tenantId: string,
    pageId: string,
    leadgenId: string,
    accessToken: string,
  ): Promise<{ success: boolean; entity_id?: string; error?: string }> {
    // 1. Find the Facebook connection for this tenant
    const connectionId = await this.connectionService.findConnectionId(tenantId, 'facebook');
    if (!connectionId) {
      return { success: false, error: 'Facebook connection not found' };
    }

    // 2. Fetch lead details from Facebook Graph API
    const leadData = await this.fetchLeadDetails(leadgenId, accessToken);
    if (!leadData) {
      return { success: false, error: `Failed to fetch lead details for ${leadgenId}` };
    }

    // 3. Build parsed fields from lead data
    const parsedFields: Record<string, string> = {
      'ad_lead.leadgen_id': leadData.leadgen_id,
      'ad_lead.page_id': leadData.page_id,
      'ad_lead.form_id': leadData.form_id,
      'ad_lead.ad_id': leadData.ad_id,
      'ad_lead.adgroup_id': leadData.adgroup_id,
      'ad_lead.created_time': leadData.created_time,
      ...Object.fromEntries(
        Object.entries(leadData.field_data).map(([key, value]) => [`ad_lead.${key}`, value]),
      ),
    };

    // 4. Run through intake pipeline
    const result = await this.intakePipeline.processInboundEvent({
      connectionId,
      providerEventId: `fb_leadgen_${leadgenId}`,
      eventType: 'facebook_leadgen',
      rawPayload: leadData as unknown as Record<string, unknown>,
      parsedFields,
      tenantId,
    });

    if (result.isErr()) {
      return { success: false, error: result.error.message };
    }

    return { success: true, entity_id: result.value.entity_id ?? undefined };
  }
}
