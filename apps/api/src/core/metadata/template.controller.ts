import {
  Controller,
  Post,
  Body,
  InternalServerErrorException,
  UseGuards,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { CheckPermissions } from '../permissions/permissions.decorator';
import { TemplateService } from './template.service';
import { RequestScope } from '../tenant/request-scope.interface';

@Controller('templates')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TemplateController {
  constructor(
    private readonly templateService: TemplateService,
    private readonly cls: ClsService,
  ) {}

  @Post('apply')
  @CheckPermissions('manage', 'FieldDefinition')
  async apply(@Body() body: { industry: string }) {
    const scope = this.cls.get<RequestScope>('scope');
    const tenantId = scope?.tenant_id;
    if (!tenantId) {
      throw new InternalServerErrorException('No tenant context found');
    }
    const result = await this.templateService.applyIndustryTemplate(body.industry, tenantId);
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return { success: true };
  }
}
