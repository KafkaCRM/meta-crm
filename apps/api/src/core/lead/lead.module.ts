import { Module } from '@nestjs/common';
import { LeadService } from './lead.service';
import { LeadController } from './lead.controller';
import { PublicLeadController } from './public-lead.controller';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [TenantModule],
  controllers: [LeadController, PublicLeadController],
  providers: [LeadService],
  exports: [LeadService],
})
export class LeadModule {}
