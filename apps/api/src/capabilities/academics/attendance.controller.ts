import {
  Controller, Get, Post, Patch, Param, Body, Query,
  UseGuards, InternalServerErrorException, NotFoundException, ConflictException,
} from '@nestjs/common';
import { IsOptional, IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/permissions/permissions.guard';
import { CheckPermissions } from '../../core/permissions/permissions.decorator';
import { CapabilityGuard } from '../../core/capability/capability.guard';
import { RequireCapability } from '../../core/capability/capability.decorator';
import { AttendanceService } from './attendance.service';

class MarkAttendanceDto {
  @IsString() batch_id!: string;
  @IsString() enrollment_id!: string;
  @IsString() date!: string;
  @IsString() status!: string;
  @IsOptional() @IsString() remarks?: string;
}

class BulkMarkAttendanceDto {
  @IsString() batch_id!: string;
  @IsString() date!: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => BulkRecord)
  records!: BulkRecord[];
  @IsOptional() @IsString() marked_by_id?: string;
}

class BulkRecord {
  @IsString() enrollment_id!: string;
  @IsString() status!: string;
  @IsOptional() @IsString() remarks?: string;
}

class UpdateAttendanceDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() remarks?: string;
}

class AttendanceQuery {
  @IsString() batch_id!: string;
  @IsString() date!: string;
}

class AttendanceReportQuery {
  @IsString() batch_id!: string;
  @IsOptional() @IsString() from_date?: string;
  @IsOptional() @IsString() to_date?: string;
}

@Controller('attendance')
@RequireCapability('capability/academics')
@UseGuards(JwtAuthGuard, CapabilityGuard, PermissionsGuard)
export class AttendanceController {
  constructor(private readonly service: AttendanceService) {}

  @Post('mark')
  @CheckPermissions('create', 'Case')
  async mark(@Body() dto: MarkAttendanceDto) {
    const result = await this.service.mark(dto);
    if (result.isErr()) {
      if (result.error.code === 'DUPLICATE') throw new ConflictException(result.error.message);
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Post('bulk-mark')
  @CheckPermissions('create', 'Case')
  async bulkMark(@Body() dto: BulkMarkAttendanceDto) {
    const result = await this.service.bulkMark(dto);
    if (result.isErr()) throw new InternalServerErrorException(result.error);
    return result.value;
  }

  @Patch(':id')
  @CheckPermissions('update', 'Case')
  async update(@Param('id') id: string, @Body() dto: UpdateAttendanceDto) {
    const result = await this.service.update(id, dto);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') throw new NotFoundException();
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Get()
  @CheckPermissions('read', 'Case')
  async findByBatchAndDate(@Query() query: AttendanceQuery) {
    const result = await this.service.findByBatchAndDate(query);
    if (result.isErr()) throw new InternalServerErrorException(result.error);
    return result.value;
  }

  @Get('report')
  @CheckPermissions('read', 'Report')
  async report(@Query() query: AttendanceReportQuery) {
    const result = await this.service.reportByBatch(query);
    if (result.isErr()) throw new InternalServerErrorException(result.error);
    return result.value;
  }
}
