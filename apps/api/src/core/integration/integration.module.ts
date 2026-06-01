import { Module } from '@nestjs/common';
import { EncryptionService } from './encryption.service';
import { IntegrationService } from './integration.service';
import { IntegrationController } from './integration.controller';
import { IntegrationHandlersService } from './integration-handlers.service';

@Module({
  controllers: [IntegrationController],
  providers: [EncryptionService, IntegrationService, IntegrationHandlersService],
  exports: [EncryptionService, IntegrationService, IntegrationHandlersService],
})
export class IntegrationModule {}
