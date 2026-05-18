import { Module } from '@nestjs/common';
import { PlatformDatabaseModule } from '../../tenant/platform-database.module';
import { PlatformReportController } from './platform-report.controller';
import { PlatformReportService } from './platform-report.service';

@Module({
  imports: [PlatformDatabaseModule],
  controllers: [PlatformReportController],
  providers: [PlatformReportService],
})
export class PlatformReportModule {}
