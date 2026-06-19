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
import { CoursesService } from './courses.service';

class CreateCourseDto {
  @IsString() name!: string;
  @IsString() code!: string;
  @IsOptional() @IsString() vertical_id?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsNumber() duration_value?: number;
  @IsOptional() @IsString() duration_unit?: string;
  @IsOptional() @IsString() mode?: string;
  @IsOptional() @IsNumber() fee?: number;
  @IsOptional() syllabus?: any;
}

class UpdateCourseDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsNumber() duration_value?: number;
  @IsOptional() @IsString() duration_unit?: string;
  @IsOptional() @IsString() mode?: string;
  @IsOptional() @IsNumber() fee?: number;
  @IsOptional() syllabus?: any;
  @IsOptional() @IsString() status?: string;
}

class CourseListQuery {
  @IsOptional() @IsString() vertical_id?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() cursor?: string;
  @IsOptional() @IsNumber() @Min(1) @Max(100) limit?: number;
}

@Controller('courses')
@RequireCapability('capability/academics')
@UseGuards(JwtAuthGuard, CapabilityGuard, PermissionsGuard)
export class CoursesController {
  constructor(private readonly service: CoursesService) {}

  @Post()
  @CheckPermissions('create', 'Case')
  async create(@Body() dto: CreateCourseDto) {
    const result = await this.service.create(dto);
    if (result.isErr()) {
      if (result.error.code === 'DUPLICATE_CODE') throw new ConflictException(result.error.message);
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Get()
  @CheckPermissions('read', 'Case')
  async findAll(@Query() query: CourseListQuery) {
    const result = await this.service.findAll({
      vertical_id: query.vertical_id, status: query.status, search: query.search,
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
  async update(@Param('id') id: string, @Body() dto: UpdateCourseDto) {
    const result = await this.service.update(id, dto);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') throw new NotFoundException(result.error.message);
      if (result.error.code === 'DUPLICATE_CODE') throw new ConflictException(result.error.message);
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
