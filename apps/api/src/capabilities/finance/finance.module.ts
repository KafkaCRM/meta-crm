import { Module } from '@nestjs/common';
import { FeePlansController } from './fee-plans.controller';
import { FeePlansService } from './fee-plans.service';
import { StudentFeesController } from './student-fees.controller';
import { StudentFeesService } from './student-fees.service';
import { ScholarshipsController } from './scholarships.controller';
import { ScholarshipsService } from './scholarships.service';
import { TenantModule } from '../../core/tenant/tenant.module';
import { CapabilityModule } from '../../core/capability/capability.module';

@Module({
  imports: [TenantModule, CapabilityModule],
  controllers: [FeePlansController, StudentFeesController, ScholarshipsController],
  providers: [FeePlansService, StudentFeesService, ScholarshipsService],
  exports: [FeePlansService, StudentFeesService, ScholarshipsService],
})
export class FinanceModule {}
