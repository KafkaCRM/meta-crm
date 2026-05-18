import {
  Controller,
  Get,
  Query,
  UseGuards,
  InternalServerErrorException,
} from '@nestjs/common';
import { IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/permissions/permissions.guard';
import { CheckPermissions } from '../../core/permissions/permissions.decorator';
import { EnrollmentService } from './enrollment.service';

class EnrollmentListQuery {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  stage?: string;
}

@Controller('enrollments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EnrollmentController {
  constructor(private readonly service: EnrollmentService) {}

  @Get()
  @CheckPermissions('read', 'Case')
  async list(@Query() query: EnrollmentListQuery) {
    const result = await this.service.listEnrollments({
      ...(query.cursor !== undefined && { cursor: query.cursor }),
      ...(query.limit !== undefined && { limit: query.limit }),
      ...(query.stage !== undefined && { stage: query.stage }),
    });
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Get('stats')
  @CheckPermissions('read', 'Report')
  async stats() {
    const result = await this.service.getStats();
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }
}
