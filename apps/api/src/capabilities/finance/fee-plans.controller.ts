import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, InternalServerErrorException, NotFoundException, ConflictException } from '@nestjs/common';
import { IsOptional, IsString, IsNumber, IsArray, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/permissions/permissions.guard';
import { CheckPermissions } from '../../core/permissions/permissions.decorator';
import { CapabilityGuard } from '../../core/capability/capability.guard';
import { RequireCapability } from '../../core/capability/capability.decorator';
import { FeePlansService } from './fee-plans.service';

class InstallmentDto {
  @IsString() name!: string;
  @IsNumber() amount!: number;
  @IsNumber() due_days!: number;
  @IsOptional() @IsNumber() late_fee?: number;
}

class CreateFeePlanDto {
  @IsString() name!: string;
  @IsString() course_id!: string;
  @IsNumber() total_fee!: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => InstallmentDto) installments?: InstallmentDto[];
}

class UpdateFeePlanDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() total_fee?: number;
  @IsOptional() @IsString() status?: string;
}

class FeePlanListQuery {
  @IsOptional() @IsString() course_id?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() cursor?: string;
  @IsOptional() @IsNumber() @Min(1) @Max(100) limit?: number;
}

@Controller('fee-plans')
@RequireCapability('capability/finance')
@UseGuards(JwtAuthGuard, CapabilityGuard, PermissionsGuard)
export class FeePlansController {
  constructor(private readonly service: FeePlansService) {}

  @Post() @CheckPermissions('create', 'Case')
  async create(@Body() dto: CreateFeePlanDto) {
    const r = await this.service.create(dto);
    if (r.isErr()) throw new InternalServerErrorException(r.error);
    return r.value;
  }

  @Get() @CheckPermissions('read', 'Case')
  async findAll(@Query() q: FeePlanListQuery) {
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
  async update(@Param('id') id: string, @Body() dto: UpdateFeePlanDto) {
    const r = await this.service.update(id, dto);
    if (r.isErr()) throw new InternalServerErrorException(r.error);
    return r.value;
  }

  @Delete(':id') @CheckPermissions('delete', 'Case')
  async remove(@Param('id') id: string) {
    const r = await this.service.remove(id);
    if (r.isErr()) throw new InternalServerErrorException(r.error);
  }
}
