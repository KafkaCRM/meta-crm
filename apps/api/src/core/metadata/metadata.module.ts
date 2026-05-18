import { Module } from '@nestjs/common';
import { FieldDefinitionController } from './field-definition.controller';
import { FieldDefinitionService } from './field-definition.service';
import { LabelController } from './label.controller';
import { LabelService } from './label.service';
import { TemplateService } from './template.service';

@Module({
  controllers: [FieldDefinitionController, LabelController],
  providers: [FieldDefinitionService, LabelService, TemplateService],
  exports: [TemplateService, LabelService],
})
export class MetadataModule {}
