import {
  Controller,
  Get,
  Query,
  UseGuards,
  InternalServerErrorException,
} from '@nestjs/common';
import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PlatformPermissionsGuard } from '../../core/permissions/permissions.guard';
import { CheckPlatformPermissions } from '../../core/permissions/permissions.decorator';
import { PlatformAuditService } from './platform-audit.service';

class AuditLogsQuery {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

@Controller('platform/audit-logs')
@UseGuards(JwtAuthGuard, PlatformPermissionsGuard)
export class PlatformAuditController {
  constructor(private readonly service: PlatformAuditService) {}

  @Get()
  @CheckPlatformPermissions('read', 'PlatformReport')
  async list(@Query() query: AuditLogsQuery) {
    const result = await this.service.list(query);
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }
}
