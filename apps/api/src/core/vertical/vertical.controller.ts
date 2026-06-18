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
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { CheckPermissions } from '../permissions/permissions.decorator';
import { CreateVerticalDto } from './dto/create-vertical.dto';
import { UpdateVerticalDto } from './dto/update-vertical.dto';
import { VerticalService } from './vertical.service';
import { ClsService } from 'nestjs-cls';
import type { RequestScope } from '../tenant/request-scope.interface';

@Controller('verticals')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class VerticalController {
  constructor(
    private readonly service: VerticalService,
    private readonly cls: ClsService,
  ) {}

  private get scope(): RequestScope {
    return this.cls.get<RequestScope>('scope')!;
  }

  @Get()
  @CheckPermissions('read', 'Vertical')
  async list(@Query('branch_id') branchId?: string) {
    const result = await this.service.list(this.scope.tenant_id, branchId);
    return result;
  }

  @Get(':id')
  @CheckPermissions('read', 'Vertical')
  async findOne(@Param('id') id: string) {
    try {
      return await this.service.findOne(this.scope.tenant_id, id);
    } catch (e: unknown) {
      if (e instanceof NotFoundException) throw e;
      throw new InternalServerErrorException('Failed to retrieve vertical');
    }
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CheckPermissions('create', 'Vertical')
  async create(@Body() body: CreateVerticalDto) {
    try {
      return await this.service.create(this.scope.tenant_id, body);
    } catch (e: unknown) {
      throw new InternalServerErrorException('Failed to create vertical');
    }
  }

  @Patch(':id')
  @CheckPermissions('update', 'Vertical')
  async update(@Param('id') id: string, @Body() body: UpdateVerticalDto) {
    try {
      return await this.service.update(this.scope.tenant_id, id, body);
    } catch (e: unknown) {
      if (e instanceof NotFoundException) throw e;
      throw new InternalServerErrorException('Failed to update vertical');
    }
  }
}
