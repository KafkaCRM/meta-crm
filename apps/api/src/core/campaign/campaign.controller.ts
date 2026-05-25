import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { IsString, IsIn, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { CheckPermissions } from '../permissions/permissions.decorator';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { CampaignService } from './campaign.service';

export class UpdateCampaignStatusDto {
  @IsString()
  @IsIn(['draft', 'active', 'paused', 'completed'])
  status!: string;
}

@Controller('campaigns')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CampaignController {
  constructor(private readonly service: CampaignService) {}

  @Get()
  @CheckPermissions('read', 'Campaign')
  async list(
    @Query('vertical_id') verticalId?: string,
    @Query('status') status?: string,
    @Query('channel') channel?: string,
  ) {
    const result = await this.service.list({ vertical_id: verticalId, status, channel });
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Get('stats')
  @CheckPermissions('read', 'Report')
  async getAggregateStats() {
    const result = await this.service.getAggregateStats();
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Get(':id')
  @CheckPermissions('read', 'Campaign')
  async findOne(@Param('id') id: string) {
    const result = await this.service.findOne(id);
    if (result.isErr()) {
      const error = result.error;
      if (error.code === 'NOT_FOUND') {
        throw new NotFoundException(error);
      }
      throw new InternalServerErrorException(error);
    }
    return result.value;
  }

  @Get(':id/leads')
  @CheckPermissions('read', 'Campaign')
  async getLeads(
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    const result = await this.service.getLeads(id, { cursor, limit: parsedLimit });
    if (result.isErr()) {
      const error = result.error;
      if (error.code === 'NOT_FOUND') {
        throw new NotFoundException(error);
      }
      throw new InternalServerErrorException(error);
    }
    return result.value;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CheckPermissions('create', 'Campaign')
  async create(@Body() body: CreateCampaignDto) {
    const result = await this.service.create(body);
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Patch(':id')
  @CheckPermissions('update', 'Campaign')
  async update(@Param('id') id: string, @Body() body: UpdateCampaignDto) {
    const result = await this.service.update(id, body);
    if (result.isErr()) {
      const error = result.error;
      if (error.code === 'NOT_FOUND') {
        throw new NotFoundException(error);
      }
      throw new InternalServerErrorException(error);
    }
    return result.value;
  }

  @Patch(':id/status')
  @CheckPermissions('update', 'Campaign')
  async updateStatus(@Param('id') id: string, @Body() body: UpdateCampaignStatusDto) {
    const result = await this.service.updateStatus(id, body.status);
    if (result.isErr()) {
      const error = result.error;
      if (error.code === 'NOT_FOUND') {
        throw new NotFoundException(error);
      }
      throw new InternalServerErrorException(error);
    }
    return result.value;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckPermissions('delete', 'Campaign')
  async delete(@Param('id') id: string) {
    const result = await this.service.delete(id);
    if (result.isErr()) {
      const error = result.error;
      if (error.code === 'NOT_FOUND') {
        throw new NotFoundException(error);
      }
      if (error.code === 'CAMPAIGN_HAS_LEADS') {
        throw new BadRequestException(error);
      }
      throw new InternalServerErrorException(error);
    }
  }
}
