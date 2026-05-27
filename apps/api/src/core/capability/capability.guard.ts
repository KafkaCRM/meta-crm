import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';
import { REQUIRE_CAPABILITY_KEY } from './capability.decorator';
import type { RequestScope } from '../tenant/request-scope.interface';

/**
 * CapabilityGuard enforces that a tenant has enabled a specific business
 * capability before allowing access to capability-scoped API controllers.
 *
 * Works in concert with @RequireCapability('capability/xxx') decorator.
 * Capabilities are stored in Tenant.config_json.enabled_capabilities[].
 *
 * Apply AFTER JwtAuthGuard so that scope is populated in CLS.
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard, CapabilityGuard, PermissionsGuard)
 *   @RequireCapability('capability/property-listing')
 *   @Controller('properties')
 *   export class PropertyController { ... }
 */
@Injectable()
export class CapabilityGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly db: TenantScopedPrismaService,
    private readonly cls: ClsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Read @RequireCapability() from handler first, then the controller class
    const requiredCapability = this.reflector.getAllAndOverride<string | undefined>(
      REQUIRE_CAPABILITY_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No capability requirement — allow through
    if (!requiredCapability) return true;

    const scope = this.cls.get<RequestScope>('scope');
    if (!scope?.tenant_id) {
      throw new ForbiddenException({
        code: 'CAPABILITY_DENIED',
        capability: requiredCapability,
        message: 'Tenant context is missing.',
      });
    }

    // Load tenant config to check which capabilities are enabled
    const tenant = await this.db.getClient().tenant.findFirst({
      where: { id: scope.tenant_id },
      select: { config_json: true },
    });

    if (!tenant) {
      throw new ForbiddenException({
        code: 'CAPABILITY_DENIED',
        capability: requiredCapability,
        message: 'Tenant not found.',
      });
    }

    const config = (tenant.config_json ?? {}) as Record<string, unknown>;
    const enabledCapabilities: string[] = Array.isArray(config['enabled_capabilities'])
      ? (config['enabled_capabilities'] as string[])
      : [];

    if (!enabledCapabilities.includes(requiredCapability)) {
      throw new ForbiddenException({
        code: 'CAPABILITY_NOT_ENABLED',
        capability: requiredCapability,
        message: `The '${requiredCapability}' capability is not enabled for your workspace. Contact your administrator to enable it.`,
      });
    }

    return true;
  }
}
