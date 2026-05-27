import { Module } from '@nestjs/common';
import { CapabilityController } from './capability.controller';
import { CapabilityService } from './capability.service';
import { FlexRecordController } from './flex-record.controller';
import { FlexRecordService } from './flex-record.service';
import { HooksModule } from '../hooks/hooks.module';

@Module({
  imports: [HooksModule],
  controllers: [CapabilityController, FlexRecordController],
  providers: [CapabilityService, FlexRecordService],
  exports: [CapabilityService, FlexRecordService],
})
export class CapabilityModule {}
