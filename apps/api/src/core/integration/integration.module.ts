import { Module } from '@nestjs/common';
import { EncryptionService } from './encryption.service';
import { IntegrationService } from './integration.service';
import { IntegrationController } from './integration.controller';
import { IntegrationHandlersService } from './integration-handlers.service';
import { ConnectionService } from './connection.service';
import { ConnectionController } from './connection.controller';
import { IntakePipelineService } from './intake-pipeline.service';
import { WebToLeadController } from './web-to-lead.controller';
import { OAuthService } from './oauth.service';

@Module({
  controllers: [IntegrationController, ConnectionController, WebToLeadController],
  providers: [EncryptionService, IntegrationService, IntegrationHandlersService, ConnectionService, IntakePipelineService, OAuthService],
  exports: [EncryptionService, IntegrationService, IntegrationHandlersService, ConnectionService, IntakePipelineService, OAuthService],
})
export class IntegrationModule {}
