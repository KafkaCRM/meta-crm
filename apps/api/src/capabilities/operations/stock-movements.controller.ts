import { Controller, Get, Post, Body, Query, UseGuards, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/permissions/permissions.guard';
import { CheckPermissions } from '../../core/permissions/permissions.decorator';
import { CapabilityGuard } from '../../core/capability/capability.guard';
import { RequireCapability } from '../../core/capability/capability.decorator';
import { StockMovementsService } from './stock-movements.service';

class CreateMovDto { @IsString() product_id!: string; @IsString() warehouse_id!: string; @IsString() type!: string; @IsNumber() @Min(0) quantity!: number; @IsOptional() @IsString() reference?: string; @IsOptional() @IsString() notes?: string; }
class MovListQuery { @IsOptional() @IsString() cursor?: string; @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(100) limit?: number; @IsOptional() @IsString() product_id?: string; @IsOptional() @IsString() warehouse_id?: string; @IsOptional() @IsString() type?: string; }

@Controller('stock-movements')
@RequireCapability('capability/operations')
@UseGuards(JwtAuthGuard, CapabilityGuard, PermissionsGuard)
export class StockMovementsController {
  constructor(private readonly service: StockMovementsService) {}
  @Post() @CheckPermissions('create', 'Case') async create(@Body() dto: CreateMovDto) { const r = await this.service.create(dto); if (r.isErr()) { if (r.error.code === 'INSUFFICIENT') throw new BadRequestException(r.error.message); throw new InternalServerErrorException(r.error); } return r.value; }
  @Get() @CheckPermissions('read', 'Case') async list(@Query() q: MovListQuery) { const r = await this.service.list(q); if (r.isErr()) throw new InternalServerErrorException(r.error); return r.value; }
}
