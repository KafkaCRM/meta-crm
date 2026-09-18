import { Worker, Job } from 'bullmq';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { automationWorkflows, leads, leadEvents, parties } from '../db/schema';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export function startAutomationWorker() {
  const worker = new Worker(
    'workflow',
    async (job: Job) => {
      const { tenantId, flowId, record } = job.data;
      console.log(`[WORKER] Executing automation flow ${flowId} for tenant ${tenantId} on record ${record?.id}`);

      const flow = await db.query.automationWorkflows.findFirst({
        where: and(
          eq(automationWorkflows.id, flowId),
          eq(automationWorkflows.tenantId, tenantId),
          eq(automationWorkflows.isActive, true)
        ),
      });

      if (!flow) {
        console.warn(`[WORKER] Flow ${flowId} not found or inactive`);
        return { success: false, reason: 'inactive_or_not_found' };
      }

      const flowJson = (flow.flowJson as any) || {};
      const nodes = flowJson.steps || flowJson.nodes || [];
      if (nodes.length === 0) return { success: true, stepsExecuted: 0 };

      // Process nodes securely with explicit tenant boundaries
      let stepCount = 0;
      for (const node of nodes) {
        stepCount++;
        if (node.type === 'action' && node.config?.actionType === 'update_field') {
          const { fieldName, fieldValue } = node.config;
          if (fieldName && record.id) {
            // Update strictly within tenantId!
            await db
              .update(leads)
              .set({ [fieldName]: fieldValue })
              .where(and(eq(leads.id, record.id), eq(leads.tenantId, tenantId)));

            await db.insert(leadEvents).values({
              leadId: record.id,
              tenantId,
              eventType: 'lead_updated',
              actorId: 'automation_engine',
              metadata: { field: fieldName, value: fieldValue, flow_id: flowId },
            });
          }
        }
      }

      return { success: true, stepsExecuted: stepCount };
    },
    {
      connection: { url: REDIS_URL },
      concurrency: 5,
    }
  );

  worker.on('failed', (job, err) => {
    console.error(`[WORKER] Job ${job?.id} failed:`, err);
  });

  return worker;
}
