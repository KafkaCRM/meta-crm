import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query,
  UseGuards, InternalServerErrorException, NotFoundException, ConflictException,
} from '@nestjs/common';
import { IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/permissions/permissions.guard';
import { CheckPermissions } from '../../core/permissions/permissions.decorator';
import { CapabilityGuard } from '../../core/capability/capability.guard';
import { RequireCapability } from '../../core/capability/capability.decorator';
import { BatchesService } from './batches.service';

class CreateBatchDto {
  @IsString() course_id!: string;
  @IsString() name!: string;
  @IsString() code!: string;
  @IsOptional() @IsString() branch_id?: string;
  @IsOptional() @IsString() trainer_id?: string;
  @IsOptional() @IsString() room?: string;
  @IsOptional() @IsString() start_date?: string;
  @IsOptional() @IsString() end_date?: string;
  @IsOptional() schedule_json?: any;
  @IsOptional() @IsNumber() capacity?: number;
}

class UpdateBatchDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() trainer_id?: string;
  @IsOptional() @IsString() room?: string;
  @IsOptional() @IsString() start_date?: string;
  @IsOptional() @IsString() end_date?: string;
  @IsOptional() schedule_json?: any;
  @IsOptional() @IsNumber() capacity?: number;
  @IsOptional() @IsString() status?: string;
}

class BatchListQuery {
  @IsOptional() @IsString() course_id?: string;
  @IsOptional() @IsString() branch_id?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() trainer_id?: string;
  @IsOptional() @IsString() cursor?: string;
  @IsOptional() @IsNumber() @Min(1) @Max(100) limit?: number;
}

@Controller('batches')
@RequireCapability('capability/academics')
@UseGuards(JwtAuthGuard, CapabilityGuard, PermissionsGuard)
export class BatchesController {
  constructor(private readonly service: BatchesService) {}

  @Post()
  @CheckPermissions('create', 'Case')
  async create(@Body() dto: CreateBatchDto) {
    const result = await this.service.create(dto);
    if (result.isErr()) {
      if (result.error.code === 'DUPLICATE_CODE') throw new ConflictException(result.error.message);
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Get()
  @CheckPermissions('read', 'Case')
  async findAll(@Query() query: BatchListQuery) {
    const result = await this.service.findAll({
      course_id: query.course_id, branch_id: query.branch_id,
      status: query.status, trainer_id: query.trainer_id,
      cursor: query.cursor, limit: query.limit,
    });
    if (result.isErr()) throw new InternalServerErrorException(result.error);
    return result.value;
  }

  @Get(':id')
  @CheckPermissions('read', 'Case')
  async findOne(@Param('id') id: string) {
    const result = await this.service.findOne(id);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') throw new NotFoundException(result.error.message);
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Patch(':id')
  @CheckPermissions('update', 'Case')
  async update(@Param('id') id: string, @Body() dto: UpdateBatchDto) {
    const result = await this.service.update(id, dto);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') throw new NotFoundException(result.error.message);
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Delete(':id')
  @CheckPermissions('delete', 'Case')
  async remove(@Param('id') id: string) {
    const result = await this.service.remove(id);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') throw new NotFoundException();
      throw new InternalServerErrorException(result.error);
    }
  }
}
