import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, InternalServerErrorException, ConflictException, NotFoundException } from '@nestjs/common';
import { IsOptional, IsString, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/permissions/permissions.guard';
import { CheckPermissions } from '../../core/permissions/permissions.decorator';
import { CapabilityGuard } from '../../core/capability/capability.guard';
import { RequireCapability } from '../../core/capability/capability.decorator';
import { TestScoresService } from './test-scores.service';

class RecordScoreDto { @IsString() test_id!: string; @IsString() enrollment_id!: string; @IsNumber() marks_obtained!: number; @IsOptional() @IsString() grade?: string; @IsOptional() @IsString() remarks?: string; }
class BulkRecordDto { @IsString() test_id!: string; @IsArray() @ValidateNested({ each: true }) @Type(() => BulkScoreRecord) scores!: BulkScoreRecord[]; }
class BulkScoreRecord { @IsString() enrollment_id!: string; @IsNumber() marks_obtained!: number; @IsOptional() @IsString() grade?: string; @IsOptional() @IsString() remarks?: string; }
class UpdateScoreDto { @IsOptional() @IsNumber() marks_obtained?: number; @IsOptional() @IsString() grade?: string; @IsOptional() @IsString() remarks?: string; }

@Controller('test-scores')
@RequireCapability('capability/academics')
@UseGuards(JwtAuthGuard, CapabilityGuard, PermissionsGuard)
export class TestScoresController {
  constructor(private readonly service: TestScoresService) {}
  @Post('record') @CheckPermissions('create', 'Case')
  async record(@Body() dto: RecordScoreDto) { const r = await this.service.record(dto); if (r.isErr()) { if (r.error.code === 'DUPLICATE') throw new ConflictException(); throw new InternalServerErrorException(r.error); } return r.value; }
  @Post('bulk-record') @CheckPermissions('create', 'Case')
  async bulkRecord(@Body() dto: BulkRecordDto) { const r = await this.service.bulkRecord(dto); if (r.isErr()) throw new InternalServerErrorException(r.error); return r.value; }
  @Patch(':id') @CheckPermissions('update', 'Case')
  async update(@Param('id') id: string, @Body() dto: UpdateScoreDto) { const r = await this.service.update(id, dto); if (r.isErr()) throw new InternalServerErrorException(r.error); return r.value; }
  @Get() @CheckPermissions('read', 'Case')
  async findByTest(@Query('test_id') test_id: string) { const r = await this.service.findByTest(test_id); if (r.isErr()) throw new InternalServerErrorException(r.error); return r.value; }
}
