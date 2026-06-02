import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { IsString, IsArray } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { CheckPermissions } from '../permissions/permissions.decorator';
import { WorkflowService } from './workflow.service';

class UpdateWorkflowDto {
  @IsString()
  name!: string;

  @IsArray()
  stages!: any[];

  @IsArray()
  transitions!: any[];
}

@Controller('workflows')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WorkflowController {
  constructor(private readonly service: WorkflowService) {}

  @Get()
  @CheckPermissions('read', 'Workflow')
  async list() {
    const result = await this.service.list();
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error.message);
    }
    return result.value;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CheckPermissions('manage', 'Workflow')
  async create(@Body() body: { name: string; entity_type?: string }) {
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

  @Patch(':id')
  @CheckPermissions('manage', 'Workflow')
  async update(@Param('id') id: string, @Body() body: UpdateWorkflowDto) {
    const result = await this.service.update(id, body);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') {
        throw new NotFoundException(result.error.message);
      }
      throw new InternalServerErrorException(result.error.message);
    }
    return result.value;
  }
}
