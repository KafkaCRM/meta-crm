import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  UseGuards,
} from '@nestjs/common';
import { IsString, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { CheckPermissions } from '../permissions/permissions.decorator';
import { CustomObjectDefinitionService } from './custom-object.service';

class CreateCustomObjectDto {
  @IsString()
  api_name!: string;

  @IsString()
  singular_label!: string;

  @IsString()
  plural_label!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

class UpdateCustomObjectDto {
  @IsOptional()
  @IsString()
  singular_label?: string;

  @IsOptional()
  @IsString()
  plural_label?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

@Controller('custom-objects')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CustomObjectDefinitionController {
  constructor(private readonly service: CustomObjectDefinitionService) {}

  @Get()
  @CheckPermissions('read', 'FieldDefinition')
  async list() {
    const result = await this.service.list();
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Get(':id')
  @CheckPermissions('read', 'FieldDefinition')
  async findOne(@Param('id') id: string) {
    const result = await this.service.findOne(id);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Post()
  @CheckPermissions('manage', 'FieldDefinition')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateCustomObjectDto) {
    const result = await this.service.create(dto);
    if (result.isErr()) {
      if (result.error.code === 'DUPLICATE_NAME') {
        throw new BadRequestException(result.error);
      }
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Patch(':id')
  @CheckPermissions('manage', 'FieldDefinition')
  async update(@Param('id') id: string, @Body() dto: UpdateCustomObjectDto) {
    const result = await this.service.update(id, dto);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @CheckPermissions('manage', 'FieldDefinition')
  async remove(@Param('id') id: string) {
    const result = await this.service.remove(id);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new InternalServerErrorException(result.error);
    }
    return { message: 'Custom object definition deleted' };
  }
}
