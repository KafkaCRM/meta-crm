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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { CheckPermissions } from '../permissions/permissions.decorator';
import { FlexRecordService } from './flex-record.service';

@Controller('custom-records')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FlexRecordController {
  constructor(private readonly service: FlexRecordService) {}

  @Get(':object_type')
  @CheckPermissions('read', 'Party') // Uses Contact (Party) permissions check for simplicity
  async findMany(@Param('object_type') objectType: string) {
    const result = await this.service.findMany(objectType);
    if (result.isErr()) {
      if (result.error.code === 'SCHEMA_NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Get(':object_type/:id')
  @CheckPermissions('read', 'Party')
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

  @Post(':object_type')
  @CheckPermissions('create', 'Party')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('object_type') objectType: string,
    @Body() body: Record<string, any>,
  ) {
    const result = await this.service.create(objectType, body);
    if (result.isErr()) {
      if (result.error.code === 'SCHEMA_NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      if (result.error.code === 'VALIDATION_FAILED') {
        throw new BadRequestException(result.error);
      }
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Patch(':object_type/:id')
  @CheckPermissions('update', 'Party')
  async update(
    @Param('id') id: string,
    @Body() body: Record<string, any>,
  ) {
    const result = await this.service.update(id, body);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      if (result.error.code === 'VALIDATION_FAILED') {
        throw new BadRequestException(result.error);
      }
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Delete(':object_type/:id')
  @HttpCode(HttpStatus.OK)
  @CheckPermissions('delete', 'Party')
  async remove(@Param('id') id: string) {
    const result = await this.service.remove(id);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new InternalServerErrorException(result.error);
    }
    return { message: 'Custom record deleted' };
  }
}
