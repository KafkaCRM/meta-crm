import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  NotFoundException,
  InternalServerErrorException,
  UseGuards,
} from '@nestjs/common';
import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { CheckPermissions } from '../permissions/permissions.decorator';
import { AutomationWorkflowService } from './automation-flow.service';

class CreateAutomationWorkflowDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  trigger_event!: string;

  flow_json!: any;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

class UpdateAutomationWorkflowDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  trigger_event?: string;

  @IsOptional()
  flow_json?: any;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

@Controller(['automation-workflows', 'automation-flows'])
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AutomationWorkflowController {
  constructor(private readonly service: AutomationWorkflowService) {}

  @Get()
  @CheckPermissions('read', 'Workflow')
  async list() {
    const result = await this.service.findMany();
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error.message);
    }
    return result.value;
  }

  @Get(':id')
  @CheckPermissions('read', 'Workflow')
  async findOne(@Param('id') id: string) {
    const result = await this.service.findOne(id);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') {
        throw new NotFoundException(result.error.message);
      }
      throw new InternalServerErrorException(result.error.message);
    }
    return result.value;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CheckPermissions('manage', 'Workflow')
  async create(@Body() dto: CreateAutomationWorkflowDto) {
    const result = await this.service.create(dto);
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error.message);
    }
    return result.value;
  }

  @Patch(':id')
  @CheckPermissions('manage', 'Workflow')
  async update(@Param('id') id: string, @Body() dto: UpdateAutomationWorkflowDto) {
    const result = await this.service.update(id, dto);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') {
        throw new NotFoundException(result.error.message);
      }
      throw new InternalServerErrorException(result.error.message);
    }
    return result.value;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @CheckPermissions('manage', 'Workflow')
  async remove(@Param('id') id: string) {
    const result = await this.service.remove(id);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') {
        throw new NotFoundException(result.error.message);
      }
      throw new InternalServerErrorException(result.error.message);
    }
    return { message: 'Automation workflow deleted' };
  }
}
