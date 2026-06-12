import { Injectable, Logger } from '@nestjs/common';
import { ConnectionService } from '../../core/integration/connection.service';

@Injectable()
export class JustDialAdapter {
  private readonly logger = new Logger(JustDialAdapter.name);

  constructor(private readonly connectionService: ConnectionService) {}

  async validateConnection(tenantId: string): Promise<{ valid: boolean; message: string }> {
    const credsResult = await this.connectionService.getDecryptedCredentialsByProvider(tenantId, 'justdial');
    if (credsResult.isErr()) {
      return { valid: false, message: `Credentials not configured: ${credsResult.error.message}` };
    }

    const creds = credsResult.value;
    if (!creds.api_key || !creds.client_id) {
      return { valid: false, message: 'Missing api_key or client_id' };
    }

    return { valid: true, message: 'JustDial credentials configured' };
  }
}
