import { Injectable, Logger } from '@nestjs/common';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../../core/tenant/tenant-scoped-prisma.service';
import { ClsService } from 'nestjs-cls';
import type { RequestScope } from '../../core/tenant/request-scope.interface';

export type OnboardingErrorCode = 'QUERY_FAILED' | 'NOT_FOUND' | 'TENANT_NOT_FOUND';

export interface OnboardingError {
  code: OnboardingErrorCode;
  message?: string;
}

export interface CreateOnboardingStepDto {
  title: string;
  order: number;
}

export interface CreateOnboardingDto {
  party_id: string;
  contract_value?: number;
  steps?: CreateOnboardingStepDto[];
}

export interface UpdateOnboardingDto {
  status?: string;
  contract_value?: number;
}

@Injectable()
export class CustomerOnboardingService {
  private readonly logger = new Logger(CustomerOnboardingService.name);

  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly cls: ClsService,
  ) {}

  private getTenantId(): string | null {
    const scope = this.cls.get<RequestScope>('scope');
    return scope?.tenant_id ?? null;
  }

  async listOnboardings(filters: {
    party_id?: string;
    status?: string;
  }): Promise<Result<any[], OnboardingError>> {
    try {
      const tenantId = this.getTenantId();
      if (!tenantId) {
        return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant context missing' });
      }

      const where: any = { tenant_id: tenantId };
      if (filters.party_id) {
        where.party_id = filters.party_id;
      }
      if (filters.status) {
        where.status = filters.status;
      }

      const onboardings = await this.db.getClient().onboarding.findMany({
        where,
        orderBy: { created_at: 'desc' },
        include: {
          party: {
            select: { id: true, name: true, email: true, phone_normalized: true },
          },
          steps: {
            orderBy: { order: 'asc' },
          },
        },
      });

      return ok(onboardings);
    } catch (e) {
      this.logger.error('Error listing onboardings', (e as Error).stack);
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async getOnboarding(id: string): Promise<Result<any, OnboardingError>> {
    try {
      const tenantId = this.getTenantId();
      if (!tenantId) {
        return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant context missing' });
      }

      const onboarding = await this.db.getClient().onboarding.findFirst({
        where: { id, tenant_id: tenantId },
        include: {
          party: {
            select: { id: true, name: true, email: true, phone_normalized: true },
          },
          steps: {
            orderBy: { order: 'asc' },
          },
        },
      });

      if (!onboarding) {
        return err({ code: 'NOT_FOUND', message: `Onboarding with ID ${id} not found` });
      }

      return ok(onboarding);
    } catch (e) {
      this.logger.error('Error getting onboarding', (e as Error).stack);
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async createOnboarding(dto: CreateOnboardingDto): Promise<Result<any, OnboardingError>> {
    try {
      const tenantId = this.getTenantId();
      if (!tenantId) {
        return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant context missing' });
      }

      const defaultSteps = [
        { title: 'Kickoff Call', order: 1 },
        { title: 'Account Configuration', order: 2 },
        { title: 'User Training', order: 3 },
        { title: 'Go Live', order: 4 },
      ];

      const stepsToCreate = dto.steps && dto.steps.length > 0 ? dto.steps : defaultSteps;

      const onboarding = await this.db.getClient().onboarding.create({
        data: {
          tenant_id: tenantId,
          party_id: dto.party_id,
          contract_value: dto.contract_value ?? null,
          status: 'active',
          setup_completed: false,
          steps: {
            create: stepsToCreate.map(step => ({
              title: step.title,
              order: step.order,
              completed: false,
            })),
          },
        },
        include: {
          steps: {
            orderBy: { order: 'asc' },
          },
        },
      });

      return ok(onboarding);
    } catch (e) {
      this.logger.error('Error creating onboarding', (e as Error).stack);
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async updateOnboarding(id: string, dto: UpdateOnboardingDto): Promise<Result<any, OnboardingError>> {
    try {
      const tenantId = this.getTenantId();
      if (!tenantId) {
        return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant context missing' });
      }

      const onboardingExists = await this.db.getClient().onboarding.findFirst({
        where: { id, tenant_id: tenantId },
      });

      if (!onboardingExists) {
        return err({ code: 'NOT_FOUND', message: `Onboarding with ID ${id} not found` });
      }

      const updated = await this.db.getClient().onboarding.update({
        where: { id },
        data: {
          ...(dto.status && { status: dto.status }),
          ...(dto.contract_value !== undefined && { contract_value: dto.contract_value }),
        },
        include: {
          steps: {
            orderBy: { order: 'asc' },
          },
        },
      });

      return ok(updated);
    } catch (e) {
      this.logger.error('Error updating onboarding', (e as Error).stack);
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async updateStep(
    onboardingId: string,
    stepId: string,
    completed: boolean,
  ): Promise<Result<any, OnboardingError>> {
    try {
      const tenantId = this.getTenantId();
      if (!tenantId) {
        return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant context missing' });
      }

      const onboarding = await this.db.getClient().onboarding.findFirst({
        where: { id: onboardingId, tenant_id: tenantId },
        include: { steps: true },
      });

      if (!onboarding) {
        return err({ code: 'NOT_FOUND', message: `Onboarding with ID ${onboardingId} not found` });
      }

      const stepExists = onboarding.steps.find((s: any) => s.id === stepId);
      if (!stepExists) {
        return err({ code: 'NOT_FOUND', message: `Step with ID ${stepId} not found on this onboarding` });
      }

      // Update the step
      await this.db.getClient().onboardingStep.update({
        where: { id: stepId },
        data: {
          completed,
          completed_at: completed ? new Date() : null,
        },
      });

      // Recalculate onboarding setup_completed status
      const updatedSteps = await this.db.getClient().onboardingStep.findMany({
        where: { onboarding_id: onboardingId },
      });

      const allCompleted = updatedSteps.length > 0 && updatedSteps.every((s: any) => s.completed);

      const updatedOnboarding = await this.db.getClient().onboarding.update({
        where: { id: onboardingId },
        data: {
          setup_completed: allCompleted,
        },
        include: {
          steps: {
            orderBy: { order: 'asc' },
          },
        },
      });

      return ok(updatedOnboarding);
    } catch (e) {
      this.logger.error('Error updating onboarding step', (e as Error).stack);
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }
}
