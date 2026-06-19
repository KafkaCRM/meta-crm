import {
  Controller, Get, Post, Patch, Param, Body, Query,
  UseGuards, InternalServerErrorException, NotFoundException, ConflictException, BadRequestException,
} from '@nestjs/common';
import { IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/permissions/permissions.guard';
import { CheckPermissions } from '../../core/permissions/permissions.decorator';
import { CapabilityGuard } from '../../core/capability/capability.guard';
import { RequireCapability } from '../../core/capability/capability.decorator';
import { EnrollmentsService } from './enrollments.service';

class EnrollDto {
  @IsString() party_id!: string;
  @IsOptional() @IsString() batch_id?: string;
  @IsOptional() @IsString() course_id?: string;
  @IsOptional() @IsString() student_id?: string;
  @IsOptional() @IsString() roll_number?: string;
  @IsOptional() @IsString() parent_name?: string;
  @IsOptional() @IsString() parent_phone?: string;
}

class TransferDto {
  @IsString() new_batch_id!: string;
}

class EnrollmentListQuery {
  @IsOptional() @IsString() batch_id?: string;
  @IsOptional() @IsString() course_id?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() party_id?: string;
  @IsOptional() @IsString() cursor?: string;
  @IsOptional() @IsNumber() @Min(1) @Max(100) limit?: number;
}

@Controller('enrollments')
@RequireCapability('capability/academics')
@UseGuards(JwtAuthGuard, CapabilityGuard, PermissionsGuard)
export class EnrollmentsController {
  constructor(private readonly service: EnrollmentsService) {}

  @Post()
  @CheckPermissions('create', 'Case')
  async enroll(@Body() dto: EnrollDto) {
    if (!dto.batch_id && !dto.course_id) {
      throw new BadRequestException('Either batch_id or course_id is required');
    }
    const result = await this.service.enroll(dto);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') throw new NotFoundException(result.error.message);
      if (result.error.code === 'ALREADY_ENROLLED') throw new ConflictException(result.error.message);
      if (result.error.code === 'CAPACITY_FULL') throw new ConflictException(result.error.message);
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Get()
  @CheckPermissions('read', 'Case')
  async findAll(@Query() query: EnrollmentListQuery) {
    const result = await this.service.findAll({
      batch_id: query.batch_id, course_id: query.course_id,
      status: query.status, party_id: query.party_id,
      cursor: query.cursor, limit: query.limit,
    });
    if (result.isErr()) throw new InternalServerErrorException(result.error);
    return result.value;
  }

  @Get(':id')
  @CheckPermissions('read', 'Case')
  async findOne(@Param('id') id: string) {
    const result = await this.service.findOne(id);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') throw new NotFoundException(result.error.message);
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Post(':id/transfer')
  @CheckPermissions('update', 'Case')
  async transfer(@Param('id') id: string, @Body() dto: TransferDto) {
    const result = await this.service.transfer(id, dto.new_batch_id);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') throw new NotFoundException(result.error.message);
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Post(':id/withdraw')
  @CheckPermissions('update', 'Case')
  async withdraw(@Param('id') id: string) {
    const result = await this.service.withdraw(id);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') throw new NotFoundException();
      throw new InternalServerErrorException(result.error);
    }
  }
}
