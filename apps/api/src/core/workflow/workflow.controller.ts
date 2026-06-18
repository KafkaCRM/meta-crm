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
import { IsString, IsArray, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { CheckPermissions } from '../permissions/permissions.decorator';
import { WorkflowService } from './workflow.service';

class UpdatePipelineDto {
  @IsString()
  name!: string;

  @IsArray()
  stages!: any[];

  @IsArray()
  transitions!: any[];
}

@Controller(['pipelines', 'workflows'])
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WorkflowController {
  constructor(private readonly service: WorkflowService) {}

  @Get()
  @CheckPermissions('read', 'Workflow')
  async list(
    @Query('branch_id') branchId?: string,
    @Query('vertical_id') verticalId?: string,
  ) {
    const result = await this.service.list({ branch_id: branchId, vertical_id: verticalId });
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error.message);
    }
    return result.value;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CheckPermissions('manage', 'Workflow')
  async create(@Body() body: { name: string; entity_type?: string; vertical_id?: string }) {
    const result = await this.service.create(body);
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error.message);
    }
    return result.value;
  }

  @Get('default')
  @CheckPermissions('read', 'Workflow')
  async getDefault() {
    const result = await this.service.getDefault();
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error.message);
    }
    return result.value;
  }

  @Get(':id/stages')
  @CheckPermissions('read', 'Workflow')
  async getStages(@Param('id') id: string) {
    const result = await this.service.getStages(id);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') {
        throw new NotFoundException(result.error.message);
      }
      throw new InternalServerErrorException(result.error.message);
    }
    return result.value;
  }

  @Patch(':id')
  @CheckPermissions('manage', 'Workflow')
  async update(@Param('id') id: string, @Body() body: UpdatePipelineDto) {
    const result = await this.service.update(id, body);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') {
        throw new NotFoundException(result.error.message);
      }
      throw new InternalServerErrorException(result.error.message);
    }
    return result.value;
  }

  @Delete(':id')
  @CheckPermissions('manage', 'Workflow')
  async delete(@Param('id') id: string) {
    const result = await this.service.delete(id);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') {
        throw new NotFoundException(result.error.message);
      }
      if (result.error.code === 'VALIDATION_ERROR') {
        throw new BadRequestException(result.error.message);
      }
      throw new InternalServerErrorException(result.error.message);
    }
    return { success: true };
  }
}
