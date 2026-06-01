import { Injectable, Inject, ForbiddenException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PRISMA_CLIENT } from './prisma-client.token';
import { RequestScope } from './request-scope.interface';
import { MissingTenantContextError } from './missing-tenant-context.error';

export const TENANT_SCOPED_MODELS: readonly string[] = [
  'Brand',
  'Branch',
  'BranchBrandAssignment',
  'User',
  'Party',
  'Case',
  'CaseEvent',
  'Interaction',
  'PartyMergeQueue',
  'Role',
  'UserRole',
  'FieldDefinition',
  'LabelOverride',
  'WorkflowDefinition',
  'IntegrationConfig',
  'WebhookSubscription',
  'TenantPlugin',
  'TenantPlan',
  'Vertical',
  'Campaign',
  'Lead',
  // Phase 2 — Extension Registry
  'TenantExtension',
  'SecureCredential',
  // NOTE: ExtensionRegistry is a GLOBAL catalog (no tenant_id) — intentionally excluded
];


export async function applyTenantScope<T>(
  cls: ClsService,
  model: string,
  operation: string,
  args: any,
  query: (args: any) => Promise<T>,
): Promise<T> {
  if (!TENANT_SCOPED_MODELS.includes(model)) {
    return query(args);
  }

  if (operation === 'findUnique' || operation === 'findUniqueOrThrow') {
    const scope = cls.get<RequestScope>('scope');
    const result = await query(args);
    if (scope?.tenant_id && result && typeof result === 'object' && 'tenant_id' in result && (result as any).tenant_id !== scope.tenant_id) {
      throw new ForbiddenException('Cross-tenant resource access forbidden');
    }
    return result;
  }

  const scope = cls.get<RequestScope>('scope');

  if (!scope?.tenant_id) {
    throw new MissingTenantContextError();
  }

  if (operation === 'create') {
    return query({ ...args, data: { ...args.data, tenant_id: scope.tenant_id } });
  }

  if (operation === 'createMany') {
    return query({
      ...args,
      data: args.data.map((d: Record<string, unknown>) => ({ ...d, tenant_id: scope.tenant_id })),
    });
  }

  const verticalFilter =
    scope.vertical_ids && scope.vertical_ids.length > 0 && model === 'Case'
      ? { vertical_id: { in: scope.vertical_ids } }
      : {};

  if (operation === 'upsert') {
    return query({
      ...args,
      where: { ...args.where, tenant_id: scope.tenant_id, ...verticalFilter },
      create: { ...args.create, tenant_id: scope.tenant_id },
    });
  }

  return query({
    ...args,
    where: { ...args.where, tenant_id: scope.tenant_id, ...verticalFilter },
  });
}

@Injectable()
export class TenantScopedPrismaService {
  private extendedClient: PrismaClient;

  constructor(
    @Inject(PRISMA_CLIENT) private readonly prismaClient: PrismaClient,
    private readonly cls: ClsService,
  ) {
    this.extendedClient = this.prismaClient.$extends({
      query: {
        $allModels: {
          $allOperations: ({ model, operation, args, query }) =>
            applyTenantScope(this.cls, model, operation, args, query),
        },
      },
    }) as unknown as PrismaClient;
  }

  getClient(): PrismaClient {
    return this.extendedClient;
  }
}
