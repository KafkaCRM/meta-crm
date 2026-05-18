import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { UseGuards } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { CheckPermissions } from '../../core/permissions/permissions.decorator';
import { PermissionsGuard } from '../../core/permissions/permissions.guard';
import { SecretsService } from '../../core/secrets/secrets.service';
import { TenantScopedPrismaService } from '../../core/tenant/tenant-scoped-prisma.service';
import type { RequestScope } from '../../core/tenant/request-scope.interface';
import { createId } from '@paralleldrive/cuid2';

class CreateSubscriptionDto {
  event!: string;
  url!: string;
  secret!: string;
}

class UpdateSubscriptionDto {
  url?: string;
  enabled?: boolean;
}

@Controller('webhooks/subscriptions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WebhookSubscriptionController {
  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly secrets: SecretsService,
    private readonly cls: ClsService,
  ) {}

  @Get()
  @CheckPermissions('read', 'Webhook')
  async findAll() {
    const subs = await this.db.getClient().webhookSubscription.findMany({
      select: {
        id: true,
        event: true,
        url: true,
        enabled: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
    });

    return subs;
  }

  @Post()
  @CheckPermissions('manage', 'Webhook')
  async create(@Body() dto: CreateSubscriptionDto) {
    const scope = this.cls.get<RequestScope>('scope');
    const ref = `secret/tenants/${scope.tenant_id}/webhooks/${createId()}`;

    const setResult = await this.secrets.set(ref, dto.secret);

    if (setResult.isErr()) {
      throw new InternalServerErrorException({
        code: 'SECRET_STORE_FAILED',
        message: 'Failed to store webhook secret',
      });
    }

    const sub = await this.db.getClient().webhookSubscription.create({
      data: {
        event: dto.event,
        url: dto.url,
        secret_ref: ref,
        enabled: true,
        tenant_id: scope.tenant_id,
      },
      select: {
        id: true,
        event: true,
        url: true,
        enabled: true,
        created_at: true,
      },
    });

    return sub;
  }

  @Patch(':id')
  @CheckPermissions('manage', 'Webhook')
  async update(@Param('id') id: string, @Body() dto: UpdateSubscriptionDto) {
    const existing = await this.db.getClient().webhookSubscription.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException({ code: 'SUBSCRIPTION_NOT_FOUND', id });
    }

    const sub = await this.db.getClient().webhookSubscription.update({
      where: { id },
      data: {
        ...(dto.url !== undefined && { url: dto.url }),
        ...(dto.enabled !== undefined && { enabled: dto.enabled }),
      },
      select: {
        id: true,
        event: true,
        url: true,
        enabled: true,
        created_at: true,
      },
    });

    return sub;
  }

  @Delete(':id')
  @CheckPermissions('manage', 'Webhook')
  async remove(@Param('id') id: string) {
    const existing = await this.db.getClient().webhookSubscription.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException({ code: 'SUBSCRIPTION_NOT_FOUND', id });
    }

    await this.db.getClient().webhookSubscription.delete({
      where: { id },
    });

    return { deleted: true, id };
  }
}
