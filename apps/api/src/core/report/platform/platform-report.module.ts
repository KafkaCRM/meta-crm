import { Module } from '@nestjs/common';
import { PlatformReportController } from './platform-report.controller';
import { PlatformReportService } from './platform-report.service';

@Module({
  imports: [],
  controllers: [PlatformReportController],
  providers: [PlatformReportService],
})
export class PlatformReportModule {}
