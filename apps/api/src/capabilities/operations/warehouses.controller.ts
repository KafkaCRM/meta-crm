import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/permissions/permissions.guard';
import { CheckPermissions } from '../../core/permissions/permissions.decorator';
import { CapabilityGuard } from '../../core/capability/capability.guard';
import { RequireCapability } from '../../core/capability/capability.decorator';
import { WarehousesService } from './warehouses.service';

class CreateWhDto { @IsString() name!: string; @IsOptional() @IsString() location?: string; @IsOptional() @IsString() status?: string; }
class UpdateWhDto { @IsOptional() @IsString() name?: string; @IsOptional() @IsString() location?: string; @IsOptional() @IsString() status?: string; }

@Controller('warehouses')
@RequireCapability('capability/operations')
@UseGuards(JwtAuthGuard, CapabilityGuard, PermissionsGuard)
export class WarehousesController {
  constructor(private readonly service: WarehousesService) {}
  @Post() @CheckPermissions('create', 'Case') async create(@Body() dto: CreateWhDto) { const r = await this.service.create(dto); if (r.isErr()) throw new InternalServerErrorException(r.error); return r.value; }
  @Get() @CheckPermissions('read', 'Case') async list() { const r = await this.service.list(); if (r.isErr()) throw new InternalServerErrorException(r.error); return r.value; }
  @Patch(':id') @CheckPermissions('update', 'Case') async update(@Param('id') id: string, @Body() dto: UpdateWhDto) { const r = await this.service.update(id, dto); if (r.isErr()) { if (r.error.code === 'NOT_FOUND') throw new NotFoundException(); throw new InternalServerErrorException(r.error); } return r.value; }
  @Delete(':id') @CheckPermissions('delete', 'Case') async remove(@Param('id') id: string) { const r = await this.service.remove(id); if (r.isErr()) { if (r.error.code === 'NOT_FOUND') throw new NotFoundException(); throw new InternalServerErrorException(r.error); } return r.value; }
}
