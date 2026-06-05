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

class LeadQueryDto {
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
  status?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  assigned_to_id?: string;
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
