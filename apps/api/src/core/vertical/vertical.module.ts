import { Module } from '@nestjs/common';
import { VerticalController } from './vertical.controller';
import { VerticalService } from './vertical.service';

@Module({
  controllers: [VerticalController],
  providers: [VerticalService],
  exports: [VerticalService],
})
export class VerticalModule {}
