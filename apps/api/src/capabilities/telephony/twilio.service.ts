import { Injectable, Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { ConnectionService } from '../../core/integration/connection.service';
import type { RequestScope } from '../../core/tenant/request-scope.interface';

export type TwilioErrorCode = 'CREDENTIALS_MISSING' | 'CALL_FAILED' | 'QUERY_FAILED';
export interface TwilioError { code: TwilioErrorCode; message?: string }

@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);

  constructor(
    private readonly connectionService: ConnectionService,
    private readonly cls: ClsService,
  ) {}

  private async getCredentials(tenantId: string): Promise<Result<{
    account_sid: string; auth_token: string; twilio_phone_number: string;
  }, TwilioError>> {
    const credsResult = await this.connectionService.getDecryptedCredentialsByProvider(tenantId, 'twilio');
    if (credsResult.isErr()) {
      return err({ code: 'CREDENTIALS_MISSING', message: 'Twilio not configured. Connect it from Integrations.' });
    }
    const creds = credsResult.value;
    if (!creds.account_sid || !creds.auth_token || !creds.twilio_phone_number) {
      return err({ code: 'CREDENTIALS_MISSING', message: 'Incomplete Twilio credentials' });
    }
    return ok({
      account_sid: creds.account_sid,
      auth_token: creds.auth_token,
      twilio_phone_number: creds.twilio_phone_number,
    });
  }

  async makeCall(params: {
    to: string; twiml?: string;
  }): Promise<Result<{ call_sid: string }, TwilioError>> {
    const scope = this.cls.get<RequestScope>('scope');
    if (!scope?.tenant_id) return err({ code: 'QUERY_FAILED', message: 'Tenant context missing' });

    const credsResult = await this.getCredentials(scope.tenant_id);
    if (credsResult.isErr()) return err(credsResult.error);

    const { account_sid, auth_token, twilio_phone_number } = credsResult.value;

    const url = `https://api.twilio.com/2010-04-01/Accounts/${account_sid}/Calls.json`;
    const body = new URLSearchParams({
      To: params.to,
      From: twilio_phone_number,
      Twiml: params.twiml ?? '<Response><Say>Hello, this is a test call.</Say></Response>',
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${account_sid}:${auth_token}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      const data = await response.json() as Record<string, unknown>;
      if (!response.ok) {
        return err({ code: 'CALL_FAILED', message: (data['message'] as string) ?? 'Twilio API error' });
      }

      return ok({ call_sid: data['sid'] as string });
    } catch (e) {
      return err({ code: 'CALL_FAILED', message: (e as Error).message });
    }
  }

  async parseWebhook(body: Record<string, unknown>): Promise<{
    call_sid: string; from: string; to: string; direction: string;
    call_status: string; recording_url?: string; duration_secs?: number;
  } | null> {
    const callSid = body['CallSid'] as string;
    const from = body['From'] as string;
    const to = body['To'] as string;
    const callStatus = body['CallStatus'] as string;
    const direction = body['Direction'] as string ?? 'inbound';
    const recordingUrl = body['RecordingUrl'] as string;
    const durationStr = body['CallDuration'] as string;

    if (!callSid || !from || !to) return null;

    return {
      call_sid: callSid,
      from,
      to,
      direction: direction.toLowerCase(),
      call_status: callStatus ?? 'completed',
      recording_url: recordingUrl,
      duration_secs: durationStr ? parseInt(durationStr, 10) : undefined,
    };
  }

}
