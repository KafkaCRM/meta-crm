import { Injectable, Logger } from '@nestjs/common';
import { ConnectionService } from '../../core/integration/connection.service';

export interface FacebookPageInfo {
  id: string;
  name: string;
  access_token: string;
}

export interface FacebookFormInfo {
  id: string;
  name: string;
  status: string;
  lead_count: number;
}

@Injectable()
export class FacebookAdapter {
  private readonly logger = new Logger(FacebookAdapter.name);

  constructor(private readonly connectionService: ConnectionService) {}

  async getPageInfo(tenantId: string): Promise<FacebookPageInfo | null> {
    const credsResult = await this.connectionService.getDecryptedCredentialsByProvider(tenantId, 'facebook');
    if (credsResult.isErr()) return null;

    const creds = credsResult.value;
    const accessToken = creds.access_token;
    const pageId = creds.page_id;
    if (!accessToken || !pageId) return null;

    try {
      const response = await fetch(
        `https://graph.facebook.com/v19.0/${pageId}?fields=id,name,access_token&access_token=${encodeURIComponent(accessToken)}`,
        { signal: AbortSignal.timeout(10000) },
      );

      if (!response.ok) return null;

      const data = (await response.json()) as Record<string, unknown>;
      return {
        id: (data['id'] ?? pageId) as string,
        name: (data['name'] ?? 'Unknown') as string,
        access_token: (data['access_token'] ?? accessToken) as string,
      };
    } catch {
      return null;
    }
  }

  async listLeadForms(tenantId: string): Promise<FacebookFormInfo[]> {
    const credsResult = await this.connectionService.getDecryptedCredentialsByProvider(tenantId, 'facebook');
    if (credsResult.isErr()) return [];

    const creds = credsResult.value;
    const accessToken = creds.access_token;
    const pageId = creds.page_id;
    if (!accessToken || !pageId) return [];

    try {
      const response = await fetch(
        `https://graph.facebook.com/v19.0/${pageId}/leadgen_forms?access_token=${encodeURIComponent(accessToken)}`,
        { signal: AbortSignal.timeout(10000) },
      );

      if (!response.ok) return [];

      const data = (await response.json()) as Record<string, unknown>;
      const forms = (data['data'] ?? []) as Array<Record<string, unknown>>;

      return forms.map((form) => ({
        id: (form['id'] ?? '') as string,
        name: (form['name'] ?? 'Unknown') as string,
        status: (form['status'] ?? '') as string,
        lead_count: (form['leads_count'] ?? 0) as number,
      }));
    } catch {
      return [];
    }
  }

  async subscribeAppToPage(tenantId: string): Promise<boolean> {
    const credsResult = await this.connectionService.getDecryptedCredentialsByProvider(tenantId, 'facebook');
    if (credsResult.isErr()) return false;

    const creds = credsResult.value;
    const accessToken = creds.access_token;
    const pageId = creds.page_id;
    if (!accessToken || !pageId) return false;

    try {
      const pageInfo = await this.getPageInfo(tenantId);
      if (!pageInfo) return false;

      const response = await fetch(
        `https://graph.facebook.com/v19.0/${pageId}/subscribed_apps?access_token=${pageInfo.access_token}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscribed_fields: ['leadgen'] }),
          signal: AbortSignal.timeout(10000),
        },
      );

      return response.ok;
    } catch {
      return false;
    }
  }
}
