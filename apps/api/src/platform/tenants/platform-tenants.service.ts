import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { PlatformPrismaService } from '../../core/tenant/platform-prisma.service';

const BCRYPT_COST = 12;

const CAPABILITY_MAPPINGS: Record<string, string> = {
  education: 'capability/enrollment',
  healthcare: 'capability/appointment',
  finance: 'capability/billing',
  'real-estate': 'capability/property-listing',
  retail: 'capability/order-management',
  technology: 'capability/customer-onboarding',
};

interface CatalogueEntry {
  package_name: string;
  version: string;
  manifest: {
    id: string;
    name: string;
    description: string;
    compatible_industries: string[];
    hooks: string[];
    extends: string[];
    requires_plan?: string;
  };
}

const PLUGIN_CATALOGUE: CatalogueEntry[] = [
  {
    package_name: '@meta-crm/plugin-email-campaigns',
    version: '1.0.0',
    manifest: {
      id: 'email-campaigns',
      name: 'Email Campaigns',
      description: 'Send bulk email campaigns to contacts, track opens and clicks, and manage unsubscribes.',
      compatible_industries: ['*'],
      hooks: ['contact:created', 'case:closed'],
      extends: ['Contact', 'Dashboard'],
    },
  },
  {
    package_name: '@meta-crm/plugin-sms-notifications',
    version: '1.0.0',
    manifest: {
      id: 'sms-notifications',
      name: 'SMS Notifications',
      description: 'Send automated SMS alerts for case updates, appointment reminders, and custom triggers.',
      compatible_industries: ['*'],
      hooks: ['case:stage_changed', 'case:created', 'case:assigned'],
      extends: ['Case'],
    },
  },
  {
    package_name: '@meta-crm/plugin-whatsapp',
    version: '1.0.0',
    manifest: {
      id: 'whatsapp-integration',
      name: 'WhatsApp Integration',
      description: 'Two-way WhatsApp messaging from within cases. Auto-route inbound messages to open cases.',
      compatible_industries: ['*'],
      requires_plan: 'Growth',
      hooks: ['case:created', 'case:stage_changed', 'case:closed'],
      extends: ['Case', 'Contact'],
    },
  },
  {
    package_name: '@meta-crm/plugin-zapier',
    version: '1.0.0',
    manifest: {
      id: 'zapier-integration',
      name: 'Zapier Integration',
      description: 'Connect Meta CRM events to 5000+ apps via Zapier triggers and actions.',
      compatible_industries: ['*'],
      requires_plan: 'Growth',
      hooks: ['case:created', 'case:closed', 'contact:created'],
      extends: ['Settings'],
    },
  },
  {
    package_name: '@meta-crm/plugin-analytics-dashboard',
    version: '1.0.0',
    manifest: {
      id: 'analytics-dashboard',
      name: 'Advanced Analytics',
      description: 'Rich charts and KPI dashboards for cases, contacts, SLA performance, and team productivity.',
      compatible_industries: ['*'],
      requires_plan: 'Growth',
      hooks: [],
      extends: ['Dashboard'],
    },
  },
  {
    package_name: '@meta-crm/plugin-knowledge-base',
    version: '1.0.0',
    manifest: {
      id: 'knowledge-base',
      name: 'Knowledge Base',
      description: 'Internal wiki for agents — articles, FAQs, and resolution playbooks linked to case categories.',
      compatible_industries: ['*'],
      hooks: ['case:created'],
      extends: ['Case', 'Dashboard'],
    },
  },
  {
    package_name: '@meta-crm/plugin-appointment-scheduler',
    version: '1.0.0',
    manifest: {
      id: 'appointment-scheduler',
      name: 'Appointment Scheduler',
      description: 'Calendar-based appointment booking for patients. Sends reminders 24h before via SMS or WhatsApp.',
      compatible_industries: ['healthcare'],
      hooks: ['case:created', 'case:stage_changed'],
      extends: ['Case', 'Contact', 'Dashboard'],
    },
  },
  {
    package_name: '@meta-crm/plugin-prescription-tracker',
    version: '1.0.0',
    manifest: {
      id: 'prescription-tracker',
      name: 'Prescription Tracker',
      description: 'Track medication prescriptions linked to patient cases with refill reminders.',
      compatible_industries: ['healthcare'],
      requires_plan: 'Growth',
      hooks: ['case:closed'],
      extends: ['Case'],
    },
  },
  {
    package_name: '@meta-crm/plugin-product-catalog',
    version: '1.0.0',
    manifest: {
      id: 'product-catalog',
      name: 'Product Catalog',
      description: 'Link SKUs and products to cases. Agents can browse and attach products to support tickets.',
      compatible_industries: ['retail'],
      hooks: ['case:created'],
      extends: ['Case'],
    },
  },
  {
    package_name: '@meta-crm/plugin-returns-management',
    version: '1.0.0',
    manifest: {
      id: 'returns-management',
      name: 'Returns Management',
      description: 'Structured return and refund workflow with approval stages and auto-notifications to customers.',
      compatible_industries: ['retail'],
      requires_plan: 'Growth',
      hooks: ['case:stage_changed', 'case:closed'],
      extends: ['Case'],
    },
  },
  {
    package_name: '@meta-crm/plugin-invoice-generator',
    version: '1.0.0',
    manifest: {
      id: 'invoice-generator',
      name: 'Invoice Generator',
      description: 'Generate and send PDF invoices from cases. Track payment status and send reminders.',
      compatible_industries: ['finance'],
      requires_plan: 'Growth',
      hooks: ['case:closed'],
      extends: ['Case', 'Contact'],
    },
  },
  {
    package_name: '@meta-crm/plugin-compliance-audit',
    version: '1.0.0',
    manifest: {
      id: 'compliance-audit',
      name: 'Compliance Audit Log',
      description: 'Immutable audit trail for all case actions — required for financial regulatory compliance.',
      compatible_industries: ['finance'],
      requires_plan: 'Enterprise',
      hooks: ['case:created', 'case:stage_changed', 'case:closed', 'case:assigned'],
      extends: ['Case', 'Settings'],
    },
  },
  {
    package_name: '@meta-crm/plugin-property-listings',
    version: '1.0.0',
    manifest: {
      id: 'property-listings',
      name: 'Property Listings',
      description: 'Attach property listings to contacts and cases. Track viewing history and offers.',
      compatible_industries: ['real-estate', 'real_estate'],
      hooks: ['case:created', 'contact:created'],
      extends: ['Case', 'Contact'],
    },
  },
  {
    package_name: '@meta-crm/plugin-document-signing',
    version: '1.0.0',
    manifest: {
      id: 'document-signing',
      name: 'Document E-Signing',
      description: 'Send lease agreements and contracts for e-signature directly from cases.',
      compatible_industries: ['real-estate', 'real_estate'],
      requires_plan: 'Growth',
      hooks: ['case:stage_changed'],
      extends: ['Case'],
    },
  },
  {
    package_name: '@meta-crm/plugin-enrollment-manager',
    version: '1.0.0',
    manifest: {
      id: 'enrollment-manager',
      name: 'Enrollment Manager',
      description: 'Track student enrollment inquiries, applications, and acceptance workflows as cases.',
      compatible_industries: ['education'],
      hooks: ['case:created', 'case:stage_changed', 'case:closed'],
      extends: ['Case', 'Contact', 'Dashboard'],
    },
  },
  {
    package_name: '@meta-crm/plugin-course-catalog',
    version: '1.0.0',
    manifest: {
      id: 'course-catalog',
      name: 'Course Catalog',
      description: 'Link courses and programmes to cases and contacts. Track interest and conversion.',
      compatible_industries: ['education'],
      hooks: ['contact:created'],
      extends: ['Case', 'Contact'],
    },
  },
  {
    package_name: '@meta-crm/plugin-reservation-manager',
    version: '1.0.0',
    manifest: {
      id: 'reservation-manager',
      name: 'Reservation Manager',
      description: 'Manage hotel or venue reservations linked to guest profiles. Handle modifications and cancellations.',
      compatible_industries: ['hospitality'],
      hooks: ['case:created', 'case:stage_changed', 'case:closed'],
      extends: ['Case', 'Contact'],
    },
  },
  {
    package_name: '@meta-crm/plugin-guest-feedback',
    version: '1.0.0',
    manifest: {
      id: 'guest-feedback',
      name: 'Guest Feedback & Reviews',
      description: 'Collect post-stay reviews, track NPS scores, and auto-escalate negative feedback as cases.',
      compatible_industries: ['hospitality'],
      hooks: ['case:closed'],
      extends: ['Case', 'Dashboard'],
    },
  },
];

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export type PlatformTenantErrorCode =
  | 'TENANT_NOT_FOUND'
  | 'SLUG_TAKEN'
  | 'PLAN_NOT_FOUND'
  | 'INDUSTRY_NOT_FOUND'
  | 'TRANSACTION_FAILED';

export interface PlatformTenantError {
  code: PlatformTenantErrorCode;
  message: string;
}

export interface CreateTenantInput {
  name: string;
  slug: string;
  industry: string;
  plan_id: string;
  owner: { name: string; email: string };
}

export interface CreateTenantResponse {
  tenant: { id: string; name: string; slug: string; industry: string };
  owner: { email: string; temporary_password: string };
}

export interface TenantListItem {
  id: string;
  name: string;
  slug: string;
  industry: string;
  status: string;
  created_at: Date;
  branch_count: number;
  user_count: number;
  case_count: number;
}

export interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  industry: string;
  status: string;
  created_at: Date;
  branch_count: number;
  user_count: number;
  plugin_list: string[];
  plugin_ids: string[];
  enabled_capabilities: string[];
}

@Injectable()
export class PlatformTenantsService {
  constructor(private readonly db: PlatformPrismaService) {}

  async list(params: {
    cursor?: string;
    limit?: number;
  }): Promise<Result<{ data: TenantListItem[]; next_cursor: string | undefined }, PlatformTenantError>> {
    const limit = Math.min(params.limit ?? 20, 100);
    const tenants = await this.db.client.tenant.findMany({
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      orderBy: { created_at: 'desc' },
    });

    const hasMore = tenants.length > limit;
    const page = hasMore ? tenants.slice(0, limit) : tenants;

    const data: TenantListItem[] = await Promise.all(
      page.map(async (t: any) => {
        const [branchCount, userCount, caseCount] = await Promise.all([
          this.db.client.branch.count({ where: { tenant_id: t.id } }),
          this.db.client.user.count({ where: { tenant_id: t.id } }),
          this.db.client.case.count({ where: { tenant_id: t.id } }),
        ]);
        return {
          id: t.id,
          name: t.name,
          slug: t.slug,
          industry: t.industry,
          status: t.status,
          created_at: t.created_at,
          branch_count: branchCount,
          user_count: userCount,
          case_count: caseCount,
        };
      }),
    );

    return ok({
      data,
      next_cursor: hasMore ? data[data.length - 1]?.id : undefined,
    });
  }

  async findOne(id: string): Promise<Result<TenantDetail, PlatformTenantError>> {
    const tenant = await this.db.client.tenant.findUnique({ where: { id } });
    if (!tenant) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant not found' });
    }

    const [branchCount, userCount, plugins] = await Promise.all([
      this.db.client.branch.count({ where: { tenant_id: id } }),
      this.db.client.user.count({ where: { tenant_id: id } }),
      this.db.client.tenantPlugin.findMany({
        where: { tenant_id: id },
        include: { pluginRegistry: { select: { id: true, package_name: true } } },
      }),
    ]);

    const config = (tenant.config_json ?? {}) as Record<string, any>;
    const enabled_capabilities = Array.isArray(config.enabled_capabilities)
      ? (config.enabled_capabilities as string[])
      : [];

    return ok({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      industry: tenant.industry,
      status: tenant.status,
      created_at: tenant.created_at,
      branch_count: branchCount,
      user_count: userCount,
      plugin_list: plugins.map((p: any) => p.pluginRegistry.package_name),
      plugin_ids: plugins.map((p: any) => p.pluginRegistry.id),
      enabled_capabilities,
    });
  }

  async updateEntitlements(
    id: string,
    pluginIds: string[],
  ): Promise<Result<TenantDetail, PlatformTenantError>> {
    const tenant = await this.db.client.tenant.findUnique({ where: { id } });
    if (!tenant) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant not found' });
    }

    try {
      await this.db.client.$transaction(async (tx: any) => {
        const existing = await tx.tenantPlugin.findMany({
          where: { tenant_id: id },
        });

        const existingRegIds = existing.map((p: any) => p.plugin_registry_id);

        const toDeleteRegIds = existingRegIds.filter((regId: string) => !pluginIds.includes(regId));
        const toCreateRegIds = pluginIds.filter((regId: string) => !existingRegIds.includes(regId));

        if (toDeleteRegIds.length > 0) {
          await tx.tenantPlugin.deleteMany({
            where: {
              tenant_id: id,
              plugin_registry_id: { in: toDeleteRegIds },
            },
          });
        }

        if (toCreateRegIds.length > 0) {
          await tx.tenantPlugin.createMany({
            data: toCreateRegIds.map((regId: string) => ({
              tenant_id: id,
              plugin_registry_id: regId,
              enabled: true,
            })),
          });
        }
      });

      return this.findOne(id);
    } catch (e: any) {
      return err({
        code: 'TRANSACTION_FAILED',
        message: e?.message ?? 'Transaction failed to update entitlements',
      });
    }
  }

  async updateCapabilities(
    id: string,
    capabilities: string[],
  ): Promise<Result<TenantDetail, PlatformTenantError>> {
    const tenant = await this.db.client.tenant.findUnique({ where: { id } });
    if (!tenant) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant not found' });
    }

    try {
      const config = { ...((tenant.config_json ?? {}) as Record<string, any>) };
      config.enabled_capabilities = capabilities;

      await this.db.client.tenant.update({
        where: { id },
        data: {
          config_json: config,
        },
      });

      return this.findOne(id);
    } catch (e: any) {
      return err({
        code: 'TRANSACTION_FAILED',
        message: e?.message ?? 'Transaction failed to update capabilities',
      });
    }
  }

  async resetOwnerPassword(
    id: string,
  ): Promise<Result<{ email: string; temporary_password: string }, PlatformTenantError>> {
    const tenant = await this.db.client.tenant.findUnique({ where: { id } });
    if (!tenant) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant not found' });
    }

    const owner = await this.db.client.user.findFirst({
      where: { tenant_id: id },
      orderBy: { created_at: 'asc' },
    });

    if (!owner) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant owner user not found' });
    }

    const temporaryPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_COST);

    try {
      await this.db.client.user.update({
        where: { id: owner.id },
        data: { password_hash: passwordHash },
      });

      return ok({
        email: owner.email,
        temporary_password: temporaryPassword,
      });
    } catch (e: any) {
      return err({
        code: 'TRANSACTION_FAILED',
        message: e?.message ?? 'Failed to reset owner password',
      });
    }
  }

  async create(input: CreateTenantInput): Promise<Result<CreateTenantResponse, PlatformTenantError>> {
    const existing = await this.db.client.tenant.findUnique({ where: { slug: input.slug } });
    if (existing) {
      return err({ code: 'SLUG_TAKEN', message: `Slug "${input.slug}" is already taken` });
    }

    const plan = await this.db.client.subscriptionPlan.findUnique({ where: { id: input.plan_id } });
    if (!plan) {
      return err({ code: 'PLAN_NOT_FOUND', message: 'Subscription plan not found' });
    }

    const temporaryPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_COST);

    try {
      const defaultCap = CAPABILITY_MAPPINGS[input.industry.toLowerCase()];
      const tenant = await this.db.client.$transaction(async (tx: any) => {
        const t = await tx.tenant.create({
          data: {
            name: input.name,
            slug: input.slug,
            industry: input.industry,
            config_json: defaultCap ? { enabled_capabilities: [defaultCap] } : {},
          },
        });

        await tx.user.create({
          data: {
            tenant_id: t.id,
            name: input.owner.name,
            email: input.owner.email,
            password_hash: passwordHash,
          },
        });

        await tx.tenantPlan.create({
          data: {
            tenant_id: t.id,
            plan_id: input.plan_id,
          },
        });

        return t;
      });

      // Post-transaction Onboarding Automation:
      // 1. Industry Database Template Execution
      const templateResult = await this.applyTemplate(tenant.id, input.industry);
      if (templateResult.isErr()) {
        // Rollback / clean up all records related to this tenant to keep database consistent
        await this.db.client.labelOverride.deleteMany({ where: { tenant_id: tenant.id } }).catch(() => {});
        await this.db.client.workflowTransition.deleteMany({ where: { workflowDefinition: { tenant_id: tenant.id } } }).catch(() => {});
        await this.db.client.workflowStage.deleteMany({ where: { workflowDefinition: { tenant_id: tenant.id } } }).catch(() => {});
        await this.db.client.workflowDefinition.deleteMany({ where: { tenant_id: tenant.id } }).catch(() => {});
        await this.db.client.fieldDefinition.deleteMany({ where: { tenant_id: tenant.id } }).catch(() => {});
        await this.db.client.tenantPlugin.deleteMany({ where: { tenant_id: tenant.id } }).catch(() => {});
        await this.db.client.tenantPlan.deleteMany({ where: { tenant_id: tenant.id } }).catch(() => {});
        await this.db.client.user.deleteMany({ where: { tenant_id: tenant.id } }).catch(() => {});
        await this.db.client.tenant.delete({ where: { id: tenant.id } }).catch(() => {});

        return err({
          code: 'TRANSACTION_FAILED',
          message: `Failed to apply industry template: ${templateResult.error.message}`,
        });
      }

      // 2. Dynamic Seeding of Registry Catalog & Auto-Licensing of compatible/universal plugins
      for (const entry of PLUGIN_CATALOGUE) {
        let registryEntry = await this.db.client.pluginRegistry.findFirst({
          where: { package_name: entry.package_name },
        });

        if (!registryEntry) {
          registryEntry = await this.db.client.pluginRegistry.create({
            data: {
              package_name: entry.package_name,
              version: entry.version,
              manifest: entry.manifest as any,
              status: 'active',
            },
          });
        }

        const isCompatible = entry.manifest.compatible_industries.includes('*') ||
          entry.manifest.compatible_industries.some(
            (ind: string) => ind.toLowerCase() === input.industry.toLowerCase() ||
              ind.toLowerCase().replace('_', '-') === input.industry.toLowerCase()
          );

        if (isCompatible) {
          // Entitle license to the newly created tenant
          await this.db.client.tenantPlugin.create({
            data: {
              tenant_id: tenant.id,
              plugin_registry_id: registryEntry.id,
              enabled: true,
            },
          });
        }
      }

      return ok({
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          industry: tenant.industry,
        },
        owner: {
          email: input.owner.email,
          temporary_password: temporaryPassword,
        },
      });
    } catch (e: any) {
      return err({
        code: 'TRANSACTION_FAILED',
        message: e?.message ?? 'Transaction failed',
      });
    }
  }

  async suspend(id: string): Promise<Result<void, PlatformTenantError>> {
    const tenant = await this.db.client.tenant.findUnique({ where: { id } });
    if (!tenant) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant not found' });
    }

    await this.db.client.tenant.update({
      where: { id },
      data: { status: 'suspended' },
    });

    return ok(undefined);
  }

  async reactivate(id: string): Promise<Result<void, PlatformTenantError>> {
    const tenant = await this.db.client.tenant.findUnique({ where: { id } });
    if (!tenant) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant not found' });
    }

    await this.db.client.tenant.update({
      where: { id },
      data: { status: 'active' },
    });

    return ok(undefined);
  }

  async applyTemplate(
    id: string,
    industry: string,
  ): Promise<Result<void, PlatformTenantError>> {
    const tenant = await this.db.client.tenant.findUnique({ where: { id } });
    if (!tenant) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant not found' });
    }

    try {
      const { existsSync, readFileSync } = await import('fs');
      const { join } = await import('path');
      const filePath = join(__dirname, '..', '..', 'core', 'metadata', 'templates', `${industry}.template.json`);

      if (!existsSync(filePath)) {
        return err({ code: 'INDUSTRY_NOT_FOUND', message: `No template for industry: ${industry}` });
      }

      const raw = readFileSync(filePath, 'utf-8');
      const template: any = JSON.parse(raw);

      for (const [entityType, fields] of Object.entries< any[]>(template.field_definitions ?? {})) {
        for (const fieldDef of fields) {
          const existing = await this.db.client.fieldDefinition.findFirst({
            where: { tenant_id: id, name: fieldDef.name },
          });
          if (existing) continue;

          await this.db.client.fieldDefinition.create({
            data: {
              tenant_id: id,
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
      if (wfDef) {
        let wfId: string;
        const existingWf = await this.db.client.workflowDefinition.findFirst({
          where: { tenant_id: id, name: wfDef.name },
        });

        if (existingWf) {
          wfId = existingWf.id;
        } else {
          const created = await this.db.client.workflowDefinition.create({
            data: {
              tenant_id: id,
              name: wfDef.name,
              entity_type: wfDef.entity_type,
            },
          });
          wfId = created.id;
        }

        const stageNameToId = new Map<string, string>();

        for (const stageDef of wfDef.stages ?? []) {
          const existingStage = await this.db.client.workflowStage.findFirst({
            where: { workflow_definition_id: wfId, name: stageDef.name },
          });

          if (existingStage) {
            stageNameToId.set(stageDef.name, existingStage.id);
            continue;
          }

          const created = await this.db.client.workflowStage.create({
            data: {
              workflow_definition_id: wfId,
              name: stageDef.name,
              order: stageDef.order,
              entry_criteria: stageDef.entry_criteria ?? [],
              sla_hours: stageDef.sla_hours ?? null,
            },
          });
          stageNameToId.set(stageDef.name, created.id);
        }

        for (const transDef of wfDef.transitions ?? []) {
          const fromId = stageNameToId.get(transDef.from_stage);
          const toId = stageNameToId.get(transDef.to_stage);
          if (!fromId || !toId) continue;

          const existingTrans = await this.db.client.workflowTransition.findFirst({
            where: { from_stage_id: fromId, to_stage_id: toId },
          });
          if (existingTrans) continue;

          await this.db.client.workflowTransition.create({
            data: {
              workflow_definition_id: wfId,
              from_stage_id: fromId,
              to_stage_id: toId,
            },
          });
        }
      }

      for (const [key, value] of Object.entries< string>(template.label_overrides ?? {})) {
        await this.db.client.labelOverride.upsert({
          where: { tenant_id_label_key: { tenant_id: id, label_key: key } },
          create: { tenant_id: id, label_key: key, override_value: value },
          update: { override_value: value },
        });
      }

      return ok(undefined);
    } catch (e: any) {
      return err({
        code: 'TRANSACTION_FAILED',
        message: e?.message ?? 'Template application failed',
      });
    }
  }
}
