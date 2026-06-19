import { Controller, Get, Post, Param, Body, Query, UseGuards, InternalServerErrorException, NotFoundException, ConflictException } from '@nestjs/common';
import { IsOptional, IsString, IsNumber, IsDateString, Min, Max } from 'class-validator';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/permissions/permissions.guard';
import { CheckPermissions } from '../../core/permissions/permissions.decorator';
import { CapabilityGuard } from '../../core/capability/capability.guard';
import { RequireCapability } from '../../core/capability/capability.decorator';
import { LeaveRequestsService } from './leave-requests.service';
import { ClsService } from 'nestjs-cls';
import type { RequestScope } from '../../core/tenant/request-scope.interface';

class CreateLRDto { @IsString() employee_id!: string; @IsString() leave_type_id!: string; @IsDateString() from_date!: string; @IsDateString() to_date!: string; @IsOptional() @IsString() reason?: string; }
class LRListQuery { @IsOptional() @IsString() employee_id?: string; @IsOptional() @IsString() status?: string; @IsOptional() @IsDateString() from_date?: string; @IsOptional() @IsDateString() to_date?: string; @IsOptional() @IsString() cursor?: string; @IsOptional() @IsNumber() @Min(1) @Max(100) limit?: number; }

@Controller('leave-requests')
@RequireCapability('capability/hr')
@UseGuards(JwtAuthGuard, CapabilityGuard, PermissionsGuard)
export class LeaveRequestsController {
  constructor(private readonly service: LeaveRequestsService, private readonly cls: ClsService) {}
  @Post() @CheckPermissions('create', 'Case') async create(@Body() dto: CreateLRDto) { const r = await this.service.create(dto); if (r.isErr()) { if (r.error.code === 'OVERLAP') throw new ConflictException(r.error.message); throw new InternalServerErrorException(r.error); } return r.value; }
  @Get() @CheckPermissions('read', 'Case') async findAll(@Query() q: LRListQuery) { const r = await this.service.findAll(q); if (r.isErr()) throw new InternalServerErrorException(r.error); return r.value; }
  @Get(':id') @CheckPermissions('read', 'Case') async findOne(@Param('id') id: string) { const r = await this.service.findOne(id); if (r.isErr()) { if (r.error.code === 'NOT_FOUND') throw new NotFoundException(); throw new InternalServerErrorException(r.error); } return r.value; }
  @Post(':id/approve') @CheckPermissions('update', 'Case') async approve(@Param('id') id: string) { const userId = this.cls.get<RequestScope>('scope')?.user_id ?? ''; const r = await this.service.approve(id, userId); if (r.isErr()) throw new InternalServerErrorException(r.error); return r.value; }
  @Post(':id/reject') @CheckPermissions('update', 'Case') async reject(@Param('id') id: string) { const r = await this.service.reject(id); if (r.isErr()) throw new InternalServerErrorException(r.error); return r.value; }
}
