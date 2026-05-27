import { Module } from '@nestjs/common';
import { EncryptionService } from './encryption.service';
import { IntegrationService } from './integration.service';
import { IntegrationController } from './integration.controller';

@Module({
  controllers: [IntegrationController],
  providers: [EncryptionService, IntegrationService],
  exports: [EncryptionService, IntegrationService],
})
export class IntegrationModule {}
