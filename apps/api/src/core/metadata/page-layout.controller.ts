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
import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { CheckPermissions } from '../permissions/permissions.decorator';
import { PageLayoutService } from './page-layout.service';

class LayoutQuery {
  @IsString()
  object_type!: string;
}

class CreateLayoutDto {
  @IsString()
  object_type!: string;

  @IsString()
  name!: string;

  @IsOptional()
  layout_json: any;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}

class UpdateLayoutDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  layout_json: any;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}

@Controller('page-layouts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PageLayoutController {
  constructor(private readonly service: PageLayoutService) {}

  @Get()
  @CheckPermissions('read', 'FieldDefinition') // Reuses FieldDefinition permissions check
  async findByObject(@Query() query: LayoutQuery) {
    const result = await this.service.findByObject(query.object_type);
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Get('default')
  @CheckPermissions('read', 'FieldDefinition')
  async findDefault(@Query() query: LayoutQuery) {
    const result = await this.service.findDefault(query.object_type);
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
  async create(@Body() dto: CreateLayoutDto) {
    const result = await this.service.create(dto);
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Patch(':id')
  @CheckPermissions('manage', 'FieldDefinition')
  async update(@Param('id') id: string, @Body() dto: UpdateLayoutDto) {
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
    return { message: 'Page layout deleted' };
  }
}
