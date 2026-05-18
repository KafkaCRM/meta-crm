import {
  Controller,
  Get,
  Query,
  UseGuards,
  InternalServerErrorException,
} from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PlatformPermissionsGuard } from '../../permissions/permissions.guard';
import { CheckPlatformPermissions } from '../../permissions/permissions.decorator';
import { PlatformReportService } from './platform-report.service';
import type { PlatformReportParams } from './platform-report.service';

class PlatformReportQuery implements PlatformReportParams {
  @IsOptional()
  @IsString()
  date_from?: string;

  @IsOptional()
  @IsString()
  date_to?: string;
}

@Controller('platform/reports')
@UseGuards(JwtAuthGuard, PlatformPermissionsGuard)
export class PlatformReportController {
  constructor(private readonly service: PlatformReportService) {}

  @Get('tenant-count')
  @CheckPlatformPermissions('read', 'PlatformReport')
  async tenantCount() {
    const result = await this.service.tenantCount();
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Get('mau')
  @CheckPlatformPermissions('read', 'PlatformReport')
  async mau(@Query() query: PlatformReportQuery) {
    const result = await this.service.mau(query);
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Get('cases-per-day')
  @CheckPlatformPermissions('read', 'PlatformReport')
  async casesPerDay(@Query() query: PlatformReportQuery) {
    const result = await this.service.casesPerDay(query);
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Get('plugin-usage')
  @CheckPlatformPermissions('read', 'PlatformReport')
  async pluginUsage() {
    const result = await this.service.pluginUsage();
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }
}
