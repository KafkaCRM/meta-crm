import { Module } from '@nestjs/common';
import { FieldDefinitionController } from './field-definition.controller';
import { FieldDefinitionService } from './field-definition.service';
import { LabelController } from './label.controller';
import { LabelService } from './label.service';
import { TemplateService } from './template.service';
import { FieldValidationService } from './field-validation.service';

@Module({
  controllers: [FieldDefinitionController, LabelController],
  providers: [FieldDefinitionService, LabelService, TemplateService, FieldValidationService],
  exports: [TemplateService, LabelService, FieldValidationService],
})
export class MetadataModule {}
