import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IsString, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { CheckPermissions } from '../permissions/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestScope } from '../tenant/request-scope.interface';
import { BranchService } from './branch.service';

class CreateBranchDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;
}

class UpdateBranchDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;
}

@Controller('branches')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BranchController {
  constructor(private readonly service: BranchService) {}

  @Get()
  @CheckPermissions('read', 'Branch')
  async list(@CurrentUser() user: RequestScope) {
    return this.service.list(user.tenant_id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CheckPermissions('manage', 'Branch')
  async create(@CurrentUser() user: RequestScope, @Body() body: CreateBranchDto) {
    return this.service.create(user.tenant_id, body);
  }

  @Patch(':id')
  @CheckPermissions('manage', 'Branch')
  async update(
    @CurrentUser() user: RequestScope,
    @Param('id') id: string,
    @Body() body: UpdateBranchDto,
  ) {
    return this.service.update(user.tenant_id, id, body);
  }

  @Delete(':id')
  @CheckPermissions('manage', 'Branch')
  async remove(@CurrentUser() user: RequestScope, @Param('id') id: string) {
    return this.service.remove(user.tenant_id, id);
  }
}
