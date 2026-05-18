import {
  Controller,
  Get,
  Query,
  UseGuards,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { CheckPermissions } from '../../permissions/permissions.decorator';
import { TenantReportService } from './tenant-report.service';
import type { ReportParams } from './tenant-report.service';

class ReportQuery implements ReportParams {
  @IsOptional()
  @IsString()
  date_from?: string;

  @IsOptional()
  @IsString()
  date_to?: string;

  @IsOptional()
  @IsString()
  assignment_id?: string;

  @IsOptional()
  @IsString()
  workflow_id?: string;
}

@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TenantReportController {
  constructor(private readonly service: TenantReportService) {}

  @Get('pipeline-funnel')
  @CheckPermissions('read', 'Report')
  async pipelineFunnel(@Query() query: ReportQuery) {
    const result = await this.service.pipelineFunnel(query);
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Get('conversion-rate')
  @CheckPermissions('read', 'Report')
  async conversionRate(@Query() query: ReportQuery) {
    const result = await this.service.conversionRate(query);
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Get('stage-time')
  @CheckPermissions('read', 'Report')
  async stageTime(@Query() query: ReportQuery) {
    const result = await this.service.stageTime(query);
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Get('interaction-volume')
  @CheckPermissions('read', 'Report')
  async interactionVolume(@Query() query: ReportQuery) {
    const result = await this.service.interactionVolume(query);
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Get('party-sources')
  @CheckPermissions('read', 'Report')
  async partySources(@Query() query: ReportQuery) {
    const result = await this.service.partySources(query);
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Get('export')
  @CheckPermissions('export', 'Report')
  async export(@Query() query: ReportQuery) {
    const result = await this.service.requestExport(query);
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }
}
