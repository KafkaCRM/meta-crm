import { Injectable } from '@nestjs/common';
import { ok, err, Result } from 'neverthrow';
import { ClsService } from 'nestjs-cls';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';
import type { RequestScope } from '../tenant/request-scope.interface';

export type AutomationWorkflowErrorCode = 'NOT_FOUND' | 'TRANSACTION_FAILED';

export interface AutomationWorkflowError {
  code: AutomationWorkflowErrorCode;
  message: string;
}

@Injectable()
export class AutomationWorkflowService {
  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly cls: ClsService,
  ) {}

  private getScope(): RequestScope {
    return this.cls.get<RequestScope>('scope')!;
  }

  async findMany(): Promise<Result<any[], AutomationWorkflowError>> {
    try {
      const scope = this.getScope();
      const flows = await this.db.getClient().automationWorkflow.findMany({
        where: { tenant_id: scope.tenant_id },
        orderBy: { created_at: 'desc' },
      });
      return ok(flows);
    } catch (e: any) {
      return err({
        code: 'TRANSACTION_FAILED',
        message: e?.message ?? 'Failed to list automation flows',
      });
    }
  }

  async findOne(id: string): Promise<Result<any, AutomationWorkflowError>> {
    try {
      const scope = this.getScope();
      const flow = await this.db.getClient().automationWorkflow.findFirst({
        where: { id, tenant_id: scope.tenant_id },
      });

      if (!flow) {
        return err({ code: 'NOT_FOUND', message: 'Automation flow not found' });
      }

      return ok(flow);
    } catch (e: any) {
      return err({
        code: 'TRANSACTION_FAILED',
        message: e?.message ?? 'Failed to find automation flow',
      });
    }
  }

  async create(data: {
    name: string;
    description?: string;
    trigger_event: string;
    flow_json: any;
    is_active?: boolean;
  }): Promise<Result<any, AutomationWorkflowError>> {
    try {
      const scope = this.getScope();
      const flow = await this.db.getClient().automationWorkflow.create({
        data: {
          name: data.name,
          description: data.description,
          trigger_event: data.trigger_event,
          flow_json: data.flow_json ? JSON.parse(JSON.stringify(data.flow_json)) : {},
          is_active: data.is_active !== undefined ? data.is_active : true,
          tenant_id: scope.tenant_id,
        },
      });

      return ok(flow);
    } catch (e: any) {
      return err({
        code: 'TRANSACTION_FAILED',
        message: e?.message ?? 'Failed to create automation flow',
      });
    }
  }

  async update(
    id: string,
    data: {
      name?: string;
      description?: string;
      trigger_event?: string;
      flow_json?: any;
      is_active?: boolean;
    },
  ): Promise<Result<any, AutomationWorkflowError>> {
    try {
      const scope = this.getScope();
      const existing = await this.db.getClient().automationWorkflow.findFirst({
        where: { id, tenant_id: scope.tenant_id },
      });

      if (!existing) {
        return err({ code: 'NOT_FOUND', message: 'Automation flow not found' });
      }

      const updated = await this.db.getClient().automationWorkflow.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.trigger_event !== undefined ? { trigger_event: data.trigger_event } : {}),
          ...(data.flow_json !== undefined ? { flow_json: JSON.parse(JSON.stringify(data.flow_json)) } : {}),
          ...(data.is_active !== undefined ? { is_active: data.is_active } : {}),
        },
      });

      return ok(updated);
    } catch (e: any) {
      return err({
        code: 'TRANSACTION_FAILED',
        message: e?.message ?? 'Failed to update automation flow',
      });
    }
  }

  async remove(id: string): Promise<Result<void, AutomationWorkflowError>> {
    try {
      const scope = this.getScope();
      const existing = await this.db.getClient().automationWorkflow.findFirst({
        where: { id, tenant_id: scope.tenant_id },
      });

      if (!existing) {
        return err({ code: 'NOT_FOUND', message: 'Automation flow not found' });
      }

      await this.db.getClient().automationWorkflow.delete({
        where: { id },
      });

      return ok(undefined);
    } catch (e: any) {
      return err({
        code: 'TRANSACTION_FAILED',
        message: e?.message ?? 'Failed to delete automation flow',
      });
    }
  }
}
