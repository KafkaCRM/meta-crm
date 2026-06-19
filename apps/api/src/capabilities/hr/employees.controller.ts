import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, InternalServerErrorException, NotFoundException, ConflictException } from '@nestjs/common';
import { IsOptional, IsString, IsNumber, IsDateString, Min, Max } from 'class-validator';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/permissions/permissions.guard';
import { CheckPermissions } from '../../core/permissions/permissions.decorator';
import { CapabilityGuard } from '../../core/capability/capability.guard';
import { RequireCapability } from '../../core/capability/capability.decorator';
import { EmployeesService } from './employees.service';

class CreateEmpDto { @IsString() employee_code!: string; @IsOptional() @IsString() user_id?: string; @IsOptional() @IsString() department_id?: string; @IsOptional() @IsString() designation?: string; @IsOptional() @IsDateString() joining_date?: string; @IsOptional() @IsNumber() salary?: number; }
class UpdateEmpDto { @IsOptional() @IsString() employee_code?: string; @IsOptional() @IsString() department_id?: string; @IsOptional() @IsString() designation?: string; @IsOptional() @IsDateString() joining_date?: string; @IsOptional() @IsNumber() salary?: number; @IsOptional() @IsString() status?: string; }
class EmpListQuery { @IsOptional() @IsString() department_id?: string; @IsOptional() @IsString() status?: string; @IsOptional() @IsString() search?: string; @IsOptional() @IsString() cursor?: string; @IsOptional() @IsNumber() @Min(1) @Max(100) limit?: number; }

@Controller('employees')
@RequireCapability('capability/hr')
@UseGuards(JwtAuthGuard, CapabilityGuard, PermissionsGuard)
export class EmployeesController {
  constructor(private readonly service: EmployeesService) {}
  @Post() @CheckPermissions('create', 'Case') async create(@Body() dto: CreateEmpDto) { const r = await this.service.create(dto); if (r.isErr()) { if (r.error.code === 'DUPLICATE_CODE') throw new ConflictException(r.error.message); throw new InternalServerErrorException(r.error); } return r.value; }
  @Get() @CheckPermissions('read', 'Case') async findAll(@Query() q: EmpListQuery) { const r = await this.service.findAll(q); if (r.isErr()) throw new InternalServerErrorException(r.error); return r.value; }
  @Get(':id') @CheckPermissions('read', 'Case') async findOne(@Param('id') id: string) { const r = await this.service.findOne(id); if (r.isErr()) { if (r.error.code === 'NOT_FOUND') throw new NotFoundException(); throw new InternalServerErrorException(r.error); } return r.value; }
  @Patch(':id') @CheckPermissions('update', 'Case') async update(@Param('id') id: string, @Body() dto: UpdateEmpDto) { const r = await this.service.update(id, dto); if (r.isErr()) { if (r.error.code === 'DUPLICATE_CODE') throw new ConflictException(r.error.message); throw new InternalServerErrorException(r.error); } return r.value; }
  @Delete(':id') @CheckPermissions('delete', 'Case') async remove(@Param('id') id: string) { const r = await this.service.remove(id); if (r.isErr()) throw new InternalServerErrorException(r.error); }
}
