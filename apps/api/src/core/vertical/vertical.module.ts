import { Module } from '@nestjs/common';
import { HooksModule } from '../hooks/hooks.module';
import { VerticalController } from './vertical.controller';
import { VerticalService } from './vertical.service';

@Module({
  imports: [HooksModule],
  controllers: [VerticalController],
  providers: [VerticalService],
  exports: [VerticalService],
})
export class VerticalModule {}
