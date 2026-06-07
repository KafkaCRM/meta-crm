import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { PlatformPrismaService } from '../tenant/platform-prisma.service';
import { HooksService } from '../hooks/hooks.service';
import { RoomManagerService } from '../realtime/room-manager.service';
import * as dayjsImport from 'dayjs';
const dayjs = ((dayjsImport as any).default || dayjsImport) as any;

@Injectable()
export class SlaEscalationService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(SlaEscalationService.name);
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly platformDb: PlatformPrismaService,
    private readonly hooks: HooksService,
    private readonly roomManager: RoomManagerService,
  ) {}

  onApplicationBootstrap() {
    this.logger.log('Starting SLA Escalation Checker background loop...');
    // Run the check every 60 seconds
    this.checkInterval = setInterval(() => this.checkSlas(), 60000);
    
    // Also run immediately on startup after a small delay (5 seconds) to catch up
    setTimeout(() => this.checkSlas(), 5000);
  }

  onApplicationShutdown() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }

  async checkSlas() {
    this.logger.debug('Running SLA breach check...');
    try {
      // 1. Fetch all pipeline stages that have an SLA defined
      const stagesWithSla = await this.platformDb.client.pipelineStage.findMany({
        where: {
          sla_hours: { not: null },
          terminal_outcome: null,
        },
      });

      if (stagesWithSla.length === 0) {
        return;
      }

      const now = new Date();

      for (const stage of stagesWithSla) {
        const slaHours = stage.sla_hours!;
        const breachThreshold = new Date(now.getTime() - slaHours * 60 * 60 * 1000);

        // Find active cases in this stage that transitioned before the breach threshold
        const cases = await this.platformDb.client.case.findMany({
          where: {
            stage: stage.id,
            last_stage_changed_at: { lt: breachThreshold },
          },
        });

        for (const caseRecord of cases) {
          const attributes = (caseRecord.attributes || {}) as Record<string, any>;
          
          // Skip if already flagged as breached
          if (attributes.sla_breached === true) {
            continue;
          }

          this.logger.warn(`SLA breached for Case "${caseRecord.title}" (ID: ${caseRecord.id}) in stage "${stage.name}". Spent more than ${slaHours} hours.`);

          // 2. Update case attributes to mark as breached
          const updatedAttributes = {
            ...attributes,
            sla_breached: true,
            sla_breached_at: now.toISOString(),
          };

          await this.platformDb.client.case.update({
            where: { id: caseRecord.id },
            data: {
              attributes: updatedAttributes,
            },
          });

          // 3. Create CaseEvent for auditing
          const hoursSpent = dayjs(now).diff(dayjs(caseRecord.last_stage_changed_at), 'hour');
          await this.platformDb.client.caseEvent.create({
            data: {
              case_id: caseRecord.id,
              tenant_id: caseRecord.tenant_id,
              event_type: 'sla_breached',
              from_stage: stage.id,
              to_stage: stage.id,
              actor_id: 'system',
              actor_type: 'system',
              payload: {
                sla_hours: slaHours,
                hours_spent: hoursSpent,
                stage_name: stage.name,
              },
            },
          });

          // 4. Emit socket event for real-time frontend update
          this.roomManager.broadcastToTenant(caseRecord.tenant_id, 'case:sla_breached', {
            case_id: caseRecord.id,
            case_title: caseRecord.title,
            stage_id: stage.id,
            stage_name: stage.name,
            hours_spent: hoursSpent,
          });

          // 5. Emit hook event for plugin integrations
          await this.hooks.emit('case:sla_breached', {
            case_id: caseRecord.id,
            tenant_id: caseRecord.tenant_id,
            stage_id: stage.id,
            stage_name: stage.name,
            sla_hours: slaHours,
            hours_spent: hoursSpent,
          });
        }
      }
    } catch (error) {
      this.logger.error('Failed to run SLA breach check', error);
    }
  }
}
