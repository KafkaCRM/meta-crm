import { Module } from '@nestjs/common';
import { FieldDefinitionController } from './field-definition.controller';
import { FieldDefinitionService } from './field-definition.service';
import { LabelController } from './label.controller';
import { LabelService } from './label.service';
import { TemplateService } from './template.service';
import { TemplateController } from './template.controller';
import { FieldValidationService } from './field-validation.service';
import { PageLayoutController } from './page-layout.controller';
import { PageLayoutService } from './page-layout.service';
import { CustomObjectDefinitionController } from './custom-object.controller';
import { CustomObjectDefinitionService } from './custom-object.service';
import { SetupAuditTrailController } from './setup-audit.controller';
import { SetupAuditTrailService } from './setup-audit.service';
import { LookupController } from './lookup.controller';

@Module({
  controllers: [
    FieldDefinitionController,
    LabelController,
    TemplateController,
    PageLayoutController,
    CustomObjectDefinitionController,
    SetupAuditTrailController,
    LookupController,
  ],
  providers: [
    FieldDefinitionService,
    LabelService,
    TemplateService,
    FieldValidationService,
    PageLayoutService,
    CustomObjectDefinitionService,
    SetupAuditTrailService,
  ],
  exports: [
    TemplateService,
    LabelService,
    FieldValidationService,
    PageLayoutService,
    CustomObjectDefinitionService,
    SetupAuditTrailService,
  ],
})
export class MetadataModule {}
