import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/permissions/permissions.guard';
import { CheckPermissions } from '../../core/permissions/permissions.decorator';
import { CapabilityGuard } from '../../core/capability/capability.guard';
import { RequireCapability } from '../../core/capability/capability.decorator';
import { ProductCategoriesService } from './product-categories.service';

class CreateCatDto { @IsString() name!: string; @IsOptional() @IsString() description?: string; @IsOptional() @IsString() parent_id?: string; }
class UpdateCatDto { @IsOptional() @IsString() name?: string; @IsOptional() @IsString() description?: string; @IsOptional() @IsString() parent_id?: string; }

@Controller('product-categories')
@RequireCapability('capability/operations')
@UseGuards(JwtAuthGuard, CapabilityGuard, PermissionsGuard)
export class ProductCategoriesController {
  constructor(private readonly service: ProductCategoriesService) {}
  @Post() @CheckPermissions('create', 'Case') async create(@Body() dto: CreateCatDto) { const r = await this.service.create(dto); if (r.isErr()) throw new InternalServerErrorException(r.error); return r.value; }
  @Get() @CheckPermissions('read', 'Case') async list() { const r = await this.service.list(); if (r.isErr()) throw new InternalServerErrorException(r.error); return r.value; }
  @Patch(':id') @CheckPermissions('update', 'Case') async update(@Param('id') id: string, @Body() dto: UpdateCatDto) { const r = await this.service.update(id, dto); if (r.isErr()) { if (r.error.code === 'NOT_FOUND') throw new NotFoundException(); throw new InternalServerErrorException(r.error); } return r.value; }
  @Delete(':id') @CheckPermissions('delete', 'Case') async remove(@Param('id') id: string) { const r = await this.service.remove(id); if (r.isErr()) { if (r.error.code === 'NOT_FOUND') throw new NotFoundException(); throw new InternalServerErrorException(r.error); } return r.value; }
}
