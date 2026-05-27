import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EnrollmentController } from './enrollment.controller';
import { EnrollmentService } from './enrollment.service';
import { EnrollmentTriggersService } from './enrollment-triggers.service';
import { TenantModule } from '../../core/tenant/tenant.module';
import { HooksModule } from '../../core/hooks/hooks.module';
import { WhatsAppModule } from '../../integrations/whatsapp/whatsapp.module';
import { CapabilityModule } from '../../core/capability/capability.module';

@Module({
  imports: [
    TenantModule,
    HooksModule,
    WhatsAppModule,
    CapabilityModule,
    EventEmitterModule.forRoot(),
  ],
  controllers: [EnrollmentController],
  providers: [EnrollmentService, EnrollmentTriggersService],
  exports: [EnrollmentService],
})
export class EnrollmentModule {}

