import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';
import type { RequestScope } from '../tenant/request-scope.interface';

export type LabelErrorCode = 'TENANT_NOT_FOUND';
export interface LabelError { code: LabelErrorCode; message?: string }

export const HARDCODED_DEFAULTS: Record<string, string> = {
  'party.singular': 'Contact',
  'party.plural': 'Contacts',
  'case.singular': 'Case',
  'case.plural': 'Cases',
  'workflow.stage.enquiry': 'Enquiry',
  'workflow.stage.enrolled': 'Enrolled',
};

export const INDUSTRY_DEFAULTS: Record<string, Record<string, string>> = {
  education: {
    'party.singular': 'Student',
    'party.plural': 'Students',
    'case.singular': 'Admission',
    'case.plural': 'Admissions',
    'workflow.stage.enquiry': 'Fresh Lead',
    'workflow.stage.enrolled': 'Enrolled',
  },
  healthcare: {
    'party.singular': 'Patient',
    'party.plural': 'Patients',
    'case.singular': 'Appointment',
    'case.plural': 'Appointments',
  },
  real_estate: {
    'party.singular': 'Client',
    'party.plural': 'Clients',
    'case.singular': 'Deal',
    'case.plural': 'Deals',
  },
  retail: {
    'party.singular': 'Customer',
    'party.plural': 'Customers',
    'case.singular': 'Order',
    'case.plural': 'Orders',
  },
  technology: {
    'party.singular': 'Account',
    'party.plural': 'Accounts',
    'case.singular': 'Onboarding',
    'case.plural': 'Onboardings',
  },
  finance: {
    'party.singular': 'Client',
    'party.plural': 'Clients',
    'case.singular': 'Case',
    'case.plural': 'Cases',
  },
};

@Injectable()
export class LabelService {
  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly cls: ClsService,
  ) {}

  async resolveAll(): Promise<Result<Record<string, string>, LabelError>> {
    const scope = this.cls.get<RequestScope>('scope');
    const tenantId = scope?.tenant_id;

    const tenant = await this.db.getClient().tenant.findUnique({
      where: { id: tenantId },
    });
    const industry = (tenant?.industry as string) ?? '';

    const overrides = await this.db.getClient().labelOverride.findMany({
      where: { tenant_id: tenantId },
    });
    const overrideMap = new Map(overrides.map((o: any) => [o.label_key, o.override_value]));

    const industryDefaults = INDUSTRY_DEFAULTS[industry] ?? {};

    const allKeys = new Set([
      ...Object.keys(HARDCODED_DEFAULTS),
      ...Object.keys(industryDefaults),
      ...overrides.map((o: any) => o.label_key),
    ]);

    const result: Record<string, string> = {};
    for (const key of allKeys) {
      result[key] = overrideMap.get(key)
        ?? industryDefaults[key]
        ?? HARDCODED_DEFAULTS[key]
        ?? key;
    }
    result['_industry'] = industry;

    return ok(result);
  }

  async setOverride(key: string, value: string): Promise<Result<{ key: string; value: string }, LabelError>> {
    const scope = this.cls.get<RequestScope>('scope');
    const tenantId = scope?.tenant_id;

    await this.db.getClient().labelOverride.upsert({
      where: { tenant_id_label_key: { tenant_id: tenantId, label_key: key } },
      create: { tenant_id: tenantId, label_key: key, override_value: value },
      update: { override_value: value },
    });

    return ok({ key, value });
  }
}
