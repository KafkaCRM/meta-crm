import { Module } from '@nestjs/common';
import { CustomerOnboardingController } from './customer-onboarding.controller';
import { CustomerOnboardingService } from './customer-onboarding.service';

@Module({
  imports: [],
  controllers: [CustomerOnboardingController],
  providers: [CustomerOnboardingService],
  exports: [CustomerOnboardingService],
})
export class CustomerOnboardingModule {}
