import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { IsOptional, IsString, IsNumber, IsBoolean, Min, Max } from 'class-validator';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/permissions/permissions.guard';
import { CheckPermissions } from '../../core/permissions/permissions.decorator';
import { CapabilityGuard } from '../../core/capability/capability.guard';
import { RequireCapability } from '../../core/capability/capability.decorator';
import { ScholarshipsService } from './scholarships.service';

class CreateScholarshipDto {
  @IsString() name!: string;
  @IsString() type!: string;
  @IsNumber() value!: number;
  @IsOptional() @IsString() eligibility?: string;
  @IsOptional() @IsBoolean() approval_required?: boolean;
}

class UpdateScholarshipDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsNumber() value?: number;
  @IsOptional() @IsString() eligibility?: string;
  @IsOptional() @IsBoolean() approval_required?: boolean;
  @IsOptional() @IsString() status?: string;
}

class AwardScholarshipDto {
  @IsString() enrollment_id!: string;
  @IsString() scholarship_id!: string;
  @IsNumber() amount!: number;
  @IsOptional() @IsString() approved_by?: string;
}

class ScholarshipListQuery {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() cursor?: string;
  @IsOptional() @IsNumber() @Min(1) @Max(100) limit?: number;
}

@Controller('scholarships')
@RequireCapability('capability/finance')
@UseGuards(JwtAuthGuard, CapabilityGuard, PermissionsGuard)
export class ScholarshipsController {
  constructor(private readonly service: ScholarshipsService) {}

  @Post() @CheckPermissions('create', 'Case')
  async create(@Body() dto: CreateScholarshipDto) {
    const r = await this.service.create(dto);
    if (r.isErr()) throw new InternalServerErrorException(r.error);
    return r.value;
  }

  @Get() @CheckPermissions('read', 'Case')
  async findAll(@Query() q: ScholarshipListQuery) {
    const r = await this.service.findAll(q);
    if (r.isErr()) throw new InternalServerErrorException(r.error);
    return r.value;
  }

  @Get(':id') @CheckPermissions('read', 'Case')
  async findOne(@Param('id') id: string) {
    const r = await this.service.findOne(id);
    if (r.isErr()) { if (r.error.code === 'NOT_FOUND') throw new NotFoundException(); throw new InternalServerErrorException(r.error); }
    return r.value;
  }

  @Patch(':id') @CheckPermissions('update', 'Case')
  async update(@Param('id') id: string, @Body() dto: UpdateScholarshipDto) {
    const r = await this.service.update(id, dto);
    if (r.isErr()) throw new InternalServerErrorException(r.error);
    return r.value;
  }

  @Delete(':id') @CheckPermissions('delete', 'Case')
  async remove(@Param('id') id: string) {
    const r = await this.service.remove(id);
    if (r.isErr()) throw new InternalServerErrorException(r.error);
  }

  @Post('award') @CheckPermissions('create', 'Case')
  async award(@Body() dto: AwardScholarshipDto) {
    const r = await this.service.award(dto);
    if (r.isErr()) throw new InternalServerErrorException(r.error);
    return r.value;
  }

  @Post('awards/:id/revoke') @CheckPermissions('update', 'Case')
  async revokeAward(@Param('id') id: string) {
    const r = await this.service.revokeAward(id);
    if (r.isErr()) throw new InternalServerErrorException(r.error);
    return { message: 'Award revoked' };
  }

  @Get('awards/list') @CheckPermissions('read', 'Case')
  async listAwards(@Query() q: { enrollment_id?: string; scholarship_id?: string; status?: string }) {
    const r = await this.service.listAwards(q);
    if (r.isErr()) throw new InternalServerErrorException(r.error);
    return r.value;
  }
}
