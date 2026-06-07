import { Injectable } from '@nestjs/common';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';
import { TenantRole } from '@meta-crm/types';

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
  pipeline_definition: {
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
        // Update tenant's industry
        await tx.tenant.update({
          where: { id: tenantId },
          data: { industry },
        });

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

        const wfDef = template.pipeline_definition;
        const existingWf = await tx.pipelineDefinition.findFirst({
          where: { tenant_id: tenantId, name: wfDef.name },
        });

        let pipelineDefinitionId: string;
        if (existingWf) {
          pipelineDefinitionId = existingWf.id;
        } else {
          const created = await tx.pipelineDefinition.create({
            data: {
              tenant_id: tenantId,
              name: wfDef.name,
              entity_type: wfDef.entity_type,
            },
          });
          pipelineDefinitionId = created.id;
        }

        const stageNameToId = new Map<string, string>();

        for (const stageDef of wfDef.stages) {
          const existingStage = await tx.pipelineStage.findFirst({
            where: {
              pipeline_definition_id: pipelineDefinitionId,
              name: stageDef.name,
            },
          });

          if (existingStage) {
            stageNameToId.set(stageDef.name, existingStage.id);
            continue;
          }

          const created = await tx.pipelineStage.create({
            data: {
              pipeline_definition_id: pipelineDefinitionId,
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

          const existingTrans = await tx.pipelineTransition.findFirst({
            where: {
              from_stage_id: fromId,
              to_stage_id: toId,
            },
          });
          if (existingTrans) continue;

          await tx.pipelineTransition.create({
            data: {
              pipeline_definition_id: pipelineDefinitionId,
              from_stage_id: fromId,
              to_stage_id: toId,
            } as any,
          });
        }

        for (const [key, value] of Object.entries(template.label_overrides ?? {})) {
          await tx.labelOverride.upsert({
            where: { tenant_id_label_key: { tenant_id: tenantId, label_key: key } },
            create: { tenant_id: tenantId, label_key: key, override_value: value },
            update: { override_value: value },
          });
        }

        // Provision the 5 universal system roles
        const industryKey = industry.toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-');
        let memberName = 'Member';
        let managerName = 'Manager';
        let adminName = 'Administrator';

        if (industryKey === 'education') {
          memberName = 'Counsellor';
          managerName = 'Branch Head';
          adminName = 'Academic Director';
        } else if (industryKey === 'healthcare') {
          memberName = 'Coordinator';
          managerName = 'Department Head';
          adminName = 'Hospital Administrator';
        } else if (industryKey === 'real-estate' || industryKey === 'realestate') {
          memberName = 'Agent';
          managerName = 'Team Lead';
          adminName = 'Operations Head';
        } else if (industryKey === 'it-services' || industryKey === 'it_services' || industryKey === 'technology' || industryKey === 'tech') {
          memberName = 'Consultant';
          managerName = 'Practice Lead';
          adminName = 'Operations Head';
        }

        const roleDefinitions = [
          { slug: 'owner', name: 'owner', display_name: 'Owner', description: 'Tenant Owner - full capabilities and billing manage' },
          { slug: 'admin', name: 'admin', display_name: adminName, description: 'Tenant Administrator - manage all metadata and operations' },
          { slug: 'manager', name: 'manager', display_name: managerName, description: 'Tenant Manager - manage records and cases' },
          { slug: 'member', name: 'member', display_name: memberName, description: 'Tenant Member - basic record view and creation' },
          { slug: 'viewer', name: 'viewer', display_name: 'Viewer', description: 'Read-only access across contacts and cases' },
        ];

        for (const roleDef of roleDefinitions) {
          const role = await tx.role.upsert({
            where: {
              tenant_id_name: {
                tenant_id: tenantId,
                name: roleDef.name,
              },
            },
            update: {
              display_name: roleDef.display_name,
              description: roleDef.description,
              slug: roleDef.slug,
            },
            create: {
              tenant_id: tenantId,
              name: roleDef.name,
              slug: roleDef.slug,
              display_name: roleDef.display_name,
              description: roleDef.description,
              is_system_role: true,
            },
          });

          const { SYSTEM_ROLE_MAP } = await import('@meta-crm/permissions');
          const defaultPerms = SYSTEM_ROLE_MAP[roleDef.slug as TenantRole] ?? [];

          await tx.rolePermission.deleteMany({
            where: { role_id: role.id },
          });

          for (const perm of defaultPerms) {
            await tx.rolePermission.create({
              data: {
                role_id: role.id,
                resource: perm.resource,
                action: perm.action,
                conditions: perm.conditions ? JSON.parse(JSON.stringify(perm.conditions)) : null,
              },
            });
          }
        }

        // Automatically assign the first tenant user to the 'owner' role
        const firstUser = await tx.user.findFirst({
          where: { tenant_id: tenantId },
          orderBy: { created_at: 'asc' },
        });

        if (firstUser) {
          const ownerRole = await tx.role.findFirst({
            where: { tenant_id: tenantId, slug: 'owner' },
          });
          if (ownerRole) {
            const existingUserRole = await tx.userRole.findFirst({
              where: {
                user_id: firstUser.id,
                role_id: ownerRole.id,
                assignment_id: null,
              },
            });
            if (!existingUserRole) {
              await tx.userRole.create({
                data: {
                  user_id: firstUser.id,
                  role_id: ownerRole.id,
                  tenant_id: tenantId,
                  assignment_id: null,
                },
              });
            }
          }
        }
      }, {
        maxWait: 30000,
        timeout: 90000,
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
