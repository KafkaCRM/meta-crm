import { Controller, Post, Body, Logger } from '@nestjs/common';
import { TwilioService } from './twilio.service';
import { CallLogsService } from './call-logs.service';
import { ConnectionService } from '../../core/integration/connection.service';
import { TenantScopedPrismaService } from '../../core/tenant/tenant-scoped-prisma.service';

@Controller('webhooks/twilio')
export class TwilioWebhookController {
  private readonly logger = new Logger(TwilioWebhookController.name);

  constructor(
    private readonly twilioService: TwilioService,
    private readonly callLogsService: CallLogsService,
    private readonly connectionService: ConnectionService,
    private readonly db: TenantScopedPrismaService,
  ) {}

  @Post('voice')
  async handleIncomingCall(@Body() body: Record<string, unknown>): Promise<{ success: boolean }> {
    const parsed = await this.twilioService.parseWebhook(body);
    if (!parsed) {
      this.logger.warn('Invalid Twilio webhook payload');
      return { success: false };
    }

    const toNumber = parsed.to;
    const tenantId = await this.connectionService.resolveTenantForProvider('twilio', {
      twilio_phone_number: toNumber,
    });

    if (!tenantId) {
      this.logger.warn(`No tenant found for Twilio number ${toNumber}`);
      return { success: false };
    }

    // Find party by caller number
    const party = await this.db.getClient().party.findFirst({
      where: { tenant_id: tenantId, phone_raw: parsed.from },
      select: { id: true },
    });

    await this.callLogsService.create({
      direction: parsed.direction as any,
      from_number: parsed.from,
      to_number: parsed.to,
      party_id: party?.id,
      twilio_call_sid: parsed.call_sid,
      status: parsed.call_status,
      recording_url: parsed.recording_url,
      duration_secs: parsed.duration_secs,
    });

    this.logger.log(`Logged Twilio call ${parsed.call_sid} from ${parsed.from}`);
    return { success: true };
  }

  @Post('status')
  async handleStatusCallback(@Body() body: Record<string, unknown>): Promise<{ success: boolean }> {
    const parsed = await this.twilioService.parseWebhook(body);
    if (!parsed) return { success: false };

    try {
      const callLog = await this.db.getClient().callLog.findFirst({
        where: { twilio_call_sid: parsed.call_sid },
      });
      if (callLog) {
        await this.db.getClient().callLog.update({
          where: { id: callLog.id },
          data: {
            status: parsed.call_status,
            duration_secs: parsed.duration_secs,
            recording_url: parsed.recording_url,
            ended_at: parsed.call_status === 'completed' ? new Date() : undefined,
          } as any,
        });
      }
    } catch (e) {
      this.logger.error(`Failed to update call log: ${(e as Error).message}`);
    }

    return { success: true };
  }
}
