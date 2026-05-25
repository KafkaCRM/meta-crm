import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';
import { HooksService } from '../hooks/hooks.service';
import type { RequestScope } from '../tenant/request-scope.interface';
import type { CreateVerticalDto } from './dto/create-vertical.dto';
import type { UpdateVerticalDto } from './dto/update-vertical.dto';
import type { VerticalDetailResponse, VerticalResponse, VerticalStats } from './dto/vertical-response.dto';

export type VerticalErrorCode =
  | 'NOT_FOUND'
  | 'VERTICAL_HAS_ACTIVE_CASES'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR';

export interface VerticalError {
  code: VerticalErrorCode;
  message?: string;
  count?: number;
}

@Injectable()
export class VerticalService {
  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly cls: ClsService,
    private readonly hooks: HooksService,
  ) {}

  private get scope(): RequestScope {
    return this.cls.get<RequestScope>('scope')!;
  }

  async list(params: { brand_id?: string; status?: string }): Promise<Result<VerticalResponse[], VerticalError>> {
    try {
      const where: Record<string, any> = {};

      if (params.status) {
        where.status = params.status;
      }

      if (params.brand_id) {
        const assignments = await this.db.getClient().branchBrandAssignment.findMany({
          where: { brand_id: params.brand_id },
          select: { branch_id: true },
        });
        const branchIds = assignments.map((a) => a.branch_id);
        where.branch_id = { in: branchIds };
      }

      const verticals = await this.db.getClient().vertical.findMany({
        where,
        orderBy: { created_at: 'desc' },
      });

      const data = await Promise.all(
        verticals.map(async (v) => {
          const [pipeline_count, active_campaign_count] = await Promise.all([
            this.db.getClient().workflowDefinition.count({
              where: { vertical_id: v.id },
            }),
            this.db.getClient().campaign.count({
              where: { vertical_id: v.id, status: 'active' },
            }),
          ]);

          return {
            id: v.id,
            tenant_id: v.tenant_id,
            branch_id: v.branch_id,
            name: v.name,
            description: v.description,
            status: v.status,
            created_at: v.created_at,
            updated_at: v.updated_at,
            pipeline_count,
            active_campaign_count,
          };
        }),
      );

      return ok(data);
    } catch (e: any) {
      return err({
        code: 'INTERNAL_ERROR',
        message: e?.message ?? 'Failed to list verticals',
      });
    }
  }

  async findOne(id: string): Promise<Result<VerticalDetailResponse, VerticalError>> {
    try {
      const vertical = await this.db.getClient().vertical.findUnique({
        where: { id },
      });

      if (!vertical) {
        return err({ code: 'NOT_FOUND', message: 'Vertical not found' });
      }

      const stats = await this.calculateStats(id);

      return ok({
        id: vertical.id,
        tenant_id: vertical.tenant_id,
        branch_id: vertical.branch_id,
        name: vertical.name,
        description: vertical.description,
        status: vertical.status,
        created_at: vertical.created_at,
        updated_at: vertical.updated_at,
        stats,
      });
    } catch (e: any) {
      return err({
        code: 'INTERNAL_ERROR',
        message: e?.message ?? 'Failed to retrieve vertical',
      });
    }
  }

  async create(dto: CreateVerticalDto): Promise<Result<VerticalDetailResponse, VerticalError>> {
    try {
      const vertical = await this.db.getClient().vertical.create({
        data: {
          tenant_id: '',
          branch_id: dto.branch_id,
          name: dto.name,
          description: dto.description,
          status: 'active',
        },
      });

      await this.hooks.emit('vertical:created', {
        id: vertical.id,
        name: vertical.name,
        tenant_id: this.scope.tenant_id,
        branch_id: vertical.branch_id,
      });

      const stats = {
        total_leads: 0,
        active_leads: 0,
        converted: 0,
        conversion_rate: 0,
        active_campaigns: 0,
        pipelines: 0,
      };

      return ok({
        id: vertical.id,
        tenant_id: vertical.tenant_id,
        branch_id: vertical.branch_id,
        name: vertical.name,
        description: vertical.description,
        status: vertical.status,
        created_at: vertical.created_at,
        updated_at: vertical.updated_at,
        stats,
      });
    } catch (e: any) {
      return err({
        code: 'INTERNAL_ERROR',
        message: e?.message ?? 'Failed to create vertical',
      });
    }
  }

  async update(id: string, dto: UpdateVerticalDto): Promise<Result<VerticalDetailResponse, VerticalError>> {
    try {
      const existing = await this.db.getClient().vertical.findUnique({
        where: { id },
      });

      if (!existing) {
        return err({ code: 'NOT_FOUND', message: 'Vertical not found' });
      }

      const updated = await this.db.getClient().vertical.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
        },
      });

      const stats = await this.calculateStats(id);

      return ok({
        id: updated.id,
        tenant_id: updated.tenant_id,
        branch_id: updated.branch_id,
        name: updated.name,
        description: updated.description,
        status: updated.status,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
        stats,
      });
    } catch (e: any) {
      return err({
        code: 'INTERNAL_ERROR',
        message: e?.message ?? 'Failed to update vertical',
      });
    }
  }

  async updateStatus(id: string, status: string): Promise<Result<VerticalDetailResponse, VerticalError>> {
    try {
      const existing = await this.db.getClient().vertical.findUnique({
        where: { id },
      });

      if (!existing) {
        return err({ code: 'NOT_FOUND', message: 'Vertical not found' });
      }

      if (status === 'inactive') {
        const activeCount = await this.getActiveCasesCount(id);
        if (activeCount > 0) {
          return err({
            code: 'VERTICAL_HAS_ACTIVE_CASES',
            message: `Cannot deactivate vertical: ${activeCount} active cases exist`,
            count: activeCount,
          });
        }
      }

      const updated = await this.db.getClient().vertical.update({
        where: { id },
        data: { status },
      });

      if (status === 'inactive') {
        await this.hooks.emit('vertical:deactivated', {
          id: updated.id,
          name: updated.name,
          tenant_id: this.scope.tenant_id,
          branch_id: updated.branch_id,
        });
      }

      const stats = await this.calculateStats(id);

      return ok({
        id: updated.id,
        tenant_id: updated.tenant_id,
        branch_id: updated.branch_id,
        name: updated.name,
        description: updated.description,
        status: updated.status,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
        stats,
      });
    } catch (e: any) {
      return err({
        code: 'INTERNAL_ERROR',
        message: e?.message ?? 'Failed to update status',
      });
    }
  }

  private async getActiveCasesCount(verticalId: string): Promise<number> {
    const wfs = await this.db.getClient().workflowDefinition.findMany({
      where: { vertical_id: verticalId },
      select: { id: true },
    });

    if (wfs.length === 0) {
      return this.db.getClient().case.count({
        where: { vertical_id: verticalId },
      });
    }

    const wfIds = wfs.map((w) => w.id);
    const wfGroups = await this.db.getClient().workflowStage.groupBy({
      by: ['workflow_definition_id'],
      where: { workflow_definition_id: { in: wfIds } },
      _max: { order: true },
    });

    const finalStageIds: string[] = [];
    for (const group of wfGroups) {
      const stages = await this.db.getClient().workflowStage.findMany({
        where: {
          workflow_definition_id: group.workflow_definition_id,
          order: group._max.order!,
        },
        select: { id: true },
      });
      finalStageIds.push(...stages.map((s) => s.id));
    }

    if (finalStageIds.length === 0) {
      return this.db.getClient().case.count({
        where: { vertical_id: verticalId },
      });
    }

    return this.db.getClient().case.count({
      where: {
        vertical_id: verticalId,
        stage: { notIn: finalStageIds },
      },
    });
  }

  private async calculateStats(verticalId: string): Promise<VerticalStats> {
    const [total_leads, active_campaigns, pipelines] = await Promise.all([
      this.db.getClient().case.count({
        where: { vertical_id: verticalId },
      }),
      this.db.getClient().campaign.count({
        where: { vertical_id: verticalId, status: 'active' },
      }),
      this.db.getClient().workflowDefinition.count({
        where: { vertical_id: verticalId },
      }),
    ]);

    if (total_leads === 0) {
      return {
        total_leads: 0,
        active_leads: 0,
        converted: 0,
        conversion_rate: 0,
        active_campaigns,
        pipelines,
      };
    }

    const wfs = await this.db.getClient().workflowDefinition.findMany({
      where: { vertical_id: verticalId },
      select: { id: true },
    });

    let converted = 0;
    let active_leads = total_leads;

    if (wfs.length > 0) {
      const wfIds = wfs.map((w) => w.id);
      const wfGroups = await this.db.getClient().workflowStage.groupBy({
        by: ['workflow_definition_id'],
        where: { workflow_definition_id: { in: wfIds } },
        _max: { order: true },
      });

      const finalStageIds: string[] = [];
      for (const group of wfGroups) {
        const stages = await this.db.getClient().workflowStage.findMany({
          where: {
            workflow_definition_id: group.workflow_definition_id,
            order: group._max.order!,
          },
          select: { id: true },
        });
        finalStageIds.push(...stages.map((s) => s.id));
      }

      if (finalStageIds.length > 0) {
        [converted, active_leads] = await Promise.all([
          this.db.getClient().case.count({
            where: {
              vertical_id: verticalId,
              stage: { in: finalStageIds },
            },
          }),
          this.db.getClient().case.count({
            where: {
              vertical_id: verticalId,
              stage: { notIn: finalStageIds },
            },
          }),
        ]);
      }
    }

    const conversion_rate = total_leads > 0 ? Math.round((converted / total_leads) * 10000) / 100 : 0;

    return {
      total_leads,
      active_leads,
      converted,
      conversion_rate,
      active_campaigns,
      pipelines,
    };
  }
}
