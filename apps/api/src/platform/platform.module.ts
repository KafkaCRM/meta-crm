import { Module } from '@nestjs/common';
import { AuthModule } from '../core/auth/auth.module';
import { PermissionsModule } from '../core/permissions/permissions.module';
import { PlatformTenantsController } from './tenants/platform-tenants.controller';
import { PlatformTenantsService } from './tenants/platform-tenants.service';
import { PlatformPlansController } from './plans/platform-plans.controller';
import { PlatformPlansService } from './plans/platform-plans.service';
import { PlatformPluginsController } from './plugins/platform-plugins.controller';
import { PlatformPluginsService } from './plugins/platform-plugins.service';
import { PlatformTeamController } from './team/platform-team.controller';
import { PlatformTeamService } from './team/platform-team.service';

@Module({
  imports: [AuthModule, PermissionsModule],
  controllers: [
    PlatformTenantsController,
    PlatformPlansController,
    PlatformPluginsController,
    PlatformTeamController,
  ],
  providers: [
    PlatformTenantsService,
    PlatformPlansService,
    PlatformPluginsService,
    PlatformTeamService,
  ],
})
export class PlatformModule {}
