import { Module } from '@nestjs/common';
import { CustomerOnboardingController } from './customer-onboarding.controller';
import { CustomerOnboardingService } from './customer-onboarding.service';
import { CapabilityModule } from '../../core/capability/capability.module';

@Module({
  imports: [CapabilityModule],
  controllers: [CustomerOnboardingController],
  providers: [CustomerOnboardingService],
  exports: [CustomerOnboardingService],
})
export class CustomerOnboardingModule {}

