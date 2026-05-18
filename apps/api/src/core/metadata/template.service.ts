import { Injectable } from '@nestjs/common';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';

export type TemplateErrorCode = 'TEMPLATE_NOT_FOUND' | 'TRANSACTION_FAILED';

export interface TemplateError {
  code: TemplateErrorCode;
  message?: string;
}

interface StageDef {
  name: string;
  order: number;
  entry_criteria: unknown[];
  sla_hours: number | null;
}

interface TransitionDef {
  from_stage: string;
  to_stage: string;
}

interface IndustryTemplate {
  name: string;
  entity_type: string;
  field_definitions: Record<string, any[]>;
  workflow_definition: {
    name: string;
    entity_type: string;
    stages: StageDef[];
    transitions: TransitionDef[];
  };
  label_overrides: Record<string, string>;
}

@Injectable()
export class TemplateService {
  constructor(private readonly db: TenantScopedPrismaService) {}

  async applyIndustryTemplate(
    industry: string,
    tenantId: string,
  ): Promise<Result<void, TemplateError>> {
    const filePath = join(__dirname, 'templates', `${industry}.template.json`);
    if (!existsSync(filePath)) {
      return err({ code: 'TEMPLATE_NOT_FOUND', message: `No template for industry: ${industry}` });
    }

    const raw = readFileSync(filePath, 'utf-8');
    const template: IndustryTemplate = JSON.parse(raw);

    try {
      await this.db.getClient().$transaction(async (tx) => {
        for (const [entityType, fields] of Object.entries(template.field_definitions)) {
          for (const fieldDef of fields) {
            const existing = await tx.fieldDefinition.findFirst({
              where: { tenant_id: tenantId, name: fieldDef.name },
            });
            if (existing) continue;

            await tx.fieldDefinition.create({
              data: {
                tenant_id: tenantId,
                entity_type: entityType,
                name: fieldDef.name,
                label: fieldDef.label,
                field_type: fieldDef.field_type,
                options: fieldDef.options ? JSON.parse(JSON.stringify(fieldDef.options)) : null,
                required: fieldDef.required ?? false,
                order: fieldDef.order ?? 0,
              },
            });
          }
        }

        const wfDef = template.workflow_definition;
        const existingWf = await tx.workflowDefinition.findFirst({
          where: { tenant_id: tenantId, name: wfDef.name },
        });

        let workflowDefinitionId: string;
        if (existingWf) {
          workflowDefinitionId = existingWf.id;
        } else {
          const created = await tx.workflowDefinition.create({
            data: {
              tenant_id: tenantId,
              name: wfDef.name,
              entity_type: wfDef.entity_type,
            },
          });
          workflowDefinitionId = created.id;
        }

        const stageNameToId = new Map<string, string>();

        for (const stageDef of wfDef.stages) {
          const existingStage = await tx.workflowStage.findFirst({
            where: {
              workflow_definition_id: workflowDefinitionId,
              name: stageDef.name,
            },
          });

          if (existingStage) {
            stageNameToId.set(stageDef.name, existingStage.id);
            continue;
          }

          const created = await tx.workflowStage.create({
            data: {
              workflow_definition_id: workflowDefinitionId,
              name: stageDef.name,
              order: stageDef.order,
              entry_criteria: stageDef.entry_criteria as any,
              sla_hours: stageDef.sla_hours,
            },
          });
          stageNameToId.set(stageDef.name, created.id);
        }

        for (const transDef of wfDef.transitions) {
          const fromId = stageNameToId.get(transDef.from_stage);
          const toId = stageNameToId.get(transDef.to_stage);
          if (!fromId || !toId) continue;

          const existingTrans = await tx.workflowTransition.findFirst({
            where: {
              from_stage_id: fromId,
              to_stage_id: toId,
            },
          });
          if (existingTrans) continue;

          await tx.workflowTransition.create({
            data: {
              from_stage_id: fromId,
              to_stage_id: toId,
            },
          });
        }

        for (const [key, value] of Object.entries(template.label_overrides ?? {})) {
          await tx.labelOverride.upsert({
            where: { tenant_id_label_key: { tenant_id: tenantId, label_key: key } },
            create: { tenant_id: tenantId, label_key: key, override_value: value },
            update: { override_value: value },
          });
        }
      });
    } catch (e: any) {
      return err({
        code: 'TRANSACTION_FAILED',
        message: e?.message ?? 'Transaction failed',
      });
    }

    return ok(undefined);
  }
}
