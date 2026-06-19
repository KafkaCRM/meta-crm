import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/permissions/permissions.guard';
import { CheckPermissions } from '../../core/permissions/permissions.decorator';
import { CapabilityGuard } from '../../core/capability/capability.guard';
import { RequireCapability } from '../../core/capability/capability.decorator';
import { StudentFeesService } from './student-fees.service';

class CreateStudentFeeDto {
  @IsString() enrollment_id!: string;
  @IsOptional() @IsString() fee_plan_id?: string;
  @IsNumber() total_fee!: number;
  @IsOptional() @IsNumber() discount_amount?: number;
}

class RecordPaymentDto {
  @IsNumber() amount!: number;
  @IsOptional() @IsString() paid_date?: string;
  @IsOptional() @IsString() notes?: string;
}

class StudentFeeListQuery {
  @IsOptional() @IsString() enrollment_id?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() cursor?: string;
  @IsOptional() @IsNumber() @Min(1) @Max(100) limit?: number;
}

@Controller('student-fees')
@RequireCapability('capability/finance')
@UseGuards(JwtAuthGuard, CapabilityGuard, PermissionsGuard)
export class StudentFeesController {
  constructor(private readonly service: StudentFeesService) {}

  @Post() @CheckPermissions('create', 'Case')
  async create(@Body() dto: CreateStudentFeeDto) {
    const r = await this.service.create(dto);
    if (r.isErr()) throw new InternalServerErrorException(r.error);
    return r.value;
  }

  @Get() @CheckPermissions('read', 'Case')
  async findAll(@Query() q: StudentFeeListQuery) {
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

  @Post(':installmentId/payments') @CheckPermissions('update', 'Case')
  async recordPayment(@Param('installmentId') installmentId: string, @Body() dto: RecordPaymentDto) {
    const r = await this.service.recordPayment(installmentId, dto);
    if (r.isErr()) throw new InternalServerErrorException(r.error);
    return r.value;
  }

  @Delete(':id') @CheckPermissions('delete', 'Case')
  async remove(@Param('id') id: string) {
    const r = await this.service.remove(id);
    if (r.isErr()) throw new InternalServerErrorException(r.error);
  }
}
