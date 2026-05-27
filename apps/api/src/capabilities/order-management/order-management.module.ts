import { Module } from '@nestjs/common';
import { OrderManagementController } from './order-management.controller';
import { OrderManagementService } from './order-management.service';
import { CapabilityModule } from '../../core/capability/capability.module';

@Module({
  imports: [CapabilityModule],
  controllers: [OrderManagementController],
  providers: [OrderManagementService],
  exports: [OrderManagementService],
})
export class OrderManagementModule {}
