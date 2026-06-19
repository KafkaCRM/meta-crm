import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/permissions/permissions.guard';
import { CheckPermissions } from '../../core/permissions/permissions.decorator';
import { CapabilityGuard } from '../../core/capability/capability.guard';
import { RequireCapability } from '../../core/capability/capability.decorator';
import { AssignmentsService } from './assignments.service';

class CreateDto { @IsString() course_id!: string; @IsOptional() @IsString() batch_id?: string; @IsString() title!: string; @IsOptional() @IsString() description?: string; @IsOptional() @IsString() due_date?: string; @IsOptional() @IsNumber() max_marks?: number; }
class UpdateDto { @IsOptional() @IsString() title?: string; @IsOptional() @IsString() description?: string; @IsOptional() @IsString() due_date?: string; @IsOptional() @IsNumber() max_marks?: number; }
class ListQuery { @IsOptional() @IsString() course_id?: string; @IsOptional() @IsString() batch_id?: string; @IsOptional() @IsString() cursor?: string; @IsOptional() @IsNumber() @Min(1) @Max(100) limit?: number; }

@Controller('assignments')
@RequireCapability('capability/academics')
@UseGuards(JwtAuthGuard, CapabilityGuard, PermissionsGuard)
export class AssignmentsController {
  constructor(private readonly service: AssignmentsService) {}
  @Post() @CheckPermissions('create', 'Case')
  async create(@Body() dto: CreateDto) { const r = await this.service.create(dto); if (r.isErr()) throw new InternalServerErrorException(r.error); return r.value; }
  @Get() @CheckPermissions('read', 'Case')
  async findAll(@Query() q: ListQuery) { const r = await this.service.findAll(q); if (r.isErr()) throw new InternalServerErrorException(r.error); return r.value; }
  @Get(':id') @CheckPermissions('read', 'Case')
  async findOne(@Param('id') id: string) { const r = await this.service.findOne(id); if (r.isErr()) { if (r.error.code === 'NOT_FOUND') throw new NotFoundException(); throw new InternalServerErrorException(r.error); } return r.value; }
  @Patch(':id') @CheckPermissions('update', 'Case')
  async update(@Param('id') id: string, @Body() dto: UpdateDto) { const r = await this.service.update(id, dto); if (r.isErr()) throw new InternalServerErrorException(r.error); return r.value; }
  @Delete(':id') @CheckPermissions('delete', 'Case')
  async remove(@Param('id') id: string) { const r = await this.service.remove(id); if (r.isErr()) throw new InternalServerErrorException(r.error); }
}
