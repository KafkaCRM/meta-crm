import { Injectable, Logger } from '@nestjs/common';
import { ConnectionService } from '../../core/integration/connection.service';
import { IntakePipelineService } from '../../core/integration/intake-pipeline.service';

@Injectable()
export class JustDialWebhookService {
  private readonly logger = new Logger(JustDialWebhookService.name);

  constructor(
    private readonly connectionService: ConnectionService,
    private readonly intakePipeline: IntakePipelineService,
  ) {}

  verifyApiKey(providedKey: string, storedKey: string): boolean {
    return providedKey === storedKey;
  }

  parsePayload(body: Record<string, unknown>): Record<string, string> | null {
    const enquiry = body['enquiry'] as Record<string, unknown> | undefined;
    const buyerDetails = enquiry?.['buyer_details'] as Record<string, unknown> | undefined;
    const listing = enquiry?.['listing_details'] as Record<string, unknown> | undefined;

    if (!buyerDetails || !listing) return null;

    return {
      'jd.name': (buyerDetails['name'] ?? '') as string,
      'jd.phone': (buyerDetails['mobile'] ?? buyerDetails['phone'] ?? '') as string,
      'jd.email': (buyerDetails['email'] ?? '') as string,
      'jd.company': (buyerDetails['company_name'] ?? '') as string,
      'jd.city': (buyerDetails['city'] ?? '') as string,
      'jd.enquiry_date': (enquiry?.['enquiry_date'] ?? '') as string,
      'jd.enquiry_id': (enquiry?.['enquiry_id'] ?? '') as string,
      'jd.listing_name': (listing['listing_name'] ?? listing['product_name'] ?? '') as string,
      'jd.listing_city': (listing['listing_city'] ?? '') as string,
      'jd.category': (listing['category'] ?? '') as string,
      'jd.source': 'justdial',
    };
  }

  async resolveTenantFromClientId(clientId: string): Promise<string | null> {
    return this.connectionService.resolveTenantForProvider('justdial', {
      client_id: clientId,
    });
  }

  async processEnquiry(
    tenantId: string,
    enquiryId: string,
    parsedFields: Record<string, string>,
    rawPayload: Record<string, unknown>,
  ): Promise<{ success: boolean; entity_id?: string; error?: string }> {
    const connectionId = await this.connectionService.findConnectionId(tenantId, 'justdial');
    if (!connectionId) {
      return { success: false, error: 'JustDial connection not found' };
    }

    const result = await this.intakePipeline.processInboundEvent({
      connectionId,
      providerEventId: `jd_enquiry_${enquiryId}`,
      eventType: 'justdial_enquiry',
      rawPayload,
      parsedFields,
      tenantId,
    });

    if (result.isErr()) {
      return { success: false, error: result.error.message };
    }

    return { success: true, entity_id: result.value.entity_id ?? undefined };
  }
}
