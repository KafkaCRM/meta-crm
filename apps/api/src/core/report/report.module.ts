import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { TenantReportController } from './tenant/tenant-report.controller';
import { TenantReportService } from './tenant/tenant-report.service';
import { PlatformReportModule } from './platform/platform-report.module';
import { CampaignModule } from '../campaign/campaign.module';

@Module({
  imports: [AuthModule, PermissionsModule, PlatformReportModule, CampaignModule],
  controllers: [TenantReportController],
  providers: [TenantReportService],
})
export class ReportModule {}
