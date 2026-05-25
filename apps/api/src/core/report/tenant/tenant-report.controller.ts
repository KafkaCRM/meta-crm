import {
  Controller,
  Get,
  Query,
  UseGuards,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { IsOptional, IsString, IsArray, ArrayMaxSize } from 'class-validator';
import { Transform } from 'class-transformer';
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

  @IsOptional()
  @IsString()
  campaign_id?: string;
}

class CampaignReportQuery extends ReportQuery {
  @IsOptional()
  @IsString()
  vertical_id?: string;

  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}

class CampaignComparisonQuery {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(5)
  @Transform(({ obj, value }) => {
    const rawVal = value ?? obj['campaign_ids[]'] ?? obj['campaign_ids'];
    if (!rawVal) return [];
    if (typeof rawVal === 'string') {
      return [rawVal];
    }
    return rawVal;
  })
  campaign_ids!: string[];
}

class ChannelPerformanceQuery extends ReportQuery {
  @IsOptional()
  @IsString()
  vertical_id?: string;
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

  @Get('campaigns')
  @CheckPermissions('read', 'Report')
  async campaigns(@Query() query: CampaignReportQuery) {
    const limit = query.limit ? parseInt(query.limit, 10) : undefined;
    const result = await this.service.campaigns({
      vertical_id: query.vertical_id,
      channel: query.channel,
      date_from: query.date_from,
      date_to: query.date_to,
      cursor: query.cursor,
      limit,
    });
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Get('campaign-comparison')
  @CheckPermissions('read', 'Report')
  async campaignComparison(@Query() query: CampaignComparisonQuery) {
    if (!query.campaign_ids || query.campaign_ids.length === 0) {
      throw new BadRequestException({
        code: 'INVALID_PARAMS',
        message: 'campaign_ids query param is required',
      });
    }
    const result = await this.service.campaignComparison(query.campaign_ids);
    if (result.isErr()) {
      const error = result.error;
      if (error.code === 'INVALID_PARAMS') {
        throw new BadRequestException(error);
      }
      throw new InternalServerErrorException(error);
    }
    return result.value;
  }

  @Get('channel-performance')
  @CheckPermissions('read', 'Report')
  async channelPerformance(@Query() query: ChannelPerformanceQuery) {
    const result = await this.service.channelPerformance({
      vertical_id: query.vertical_id,
      date_from: query.date_from,
      date_to: query.date_to,
    });
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
