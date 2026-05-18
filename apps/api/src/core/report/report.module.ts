import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { TenantReportController } from './tenant/tenant-report.controller';
import { TenantReportService } from './tenant/tenant-report.service';
import { PlatformReportModule } from './platform/platform-report.module';

@Module({
  imports: [AuthModule, PermissionsModule, PlatformReportModule],
  controllers: [TenantReportController],
  providers: [TenantReportService],
})
export class ReportModule {}
