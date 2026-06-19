import { Controller, Get, Post, Param, Body, Query, UseGuards, InternalServerErrorException } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/permissions/permissions.guard';
import { CheckPermissions } from '../../core/permissions/permissions.decorator';
import { CapabilityGuard } from '../../core/capability/capability.guard';
import { RequireCapability } from '../../core/capability/capability.decorator';
import { CertificatesService } from './certificates.service';

class CreateTemplateDto { @IsString() name!: string; @IsOptional() @IsString() description?: string; @IsString() content!: string; @IsOptional() variables?: any; }
class IssueDto { @IsString() enrollment_id!: string; @IsOptional() @IsString() template_id?: string; @IsOptional() @IsString() serial_number?: string; @IsOptional() @IsString() completion_date?: string; @IsOptional() metadata?: any; }

@Controller('certificates')
@RequireCapability('capability/academics')
@UseGuards(JwtAuthGuard, CapabilityGuard, PermissionsGuard)
export class CertificatesController {
  constructor(private readonly service: CertificatesService) {}
  @Post('templates') @CheckPermissions('create', 'Case')
  async createTemplate(@Body() dto: CreateTemplateDto) { const r = await this.service.createTemplate(dto); if (r.isErr()) throw new InternalServerErrorException(r.error); return r.value; }
  @Get('templates') @CheckPermissions('read', 'Case')
  async listTemplates() { const r = await this.service.listTemplates(); if (r.isErr()) throw new InternalServerErrorException(r.error); return r.value; }
  @Post('issue') @CheckPermissions('create', 'Case')
  async issue(@Body() dto: IssueDto) { const r = await this.service.issue(dto); if (r.isErr()) throw new InternalServerErrorException(r.error); return r.value; }
  @Get() @CheckPermissions('read', 'Case')
  async findByEnrollment(@Query('enrollment_id') enrollment_id: string) { const r = await this.service.findByEnrollment(enrollment_id); if (r.isErr()) throw new InternalServerErrorException(r.error); return r.value; }
}
