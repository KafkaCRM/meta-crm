import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { PlatformPrismaService } from '../tenant/platform-prisma.service';
import { WhatsAppAdapter } from '../../integrations/whatsapp/whatsapp-adapter';

interface FlowNode {
  id: string;
  type: 'trigger' | 'condition' | 'action';
  config: {
    field?: string;
    operator?: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'exists';
    value?: string;
    
    actionType?: 'update_field' | 'whatsapp_alert' | 'email_notification';
    fieldName?: string;
    fieldValue?: string;
    recipientPhone?: string;
    recipientEmail?: string;
    messageTemplate?: string;
    subject?: string;
    body?: string;
  };
  nextStepId?: string;
  yesStepId?: string;
  noStepId?: string;
}

@Processor('workflow')
@Injectable()
export class AutomationFlowProcessor extends WorkerHost {
  private readonly logger = new Logger(AutomationFlowProcessor.name);

  constructor(
    private readonly platformDb: PlatformPrismaService,
    private readonly whatsapp: WhatsAppAdapter,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { tenantId, flowId, record } = job.data;
    this.logger.log(`Executing automation flow ${flowId} for tenant ${tenantId} on record ${record?.id}`);

    try {
      const flow = await this.platformDb.client.automationFlow.findFirst({
        where: { id: flowId, tenant_id: tenantId, is_active: true },
      });

      if (!flow) {
        this.logger.warn(`Automation flow ${flowId} not found or is inactive.`);
        return { success: false, reason: 'flow_inactive_or_not_found' };
      }

      const flowJson = flow.flow_json as any;
      const nodes: FlowNode[] = flowJson.steps || flowJson.nodes || [];
      if (nodes.length === 0) {
        this.logger.warn(`Automation flow ${flowId} has no steps/nodes.`);
        return { success: true, reason: 'no_steps' };
      }

      // Start processing from the trigger node or the first node
      let currentNode = nodes.find(n => n.type === 'trigger') || nodes[0];
      let currentRecord = { ...record };

      const maxSteps = 100; // Loop protection
      let stepCount = 0;

      while (currentNode && stepCount < maxSteps) {
        stepCount++;
        this.logger.log(`Executing step: ${currentNode.id} (${currentNode.type})`);

        if (currentNode.type === 'trigger') {
          // Trigger step is just the entry point, move to next step
          const nextId = currentNode.nextStepId || flowJson.connections?.find((c: any) => c.from === currentNode?.id)?.to;
          currentNode = nodes.find(n => n.id === nextId);
          continue;
        }

        if (currentNode.type === 'condition') {
          const isMatched = this.evaluateCondition(currentRecord, currentNode.config);
          this.logger.log(`Condition result for step ${currentNode.id}: ${isMatched}`);

          const nextId = isMatched 
            ? (currentNode.yesStepId || flowJson.connections?.find((c: any) => c.from === currentNode?.id && c.label === 'Yes')?.to || currentNode.nextStepId)
            : (currentNode.noStepId || flowJson.connections?.find((c: any) => c.from === currentNode?.id && c.label === 'No')?.to);

          currentNode = nodes.find(n => n.id === nextId);
          continue;
        }

        if (currentNode.type === 'action') {
          currentRecord = await this.executeAction(tenantId, currentRecord, currentNode.config);
          
          const nextId = currentNode.nextStepId || flowJson.connections?.find((c: any) => c.from === currentNode?.id)?.to;
          currentNode = nodes.find(n => n.id === nextId);
          continue;
        }

        break;
      }

      return { success: true, stepsExecuted: stepCount };
    } catch (error) {
      this.logger.error(`Failed to process automation flow ${flowId}:`, error);
      throw error;
    }
  }

  private evaluateCondition(record: any, config: any): boolean {
    const fieldName = config.field;
    const operator = config.operator;
    const expectedValue = config.value;

    if (!fieldName || !operator) return false;

    const actualValue = this.getFieldValue(record, fieldName);

    switch (operator) {
      case 'equals':
        return String(actualValue).toLowerCase() === String(expectedValue).toLowerCase();
      case 'not_equals':
        return String(actualValue).toLowerCase() !== String(expectedValue).toLowerCase();
      case 'contains':
        return typeof actualValue === 'string' && actualValue.toLowerCase().includes(String(expectedValue).toLowerCase());
      case 'greater_than':
        return Number(actualValue) > Number(expectedValue);
      case 'less_than':
        return Number(actualValue) < Number(expectedValue);
      case 'exists':
        return actualValue !== undefined && actualValue !== null && actualValue !== '';
      default:
        return false;
    }
  }

  private getFieldValue(record: any, fieldName: string): any {
    if (fieldName.startsWith('attributes.')) {
      const attrKey = fieldName.substring('attributes.'.length);
      return record.attributes?.[attrKey];
    }
    if (fieldName.startsWith('data_json.')) {
      const dataKey = fieldName.substring('data_json.'.length);
      return record.data_json?.[dataKey] || record[dataKey];
    }
    // Direct or fallback inside attributes/data_json
    if (record[fieldName] !== undefined) {
      return record[fieldName];
    }
    return record.attributes?.[fieldName] || record.data_json?.[fieldName];
  }

  private async executeAction(tenantId: string, record: any, config: any): Promise<any> {
    const actionType = config.actionType;

    if (actionType === 'update_field') {
      const fieldName = config.fieldName;
      const fieldValue = config.fieldValue || config.value;

      if (!fieldName) return record;

      this.logger.log(`Action: Update Field [${fieldName}] to [${fieldValue}]`);

      // 1. Identify which entity type this is and perform updates
      if (record.object_type !== undefined) {
        // This is a FlexRecord!
        const existingRecord = await this.platformDb.client.flexRecord.findUnique({
          where: { id: record.id },
        });
        if (existingRecord) {
          const mergedData = { ...((existingRecord.data_json ?? {}) as Record<string, any>), [fieldName]: fieldValue };
          const updated = await this.platformDb.client.flexRecord.update({
            where: { id: record.id },
            data: { data_json: mergedData },
          });
          return {
            ...record,
            data_json: mergedData,
            [fieldName]: fieldValue,
          };
        }
      } else if (record.title !== undefined) {
        // This is a Case!
        const isCustomField = fieldName.startsWith('attributes.') || !Object.keys(this.platformDb.client.case).includes(fieldName);
        if (isCustomField) {
          const attrKey = fieldName.startsWith('attributes.') ? fieldName.substring('attributes.'.length) : fieldName;
          const mergedAttributes = { ...((record.attributes ?? {}) as Record<string, any>), [attrKey]: fieldValue };
          await this.platformDb.client.case.update({
            where: { id: record.id },
            data: { attributes: mergedAttributes },
          });
          record.attributes = mergedAttributes;
        } else {
          await this.platformDb.client.case.update({
            where: { id: record.id },
            data: { [fieldName]: fieldValue },
          });
          record[fieldName] = fieldValue;
        }
      } else {
        // This is a Party (standard / custom)!
        const isCustomField = fieldName.startsWith('attributes.') || !['type', 'name', 'email', 'phone_raw', 'phone_normalized', 'source', 'branch_brand_assignment_id'].includes(fieldName);
        if (isCustomField) {
          const attrKey = fieldName.startsWith('attributes.') ? fieldName.substring('attributes.'.length) : fieldName;
          const mergedAttributes = { ...((record.attributes ?? {}) as Record<string, any>), [attrKey]: fieldValue };
          await this.platformDb.client.party.update({
            where: { id: record.id },
            data: { attributes: mergedAttributes },
          });
          record.attributes = mergedAttributes;
        } else {
          await this.platformDb.client.party.update({
            where: { id: record.id },
            data: { [fieldName]: fieldValue },
          });
          record[fieldName] = fieldValue;
        }
      }
    } else if (actionType === 'whatsapp_alert') {
      const phone = config.recipientPhone || record.phone_normalized || record.phone_raw || record.attributes?.phone;
      const message = config.messageTemplate || config.body || `Notification alert regarding your record updates!`;

      if (phone) {
        this.logger.log(`Action: Dispatching WhatsApp to ${phone}`);
        const result = await this.whatsapp.send({
          to: phone,
          message: message,
          tenant_id: tenantId,
        });

        if (result.isErr()) {
          this.logger.warn(`WhatsApp dispatch failed: ${result.error.detail}. Simulated dispatch log instead.`);
        } else {
          this.logger.log(`WhatsApp dispatch successful: ${result.value.message_id}`);
        }
      } else {
        this.logger.warn('WhatsApp alert skipped: No valid recipient phone number resolved.');
      }
    } else if (actionType === 'email_notification') {
      const email = config.recipientEmail || record.email || record.attributes?.email;
      const subject = config.subject || 'CRM Automation System Event Trigger';
      const body = config.body || `Your record ${record.id} triggered a background automation process flow successfully!`;

      if (email) {
        this.logger.log(`Action: Simulating Email dispatch to ${email}`);
        this.logger.log(`[EMAIL DISPATCH] To: ${email} | Subject: ${subject}`);
        this.logger.log(`[EMAIL BODY] ${body}`);
      } else {
        this.logger.warn('Email alert skipped: No valid recipient email resolved.');
      }
    }

    return record;
  }
}
