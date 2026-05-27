import { SetMetadata } from '@nestjs/common';

export const REQUIRE_CAPABILITY_KEY = 'require_capability';

/**
 * Decorator that marks a controller or route handler as requiring
 * a specific capability to be enabled for the requesting tenant.
 *
 * Usage:
 *   @RequireCapability('capability/property-listing')
 *   @UseGuards(JwtAuthGuard, CapabilityGuard)
 *   @Controller('properties')
 *   export class PropertyController { ... }
 */
export const RequireCapability = (capabilityId: string) =>
  SetMetadata(REQUIRE_CAPABILITY_KEY, capabilityId);
