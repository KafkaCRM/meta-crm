import { Injectable, Logger } from '@nestjs/common';
import { ConnectionService } from './connection.service';

export type OAuthProvider = 'facebook' | 'google';

interface OAuthProviderConfig {
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
}

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(private readonly connectionService: ConnectionService) {}

  private getProviderConfig(provider: OAuthProvider): OAuthProviderConfig | null {
    const configs: Record<OAuthProvider, OAuthProviderConfig> = {
      facebook: {
        clientId: process.env['FACEBOOK_OAUTH_CLIENT_ID'] ?? '',
        clientSecret: process.env['FACEBOOK_OAUTH_CLIENT_SECRET'] ?? '',
        authorizeUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
        tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
        scopes: ['pages_manage_ads', 'pages_read_engagement', 'leads_retrieval'],
      },
      google: {
        clientId: process.env['GOOGLE_OAUTH_CLIENT_ID'] ?? '',
        clientSecret: process.env['GOOGLE_OAUTH_CLIENT_SECRET'] ?? '',
        authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        scopes: ['https://www.googleapis.com/auth/calendar'],
      },
    };
    return configs[provider] ?? null;
  }

  getAuthorizationUrl(provider: OAuthProvider, tenantId: string, redirectUri: string, frontendRedirect?: string): string | null {
    const config = this.getProviderConfig(provider);
    if (!config || !config.clientId) {
      this.logger.warn(`OAuth not configured for provider: ${provider}`);
      return null;
    }

    const state = Buffer.from(JSON.stringify({ tenant_id: tenantId, provider, redirect_to: frontendRedirect ?? '' })).toString('base64url');
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: config.scopes.join(' '),
      state,
    });

    return `${config.authorizeUrl}?${params.toString()}`;
  }

  async handleCallback(
    provider: OAuthProvider,
    code: string,
    state: string,
    redirectUri: string,
  ): Promise<{ success: boolean; message: string; redirect_to?: string }> {
    const config = this.getProviderConfig(provider);
    if (!config || !config.clientId || !config.clientSecret) {
      return { success: false, message: `OAuth not configured for ${provider}` };
    }

    let tenantId: string;
    let frontendRedirect = '';
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
      tenantId = stateData.tenant_id;
      frontendRedirect = stateData.redirect_to ?? '';
      if (stateData.provider !== provider) {
        return { success: false, message: 'OAuth state mismatch' };
      }
    } catch {
      return { success: false, message: 'Invalid OAuth state' };
    }

    // Exchange code for token
    let tokenResponse: Response;
    try {
      tokenResponse = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });
    } catch (e) {
      return { success: false, message: `Token exchange network error: ${(e as Error).message}` };
    }

    if (!tokenResponse.ok) {
      const body = await tokenResponse.text().catch(() => '');
      this.logger.error(`OAuth token exchange failed for ${provider}: ${body}`);
      return { success: false, message: `Token exchange failed: ${body.substring(0, 200)}` };
    }

    const tokenData = (await tokenResponse.json()) as Record<string, unknown>;
    const accessToken = tokenData['access_token'] as string | undefined;
    const refreshToken = tokenData['refresh_token'] as string | undefined;

    if (!accessToken) {
      return { success: false, message: 'No access token in OAuth response' };
    }

    // For Facebook, exchange short-lived token for long-lived page token
    let finalToken = accessToken;
    let finalRefreshToken = refreshToken;

    if (provider === 'facebook') {
      try {
        const longLivedResponse = await fetch(
          `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${config.clientId}&client_secret=${config.clientSecret}&fb_exchange_token=${accessToken}`,
        );
        const longLivedData = await longLivedResponse.json() as Record<string, unknown>;
        finalToken = longLivedData['access_token'] as string ?? accessToken;
      } catch {
        this.logger.warn('Failed to exchange for long-lived Facebook token, using short-lived');
      }
    }

    // Store token in IntegrationConnection
    const creds: Record<string, string> = { oauth_token: finalToken };
    if (provider === 'facebook') {
      creds.access_token = finalToken;
      creds.app_secret = config.clientSecret;
    } else {
      creds.client_id = config.clientId;
      creds.client_secret = config.clientSecret;
      if (finalRefreshToken) creds.refresh_token = finalRefreshToken;
    }

    const storeResult = await this.connectionService.connect(provider, creds, {
      oauth_provider: provider,
      oauth_connected_at: new Date().toISOString(),
    });

    if (storeResult.isErr()) {
      return { success: false, message: `Failed to store credentials: ${storeResult.error.message}` };
    }

    this.logger.log(`OAuth connected for tenant ${tenantId} with ${provider}`);
    return { success: true, message: `${provider} connected via OAuth`, redirect_to: frontendRedirect };
  }
}
