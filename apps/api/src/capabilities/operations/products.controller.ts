import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/permissions/permissions.guard';
import { CheckPermissions } from '../../core/permissions/permissions.decorator';
import { CapabilityGuard } from '../../core/capability/capability.guard';
import { RequireCapability } from '../../core/capability/capability.decorator';
import { ProductsService } from './products.service';

class CreateProdDto { @IsString() name!: string; @IsString() sku!: string; @IsOptional() @IsString() description?: string; @IsOptional() @IsString() unit?: string; @IsOptional() @IsNumber() price?: number; @IsOptional() @IsString() category_id?: string; @IsOptional() @IsString() status?: string; }
class UpdateProdDto { @IsOptional() @IsString() name?: string; @IsOptional() @IsString() sku?: string; @IsOptional() @IsString() description?: string; @IsOptional() @IsString() unit?: string; @IsOptional() @IsNumber() price?: number; @IsOptional() @IsString() category_id?: string; @IsOptional() @IsString() status?: string; }
class ProdListQuery { @IsOptional() @IsString() cursor?: string; @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(100) limit?: number; @IsOptional() @IsString() category_id?: string; @IsOptional() @IsString() status?: string; @IsOptional() @IsString() search?: string; }

@Controller('products')
@RequireCapability('capability/operations')
@UseGuards(JwtAuthGuard, CapabilityGuard, PermissionsGuard)
export class ProductsController {
  constructor(private readonly service: ProductsService) {}
  @Post() @CheckPermissions('create', 'Case') async create(@Body() dto: CreateProdDto) { const r = await this.service.create(dto); if (r.isErr()) throw new InternalServerErrorException(r.error); return r.value; }
  @Get() @CheckPermissions('read', 'Case') async list(@Query() q: ProdListQuery) { const r = await this.service.list(q); if (r.isErr()) throw new InternalServerErrorException(r.error); return r.value; }
  @Get(':id') @CheckPermissions('read', 'Case') async get(@Param('id') id: string) { const r = await this.service.get(id); if (r.isErr()) { if (r.error.code === 'NOT_FOUND') throw new NotFoundException(); throw new InternalServerErrorException(r.error); } return r.value; }
  @Patch(':id') @CheckPermissions('update', 'Case') async update(@Param('id') id: string, @Body() dto: UpdateProdDto) { const r = await this.service.update(id, dto); if (r.isErr()) { if (r.error.code === 'NOT_FOUND') throw new NotFoundException(); throw new InternalServerErrorException(r.error); } return r.value; }
  @Delete(':id') @CheckPermissions('delete', 'Case') async remove(@Param('id') id: string) { const r = await this.service.remove(id); if (r.isErr()) { if (r.error.code === 'NOT_FOUND') throw new NotFoundException(); throw new InternalServerErrorException(r.error); } return r.value; }
}
