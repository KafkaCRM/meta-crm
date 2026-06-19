import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, InternalServerErrorException, NotFoundException, ConflictException } from '@nestjs/common';
import { IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/permissions/permissions.guard';
import { CheckPermissions } from '../../core/permissions/permissions.decorator';
import { CapabilityGuard } from '../../core/capability/capability.guard';
import { RequireCapability } from '../../core/capability/capability.decorator';
import { PayslipsService } from './payslips.service';

class CreatePayslipDto { @IsString() employee_id!: string; @IsNumber() @Min(1) @Max(12) month!: number; @IsNumber() year!: number; @IsOptional() @IsNumber() basic?: number; @IsOptional() @IsNumber() hra?: number; @IsOptional() @IsNumber() allowances?: number; @IsOptional() @IsNumber() deductions?: number; @IsNumber() net_pay!: number; }
class PayslipListQuery { @IsOptional() @IsString() employee_id?: string; @IsOptional() @IsNumber() @Min(1) @Max(12) month?: number; @IsOptional() @IsNumber() year?: number; @IsOptional() @IsString() status?: string; @IsOptional() @IsString() cursor?: string; @IsOptional() @IsNumber() @Min(1) @Max(100) limit?: number; }
class UpdateStatusDto { @IsString() status!: string; }

@Controller('payslips')
@RequireCapability('capability/hr')
@UseGuards(JwtAuthGuard, CapabilityGuard, PermissionsGuard)
export class PayslipsController {
  constructor(private readonly service: PayslipsService) {}
  @Post() @CheckPermissions('create', 'Case') async create(@Body() dto: CreatePayslipDto) { const r = await this.service.create(dto); if (r.isErr()) { if (r.error.code === 'DUPLICATE') throw new ConflictException(r.error.message); throw new InternalServerErrorException(r.error); } return r.value; }
  @Get() @CheckPermissions('read', 'Case') async findAll(@Query() q: PayslipListQuery) { const r = await this.service.findAll(q); if (r.isErr()) throw new InternalServerErrorException(r.error); return r.value; }
  @Get(':id') @CheckPermissions('read', 'Case') async findOne(@Param('id') id: string) { const r = await this.service.findOne(id); if (r.isErr()) { if (r.error.code === 'NOT_FOUND') throw new NotFoundException(); throw new InternalServerErrorException(r.error); } return r.value; }
  @Patch(':id/status') @CheckPermissions('update', 'Case') async updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) { const r = await this.service.updateStatus(id, dto.status); if (r.isErr()) throw new InternalServerErrorException(r.error); return r.value; }
}
