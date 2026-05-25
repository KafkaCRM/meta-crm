import {
  Controller,
  Get,
  Post,
  Patch,
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
import { IsString, IsOptional, IsIn } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { CheckPermissions } from '../permissions/permissions.decorator';
import { CreateVerticalDto } from './dto/create-vertical.dto';
import { UpdateVerticalDto } from './dto/update-vertical.dto';
import { VerticalService } from './vertical.service';

export class UpdateVerticalStatusDto {
  @IsString()
  @IsIn(['active', 'inactive'])
  status!: string;
}

@Controller('verticals')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class VerticalController {
  constructor(private readonly service: VerticalService) {}

  @Get()
  @CheckPermissions('read', 'Vertical')
  async list(
    @Query('brand_id') brandId?: string,
    @Query('status') status?: string,
  ) {
    const result = await this.service.list({ brand_id: brandId, status });
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Get(':id')
  @CheckPermissions('read', 'Vertical')
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

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CheckPermissions('create', 'Vertical')
  async create(@Body() body: CreateVerticalDto) {
    const result = await this.service.create(body);
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Patch(':id')
  @CheckPermissions('update', 'Vertical')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateVerticalDto,
  ) {
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
  @CheckPermissions('manage', 'Vertical')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateVerticalStatusDto,
  ) {
    const result = await this.service.updateStatus(id, body.status);
    if (result.isErr()) {
      const error = result.error;
      if (error.code === 'NOT_FOUND') {
        throw new NotFoundException(error);
      }
      if (error.code === 'VERTICAL_HAS_ACTIVE_CASES') {
        throw new BadRequestException(error);
      }
      throw new InternalServerErrorException(error);
    }
    return result.value;
  }
}
