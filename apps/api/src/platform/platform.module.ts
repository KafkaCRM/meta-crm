import { Module } from '@nestjs/common';
import { AuthModule } from '../core/auth/auth.module';
import { PermissionsModule } from '../core/permissions/permissions.module';
import { PlatformTenantsController } from './tenants/platform-tenants.controller';
import { PlatformTenantsService } from './tenants/platform-tenants.service';
import { ProvisioningStreamService } from './tenants/provisioning-stream.service';
import { PlatformPlansController } from './plans/platform-plans.controller';
import { PlatformPlansService } from './plans/platform-plans.service';
import { PlatformPluginsController } from './plugins/platform-plugins.controller';
import { PlatformPluginsService } from './plugins/platform-plugins.service';
import { PlatformTeamController } from './team/platform-team.controller';
import { PlatformTeamService } from './team/platform-team.service';
import { PlatformAuditController } from './audit/platform-audit.controller';
import { PlatformAuditService } from './audit/platform-audit.service';

import { TenantModule } from '../core/tenant/tenant.module';
import { BullModule } from '@nestjs/bullmq';
import { PlatformSystemController } from './system/platform-system.controller';
import { PricingController } from './pricing/pricing.controller';
import { PricingService } from './pricing/pricing.service';

@Module({
  imports: [
    AuthModule,
    PermissionsModule,
    TenantModule,
    BullModule.registerQueue({ name: 'workflow' }),
    BullModule.registerQueue({ name: 'case-triggers' }),
    BullModule.registerQueue({ name: 'webhook-delivery' }),
  ],
  controllers: [
    PlatformTenantsController,
    PlatformPlansController,
    PlatformPluginsController,
    PlatformTeamController,
    PlatformAuditController,
    PlatformSystemController,
    PricingController,
  ],
  providers: [
    PlatformTenantsService,
    ProvisioningStreamService,
    PlatformPlansService,
    PlatformPluginsService,
    PlatformTeamService,
    PlatformAuditService,
    PricingService,
  ],
  exports: [PlatformAuditService, PricingService],
})
export class PlatformModule {}
