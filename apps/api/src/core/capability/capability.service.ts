import { Injectable, Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';
import type { RequestScope } from '../tenant/request-scope.interface';

export interface CapabilityItem {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export type CapabilityErrorCode = 'TENANT_NOT_FOUND' | 'NOT_FOUND' | 'INVALID_CONFIG';

export interface CapabilityError {
  code: CapabilityErrorCode;
  message?: string;
}

export const AVAILABLE_CAPABILITIES = [
  {
    id: 'capability/academics',
    name: 'Enrollment',
    description: 'Enables academic courses, cohort tracking, and enrollment workflow stages.',
    industry: 'education',
  },
  {
    id: 'capability/finance',
    name: 'Finance & Collections',
    description: 'Enables fee plans, installment schedules, student fee tracking, payment recording, scholarships, and discounts.',
    industry: 'education',
  },
  {
    id: 'capability/telephony',
    name: 'Telephony',
    description: 'Enables call logging, Twilio integration, inbound/outbound call tracking, and call history.',
    industry: 'general',
  },
  {
    id: 'capability/hr',
    name: 'HR & Workforce',
    description: 'Enables employee directory, departments, leave management, attendance tracking, and payroll.',
    industry: 'general',
  },
  {
    id: 'capability/appointment',
    name: 'Appointments & Scheduling',
    description: 'Adds appointments, slots, availability schedules, and calendar view.',
    industry: 'healthcare',
  },
  {
    id: 'capability/billing',
    name: 'Invoicing & Billing',
    description: 'Adds invoice documents, line items, payments, and billing ledger.',
    industry: 'finance',
  },
  {
    id: 'capability/property-listing',
    name: 'Property Listings',
    description: 'Adds property coordinates, bedrooms, floor plans, and listing status.',
    industry: 'real-estate',
  },
  {
    id: 'capability/order-management',
    name: 'Order Management',
    description: 'Adds order creation, product line items, payment status, and order tracking.',
    industry: 'retail',
  },
  {
    id: 'capability/customer-onboarding',
    name: 'Customer Onboarding',
    description: 'Adds multi-step customer onboarding workflows, tracking setup steps and contract values.',
    industry: 'technology',
  },
  {
    id: 'capability/operations',
    name: 'Catalog, Inventory & Assets',
    description: 'Enables product catalog, inventory tracking with warehouses, stock movements, and asset management.',
    industry: 'general',
  },
  {
    id: 'capability/workspace',
    name: 'Workspace Tasks & Notes',
    description: 'Enables task management and internal note-taking across workspace entities.',
    industry: 'general',
  },
];

@Injectable()
export class CapabilityService {
  private readonly logger = new Logger(CapabilityService.name);

  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly cls: ClsService,
  ) {}

  async listCapabilities(): Promise<Result<CapabilityItem[], CapabilityError>> {
    const scope = this.cls.get<RequestScope>('scope');
    if (!scope?.tenant_id) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant context missing' });
    }

    const tenant = await this.db.getClient().tenant.findFirst({
      where: { id: scope.tenant_id },
    });

    if (!tenant) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant not found' });
    }

    const config = (tenant.config_json ?? {}) as Record<string, any>;
    const enabledCapabilities = Array.isArray(config.enabled_capabilities)
      ? (config.enabled_capabilities as string[])
      : [];

    const capabilities = AVAILABLE_CAPABILITIES.map((cap) => ({
      ...cap,
      enabled: enabledCapabilities.includes(cap.id),
    }));

    return ok(capabilities);
  }

  async toggleCapability(
    id: string,
    enabled: boolean,
  ): Promise<Result<{ id: string; enabled: boolean }, CapabilityError>> {
    const scope = this.cls.get<RequestScope>('scope');
    if (!scope?.tenant_id) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant context missing' });
    }

    const capabilityExists = AVAILABLE_CAPABILITIES.some((cap) => cap.id === id);
    if (!capabilityExists) {
      return err({ code: 'NOT_FOUND', message: `Capability ${id} not found` });
    }

    const tenant = await this.db.getClient().tenant.findFirst({
      where: { id: scope.tenant_id },
    });

    if (!tenant) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant not found' });
    }

    const config = { ...((tenant.config_json ?? {}) as Record<string, any>) };
    const enabledCapabilities = new Set<string>(
      Array.isArray(config.enabled_capabilities) ? config.enabled_capabilities : [],
    );

    if (enabled) {
      enabledCapabilities.add(id);
    } else {
      enabledCapabilities.delete(id);
    }

    config.enabled_capabilities = Array.from(enabledCapabilities);

    await this.db.getClient().tenant.update({
      where: { id: scope.tenant_id },
      data: {
        config_json: config,
      },
    });

    this.logger.log(
      `Tenant ${scope.tenant_id} capability ${id} set to ${enabled ? 'enabled' : 'disabled'}`,
    );

    return ok({ id, enabled });
  }
}
