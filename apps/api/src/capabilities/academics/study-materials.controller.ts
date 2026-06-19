import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards, InternalServerErrorException } from '@nestjs/common';
import { IsOptional, IsString, Min, Max, IsNumber } from 'class-validator';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/permissions/permissions.guard';
import { CheckPermissions } from '../../core/permissions/permissions.decorator';
import { CapabilityGuard } from '../../core/capability/capability.guard';
import { RequireCapability } from '../../core/capability/capability.decorator';
import { StudyMaterialsService } from './study-materials.service';

class CreateDto { @IsString() course_id!: string; @IsOptional() @IsString() batch_id?: string; @IsString() title!: string; @IsOptional() @IsString() description?: string; @IsString() type!: string; @IsString() url!: string; }
class ListQuery { @IsOptional() @IsString() course_id?: string; @IsOptional() @IsString() batch_id?: string; @IsOptional() @IsString() cursor?: string; @IsOptional() @IsNumber() @Min(1) @Max(100) limit?: number; }

@Controller('study-materials')
@RequireCapability('capability/academics')
@UseGuards(JwtAuthGuard, CapabilityGuard, PermissionsGuard)
export class StudyMaterialsController {
  constructor(private readonly service: StudyMaterialsService) {}
  @Post() @CheckPermissions('create', 'Case')
  async create(@Body() dto: CreateDto) { const r = await this.service.create(dto); if (r.isErr()) throw new InternalServerErrorException(r.error); return r.value; }
  @Get() @CheckPermissions('read', 'Case')
  async findAll(@Query() q: ListQuery) { const r = await this.service.findAll(q); if (r.isErr()) throw new InternalServerErrorException(r.error); return r.value; }
  @Delete(':id') @CheckPermissions('delete', 'Case')
  async remove(@Param('id') id: string) { const r = await this.service.remove(id); if (r.isErr()) throw new InternalServerErrorException(r.error); }
}
