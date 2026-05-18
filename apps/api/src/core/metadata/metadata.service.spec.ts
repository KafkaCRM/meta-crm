import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClsService } from 'nestjs-cls';
import { evaluateVisibilityRules } from '@meta-crm/types';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';
import { FieldDefinitionService } from './field-definition.service';
import { LabelService, HARDCODED_DEFAULTS, INDUSTRY_DEFAULTS } from './label.service';
import { TemplateService } from './template.service';

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */
function mockDb() {
  const client = {
    $transaction: vi.fn(),
    fieldDefinition: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), findFirst: vi.fn() },
    labelOverride: { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
    tenant: { findUnique: vi.fn() },
    workflowDefinition: { findFirst: vi.fn(), create: vi.fn() },
    workflowStage: { findFirst: vi.fn(), create: vi.fn() },
    workflowTransition: { findFirst: vi.fn(), create: vi.fn() },
  };
  return { getClient: vi.fn().mockReturnValue(client), client } as unknown as TenantScopedPrismaService & { client: any };
}

const tenantId = 'tenant-a';

/* ------------------------------------------------------------------ */
/*  FieldDefinitionService                                              */
/* ------------------------------------------------------------------ */
describe('FieldDefinitionService', () => {
  it('findByEntity returns fields filtered by entity_type', async () => {
    const { svc, client }: any = buildField();
    (client.fieldDefinition.findMany as any).mockResolvedValue([
      { id: '1', entity_type: 'Party', name: 'city', label: 'City', field_type: 'text' },
    ]);
    const result = await svc.findByEntity('Party');
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toHaveLength(1);
      expect(client.fieldDefinition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { entity_type: 'Party' } }),
      );
    }
  });

  it('create returns the created field', async () => {
    const { svc, client }: any = buildField();
    (client.fieldDefinition.create as any).mockResolvedValue({
      id: 'new-1', entity_type: 'Case', name: 'fee_amount', label: 'Fee Amount', field_type: 'number',
    });
    const result = await svc.create({ entity_type: 'Case', name: 'fee_amount', label: 'Fee Amount', field_type: 'number' });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value.name).toBe('fee_amount');
  });

  it('update returns NOT_FOUND for missing field', async () => {
    const { svc, client }: any = buildField();
    (client.fieldDefinition.findUnique as any).mockResolvedValue(null);
    const result = await svc.update('nonexistent', { label: 'New' });
    expect(result.error.code).toBe('NOT_FOUND');
  });

  it('remove deletes and returns void', async () => {
    const { svc, client }: any = buildField();
    (client.fieldDefinition.findUnique as any).mockResolvedValue({ id: 'f-1' });
    (client.fieldDefinition.delete as any).mockResolvedValue({ id: 'f-1' });
    const result = await svc.remove('f-1');
    expect(result.isOk()).toBe(true);
  });

  function buildField() {
    const db = mockDb();
    const svc = new FieldDefinitionService(db);
    return { db, svc, client: db.client };
  }
});

/* ------------------------------------------------------------------ */
/*  Label Resolution                                                    */
/* ------------------------------------------------------------------ */
describe('LabelService', () => {
  it('tenant override beats industry default beats hardcoded default', async () => {
    const { svc, client, cls }: any = buildLabel();
    (client.tenant.findUnique as any).mockResolvedValue({ id: tenantId, industry: 'education' });
    (client.labelOverride.findMany as any).mockResolvedValue([
      { label_key: 'party.singular', override_value: 'Custom Student' },
    ]);

    const result = await svc.resolveAll();
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value['party.singular']).toBe('Custom Student');
      expect(result.value['case.singular']).toBe('Admission');
      expect(result.value['case.plural']).toBe('Admissions');
    }
  });

  it('falls back to hardcoded default when no industry preset', async () => {
    const { svc, client }: any = buildLabel();
    (client.tenant.findUnique as any).mockResolvedValue({ id: tenantId, industry: '' });
    (client.labelOverride.findMany as any).mockResolvedValue([]);

    const result = await svc.resolveAll();
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value['party.singular']).toBe('Contact');
      expect(result.value['case.singular']).toBe('Case');
    }
  });

  it('resolveAll returns union of all keys', async () => {
    const { svc, client }: any = buildLabel();
    (client.tenant.findUnique as any).mockResolvedValue({ id: tenantId, industry: 'education' });
    (client.labelOverride.findMany as any).mockResolvedValue([]);

    const result = await svc.resolveAll();
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toHaveProperty('party.singular');
      expect(result.value).toHaveProperty('party.plural');
      expect(result.value).toHaveProperty('case.singular');
      expect(result.value).toHaveProperty('case.plural');
      expect(result.value).toHaveProperty('workflow.stage.enquiry');
      expect(result.value).toHaveProperty('workflow.stage.enrolled');
    }
  });

  it('setOverride upserts the label', async () => {
    const { svc, client }: any = buildLabel();
    (client.labelOverride.upsert as any).mockResolvedValue({ label_key: 'case.singular', override_value: 'Ticket' });

    const result = await svc.setOverride('case.singular', 'Ticket');
    expect(result.isOk()).toBe(true);
    expect(client.labelOverride.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ label_key: 'case.singular', override_value: 'Ticket' }),
      }),
    );
  });

  function buildLabel() {
    const db = mockDb();
    const cls = { get: vi.fn().mockReturnValue({ user_id: 'user-1', tenant_id: tenantId }) } as unknown as ClsService;
    const svc = new LabelService(db, cls);
    return { db, svc, client: db.client, cls };
  }
});

/* ------------------------------------------------------------------ */
/*  Template Service (applyIndustryTemplate)                            */
/* ------------------------------------------------------------------ */
describe('TemplateService', () => {
  it('applies education template — creates field_definitions, workflow, labels in one transaction', async () => {
    const { svc, client }: any = buildTemplate();

    // All checks return "not found" → creates everything
    (client.fieldDefinition.findFirst as any).mockResolvedValue(null);
    (client.workflowDefinition.findFirst as any).mockResolvedValue(null);
    (client.workflowStage.findFirst as any).mockResolvedValue(null);
    (client.workflowTransition.findFirst as any).mockResolvedValue(null);

    (client.workflowDefinition.create as any).mockResolvedValue({ id: 'wf-1' });
    (client.workflowStage.create as any).mockImplementation(({ data }: any) =>
      Promise.resolve({ id: `stage-${data.name}`, ...data }));

    // Spoof interactive $transaction
    (client.$transaction as any).mockImplementation(async (cb: any) => {
      await cb(client);
    });

    const result = await svc.applyIndustryTemplate('education', tenantId);
    expect(result.isOk()).toBe(true);

    // Verify field definitions were created for both Party and Case
    const partyFields = (client.fieldDefinition.create as any).mock.calls.filter(
      (c: any) => c[0].data.entity_type === 'Party',
    );
    expect(partyFields.length).toBe(5);

    const caseFields = (client.fieldDefinition.create as any).mock.calls.filter(
      (c: any) => c[0].data.entity_type === 'Case',
    );
    expect(caseFields.length).toBe(4);

    // Verify workflow created
    expect(client.workflowDefinition.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'Admissions Pipeline' }) }),
    );

    // Verify 7 stages created
    expect(client.workflowStage.create).toHaveBeenCalledTimes(7);

    // Verify label overrides upserted
    expect(client.labelOverride.upsert).toHaveBeenCalledTimes(4);
  });

  it('is idempotent — running twice does not duplicate records', async () => {
    const { svc, client }: any = buildTemplate();

    // First call: nothing exists
    (client.fieldDefinition.findFirst as any).mockResolvedValue(null);
    (client.workflowDefinition.findFirst as any).mockResolvedValue(null);
    (client.workflowStage.findFirst as any).mockResolvedValue(null);
    (client.workflowTransition.findFirst as any).mockResolvedValue(null);
    (client.workflowDefinition.create as any).mockResolvedValue({ id: 'wf-1' });
    (client.workflowStage.create as any).mockImplementation(({ data }: any) =>
      Promise.resolve({ id: `stage-${data.name}`, ...data }));
    (client.$transaction as any).mockImplementation(async (cb: any) => { await cb(client); });

    await svc.applyIndustryTemplate('education', tenantId);

    const firstCreateCount = (client.fieldDefinition.create as any).mock.calls.length;
    expect(firstCreateCount).toBe(9); // 5 Party + 4 Case

    // Second call: everything exists
    (client.fieldDefinition.findFirst as any).mockResolvedValue({ id: 'existing' });
    (client.workflowDefinition.findFirst as any).mockResolvedValue({ id: 'wf-1' });
    (client.workflowStage.findFirst as any).mockResolvedValue({ id: 'existing-stage' });
    (client.workflowTransition.findFirst as any).mockResolvedValue({ id: 'existing-trans' });

    await svc.applyIndustryTemplate('education', tenantId);

    const secondCreateCount = (client.fieldDefinition.create as any).mock.calls.length - firstCreateCount;
    expect(secondCreateCount).toBe(0);
  });

  it('rolls back all writes when transaction fails', async () => {
    const { svc, client }: any = buildTemplate();

    (client.fieldDefinition.findFirst as any).mockResolvedValue(null);
    (client.workflowDefinition.findFirst as any).mockResolvedValue(null);
    (client.workflowStage.findFirst as any).mockResolvedValue(null);
    (client.workflowTransition.findFirst as any).mockResolvedValue(null);

    // Make a specific create fail to trigger rollback
    (client.workflowStage.create as any).mockRejectedValue(new Error('DB failure'));

    // The transaction mock will throw when stage create fails
    (client.$transaction as any).mockImplementation(async (cb: any) => {
      await cb(client);
    });

    const result = await svc.applyIndustryTemplate('education', tenantId);
    expect(result.isErr()).toBe(true);
    expect(result.error.code).toBe('TRANSACTION_FAILED');
  });

  it('returns TEMPLATE_NOT_FOUND for unknown industry', async () => {
    const { svc }: any = buildTemplate();
    const result = await svc.applyIndustryTemplate('nonexistent', tenantId);
    expect(result.error.code).toBe('TEMPLATE_NOT_FOUND');
  });

  function buildTemplate() {
    const db = mockDb();
    const svc = new TemplateService(db);
    return { db, svc, client: db.client };
  }
});

/* ------------------------------------------------------------------ */
/*  visibility_rules parseable by evaluateVisibilityRules               */
/* ------------------------------------------------------------------ */
describe('visibility_rules compatibility', () => {
  it('stored rules are parseable by evaluateVisibilityRules from @meta-crm/types', () => {
    const rules = [
      { field: 'stage', operator: 'eq', value: 'Enquiry' },
      { field: 'score', operator: 'gt', value: 50 },
    ];

    const visible = evaluateVisibilityRules(rules, { stage: 'Enquiry', score: 75 });
    expect(visible).toBe(true);

    const hidden = evaluateVisibilityRules(rules, { stage: 'Enrolled', score: 75 });
    expect(hidden).toBe(false);
  });
});
