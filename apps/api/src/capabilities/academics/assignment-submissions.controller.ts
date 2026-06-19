import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, InternalServerErrorException, ConflictException } from '@nestjs/common';
import { IsOptional, IsString, IsNumber } from 'class-validator';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/permissions/permissions.guard';
import { CheckPermissions } from '../../core/permissions/permissions.decorator';
import { CapabilityGuard } from '../../core/capability/capability.guard';
import { RequireCapability } from '../../core/capability/capability.decorator';
import { AssignmentSubmissionsService } from './assignment-submissions.service';

class SubmitDto { @IsString() assignment_id!: string; @IsString() enrollment_id!: string; @IsOptional() @IsString() submission_text?: string; @IsOptional() @IsString() file_url?: string; }
class GradeDto { @IsNumber() marks_obtained!: number; @IsOptional() @IsString() feedback?: string; }

@Controller('assignment-submissions')
@RequireCapability('capability/academics')
@UseGuards(JwtAuthGuard, CapabilityGuard, PermissionsGuard)
export class AssignmentSubmissionsController {
  constructor(private readonly service: AssignmentSubmissionsService) {}
  @Post('submit') @CheckPermissions('create', 'Case')
  async submit(@Body() dto: SubmitDto) { const r = await this.service.submit(dto); if (r.isErr()) { if (r.error.code === 'DUPLICATE') throw new ConflictException(); throw new InternalServerErrorException(r.error); } return r.value; }
  @Post(':id/grade') @CheckPermissions('update', 'Case')
  async grade(@Param('id') id: string, @Body() dto: GradeDto) { const r = await this.service.grade(id, dto); if (r.isErr()) throw new InternalServerErrorException(r.error); return r.value; }
  @Get() @CheckPermissions('read', 'Case')
  async findByAssignment(@Query('assignment_id') assignment_id: string) { const r = await this.service.findByAssignment(assignment_id); if (r.isErr()) throw new InternalServerErrorException(r.error); return r.value; }
}
