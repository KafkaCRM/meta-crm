import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  InternalServerErrorException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { CheckPermissions } from '../permissions/permissions.decorator';
import { LabelService } from './label.service';
import { SetLabelDto } from './dto/metadata.dto';

@Controller('labels')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LabelController {
  constructor(private readonly labelService: LabelService) {}

  @Get()
  @CheckPermissions('read', 'FieldDefinition')
  async findAll() {
    const result = await this.labelService.resolveAll();
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Put(':key')
  @CheckPermissions('manage', 'FieldDefinition')
  async setOverride(@Param('key') key: string, @Body() body: SetLabelDto) {
    const result = await this.labelService.setOverride(key, body.value);
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }
}
