import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  UseGuards,
} from '@nestjs/common';
import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { CheckPermissions } from '../permissions/permissions.decorator';
import { LeadService } from './lead.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { ConvertLeadDto } from './dto/convert-lead.dto';
import { AddToPipelineDto } from './dto/add-to-pipeline.dto';
import { TransitionStageDto } from './dto/transition-stage.dto';

class LeadQueryDto {
  @IsOptional() @IsString() cursor?: string;
  @IsOptional() @IsNumber() @Min(1) @Max(100) limit?: number;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() source?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() assigned_to_id?: string;
  @IsOptional() @IsString() pipeline_definition_id?: string;
  @IsOptional() @IsString() stage?: string;
}

@Controller('leads')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LeadController {
  constructor(private readonly service: LeadService) {}

  @Get()
  @CheckPermissions('read', 'Lead')
  async findAll(@Query() query: LeadQueryDto) {
    const result = await this.service.findMany(query);
    if (result.isErr()) {
      throw new InternalServerErrorException({
        code: result.error.code,
        message: result.error.message,
      });
    }
    return result.value;
  }

  @Get('by-stage')
  @CheckPermissions('read', 'Lead')
  async findByStage(@Query('pipeline_definition_id') pipelineDefinitionId: string) {
    const result = await this.service.findByStage(pipelineDefinitionId);
    if (result.isErr()) {
      throw new BadRequestException({
        code: result.error.code,
        message: result.error.message,
      });
    }
    return result.value;
  }

  @Get(':id')
  @CheckPermissions('read', 'Lead')
  async findOne(@Param('id') id: string) {
    const result = await this.service.findOne(id);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') {
        throw new NotFoundException({
          code: result.error.code,
          message: result.error.message,
        });
      }
      throw new InternalServerErrorException({
        code: result.error.code,
        message: result.error.message,
      });
    }
    return result.value;
  }

  @Post()
  @CheckPermissions('create', 'Lead')
  async create(@Body() dto: CreateLeadDto) {
    const result = await this.service.create(dto);
    if (result.isErr()) {
      throw new BadRequestException({
        code: result.error.code,
        message: result.error.message,
      });
    }
    return result.value;
  }

  @Patch(':id')
  @CheckPermissions('update', 'Lead')
  async update(@Param('id') id: string, @Body() dto: UpdateLeadDto) {
    const result = await this.service.update(id, dto);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') {
        throw new NotFoundException({
          code: result.error.code,
          message: result.error.message,
        });
      }
      throw new BadRequestException({
        code: result.error.code,
        message: result.error.message,
      });
    }
    return result.value;
  }

  @Delete(':id')
  @CheckPermissions('delete', 'Lead')
  async remove(@Param('id') id: string) {
    const result = await this.service.remove(id);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') {
        throw new NotFoundException({
          code: result.error.code,
          message: result.error.message,
        });
      }
      throw new InternalServerErrorException({
        code: result.error.code,
        message: result.error.message,
      });
    }
    return { success: true };
  }

  @Post(':id/pipeline')
  @CheckPermissions('update', 'Lead')
  async addToPipeline(@Param('id') id: string, @Body() dto: AddToPipelineDto) {
    const result = await this.service.addToPipeline(id, dto.pipeline_definition_id);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') {
        throw new NotFoundException({
          code: result.error.code,
          message: result.error.message,
        });
      }
      throw new BadRequestException({
        code: result.error.code,
        message: result.error.message,
      });
    }
    return result.value;
  }

  @Post(':id/transition')
  @CheckPermissions('update', 'Lead')
  async transition(@Param('id') id: string, @Body() dto: TransitionStageDto) {
    const result = await this.service.transitionStage(id, dto.to_stage_id);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') {
        throw new NotFoundException({
          code: result.error.code,
          message: result.error.message,
        });
      }
      throw new BadRequestException({
        code: result.error.code,
        message: result.error.message,
      });
    }
    return result.value;
  }

  @Get(':id/events')
  @CheckPermissions('read', 'Lead')
  async findEvents(
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ) {
    const result = await this.service.findEvents(id, { cursor, limit });
    if (result.isErr()) {
      throw new InternalServerErrorException({
        code: result.error.code,
        message: result.error.message,
      });
    }
    return result.value;
  }

  @Post(':id/convert')
  @CheckPermissions('update', 'Lead')
  async convert(@Param('id') id: string, @Body() dto: ConvertLeadDto) {
    const result = await this.service.convert(id, dto);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') {
        throw new NotFoundException({
          code: result.error.code,
          message: result.error.message,
        });
      }
      if (result.error.code === 'ALREADY_CONVERTED') {
        throw new BadRequestException({
          code: result.error.code,
          message: result.error.message,
        });
      }
      throw new InternalServerErrorException({
        code: result.error.code,
        message: result.error.message,
      });
    }
    return result.value;
  }
}
