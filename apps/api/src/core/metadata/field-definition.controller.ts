import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  NotFoundException,
  InternalServerErrorException,
  UseGuards,
} from '@nestjs/common';
import { IsString, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { CheckPermissions } from '../permissions/permissions.decorator';
import { FieldDefinitionService } from './field-definition.service';
import { CreateFieldDefinitionDto, UpdateFieldDefinitionDto } from './dto/metadata.dto';

class EntityQuery {
  @IsOptional()
  @IsString()
  entity_type?: string;
}

@Controller('field-definitions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FieldDefinitionController {
  constructor(private readonly fieldService: FieldDefinitionService) {}

  @Get()
  @CheckPermissions('read', 'FieldDefinition')
  async findAll(@Query() query: EntityQuery) {
    const entityType = query.entity_type;
    const result = await this.fieldService.findByEntity(entityType ?? '');
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Post()
  @CheckPermissions('manage', 'FieldDefinition')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateFieldDefinitionDto) {
    const result = await this.fieldService.create(dto);
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Patch(':id')
  @CheckPermissions('manage', 'FieldDefinition')
  async update(@Param('id') id: string, @Body() dto: UpdateFieldDefinitionDto) {
    const result = await this.fieldService.update(id, dto);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') throw new NotFoundException(result.error);
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @CheckPermissions('manage', 'FieldDefinition')
  async remove(@Param('id') id: string) {
    const result = await this.fieldService.remove(id);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') throw new NotFoundException(result.error);
      throw new InternalServerErrorException(result.error);
    }
    return { message: 'Field definition deleted' };
  }
}
