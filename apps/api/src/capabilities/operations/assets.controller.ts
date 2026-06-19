import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/permissions/permissions.guard';
import { CheckPermissions } from '../../core/permissions/permissions.decorator';
import { CapabilityGuard } from '../../core/capability/capability.guard';
import { RequireCapability } from '../../core/capability/capability.decorator';
import { AssetsService } from './assets.service';

class CreateAssetDto { @IsString() name!: string; @IsString() asset_code!: string; @IsOptional() @IsString() type?: string; @IsOptional() @IsString() status?: string; @IsOptional() @IsString() assigned_to_id?: string; @IsOptional() @IsString() purchase_date?: string; @IsOptional() @IsNumber() purchase_cost?: number; @IsOptional() @IsString() notes?: string; }
class UpdateAssetDto { @IsOptional() @IsString() name?: string; @IsOptional() @IsString() asset_code?: string; @IsOptional() @IsString() type?: string; @IsOptional() @IsString() status?: string; @IsOptional() @IsString() assigned_to_id?: string; @IsOptional() @IsString() purchase_date?: string; @IsOptional() @IsNumber() purchase_cost?: number; @IsOptional() @IsString() notes?: string; }
class AssetListQuery { @IsOptional() @IsString() cursor?: string; @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(100) limit?: number; @IsOptional() @IsString() status?: string; @IsOptional() @IsString() type?: string; @IsOptional() @IsString() search?: string; }

@Controller('assets')
@RequireCapability('capability/operations')
@UseGuards(JwtAuthGuard, CapabilityGuard, PermissionsGuard)
export class AssetsController {
  constructor(private readonly service: AssetsService) {}
  @Post() @CheckPermissions('create', 'Case') async create(@Body() dto: CreateAssetDto) { const r = await this.service.create(dto); if (r.isErr()) throw new InternalServerErrorException(r.error); return r.value; }
  @Get() @CheckPermissions('read', 'Case') async list(@Query() q: AssetListQuery) { const r = await this.service.list(q); if (r.isErr()) throw new InternalServerErrorException(r.error); return r.value; }
  @Get(':id') @CheckPermissions('read', 'Case') async get(@Param('id') id: string) { const r = await this.service.get(id); if (r.isErr()) { if (r.error.code === 'NOT_FOUND') throw new NotFoundException(); throw new InternalServerErrorException(r.error); } return r.value; }
  @Patch(':id') @CheckPermissions('update', 'Case') async update(@Param('id') id: string, @Body() dto: UpdateAssetDto) { const r = await this.service.update(id, dto); if (r.isErr()) { if (r.error.code === 'NOT_FOUND') throw new NotFoundException(); throw new InternalServerErrorException(r.error); } return r.value; }
  @Delete(':id') @CheckPermissions('delete', 'Case') async remove(@Param('id') id: string) { const r = await this.service.remove(id); if (r.isErr()) { if (r.error.code === 'NOT_FOUND') throw new NotFoundException(); throw new InternalServerErrorException(r.error); } return r.value; }
}
