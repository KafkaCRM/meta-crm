import { Controller, Get, Post, Body, Query, UseGuards, InternalServerErrorException, ConflictException } from '@nestjs/common';
import { IsOptional, IsString, IsDateString, IsArray, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/permissions/permissions.guard';
import { CheckPermissions } from '../../core/permissions/permissions.decorator';
import { CapabilityGuard } from '../../core/capability/capability.guard';
import { RequireCapability } from '../../core/capability/capability.decorator';
import { EmployeeAttendanceService } from './employee-attendance.service';

class MarkAttendanceDto { @IsString() employee_id!: string; @IsDateString() date!: string; @IsOptional() @IsString() check_in?: string; @IsOptional() @IsString() check_out?: string; @IsOptional() @IsString() status?: string; @IsOptional() @IsString() notes?: string; }
class BulkRecordDto { @IsArray() @ValidateNested({ each: true }) @Type(() => BulkRecordItem) records!: BulkRecordItem[]; @IsDateString() date!: string; }
class BulkRecordItem { @IsString() employee_id!: string; @IsString() status!: string; @IsOptional() @IsString() check_in?: string; @IsOptional() @IsString() check_out?: string; @IsOptional() @IsString() notes?: string; }
class AttnListQuery { @IsString() date!: string; @IsOptional() @IsString() department_id?: string; }
class AttnReportQuery { @IsString() employee_id!: string; @IsOptional() @IsDateString() from_date?: string; @IsOptional() @IsDateString() to_date?: string; }

@Controller('employee-attendance')
@RequireCapability('capability/hr')
@UseGuards(JwtAuthGuard, CapabilityGuard, PermissionsGuard)
export class EmployeeAttendanceController {
  constructor(private readonly service: EmployeeAttendanceService) {}
  @Post('mark') @CheckPermissions('create', 'Case') async mark(@Body() dto: MarkAttendanceDto) { const r = await this.service.mark(dto); if (r.isErr()) { if (r.error.code === 'DUPLICATE') throw new ConflictException(r.error.message); throw new InternalServerErrorException(r.error); } return r.value; }
  @Post('bulk-mark') @CheckPermissions('create', 'Case') async bulkMark(@Body() dto: BulkRecordDto) { const r = await this.service.bulkMark(dto); if (r.isErr()) throw new InternalServerErrorException(r.error); return r.value; }
  @Get() @CheckPermissions('read', 'Case') async findByDate(@Query() q: AttnListQuery) { const r = await this.service.findByDate(q); if (r.isErr()) throw new InternalServerErrorException(r.error); return r.value; }
  @Get('report') @CheckPermissions('read', 'Case') async report(@Query() q: AttnReportQuery) { const r = await this.service.report(q); if (r.isErr()) throw new InternalServerErrorException(r.error); return r.value; }
}
