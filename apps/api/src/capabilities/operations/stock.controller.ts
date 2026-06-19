import { Controller, Get, Post, Body, Query, UseGuards, InternalServerErrorException } from '@nestjs/common';
import { IsOptional, IsString, IsNumber, Min, Max, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/permissions/permissions.guard';
import { CheckPermissions } from '../../core/permissions/permissions.decorator';
import { CapabilityGuard } from '../../core/capability/capability.guard';
import { RequireCapability } from '../../core/capability/capability.decorator';
import { StockService } from './stock.service';

class AdjustStockDto { @IsString() product_id!: string; @IsString() warehouse_id!: string; @IsNumber() @Min(0) quantity!: number; }
class StockListQuery { @IsOptional() @IsString() cursor?: string; @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(100) limit?: number; @IsOptional() @IsString() product_id?: string; @IsOptional() @IsString() warehouse_id?: string; @IsOptional() @IsBoolean() low_stock?: boolean; }

@Controller('stock')
@RequireCapability('capability/operations')
@UseGuards(JwtAuthGuard, CapabilityGuard, PermissionsGuard)
export class StockController {
  constructor(private readonly service: StockService) {}
  @Post('adjust') @CheckPermissions('update', 'Case') async adjust(@Body() dto: AdjustStockDto) { const r = await this.service.adjust(dto); if (r.isErr()) throw new InternalServerErrorException(r.error); return r.value; }
  @Get() @CheckPermissions('read', 'Case') async list(@Query() q: StockListQuery) { const r = await this.service.list(q); if (r.isErr()) throw new InternalServerErrorException(r.error); return r.value; }
}
