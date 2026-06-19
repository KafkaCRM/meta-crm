import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { IsOptional, IsString, Min, Max, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/permissions/permissions.guard';
import { CheckPermissions } from '../../core/permissions/permissions.decorator';
import { CapabilityGuard } from '../../core/capability/capability.guard';
import { RequireCapability } from '../../core/capability/capability.decorator';
import { NotesService } from './notes.service';

class CreateNoteDto { @IsString() title!: string; @IsOptional() @IsString() content?: string; @IsOptional() @IsString() related_type?: string; @IsOptional() @IsString() related_id?: string; }
class UpdateNoteDto { @IsOptional() @IsString() title?: string; @IsOptional() @IsString() content?: string; }
class NoteListQuery { @IsOptional() @IsString() cursor?: string; @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(100) limit?: number; @IsOptional() @IsString() search?: string; @IsOptional() @IsString() related_type?: string; @IsOptional() @IsString() related_id?: string; }

@Controller('notes')
@RequireCapability('capability/workspace')
@UseGuards(JwtAuthGuard, CapabilityGuard, PermissionsGuard)
export class NotesController {
  constructor(private readonly service: NotesService) {}

  @Post() @CheckPermissions('create', 'Case')
  async create(@Body() dto: CreateNoteDto) { const r = await this.service.create(dto); if (r.isErr()) throw new InternalServerErrorException(r.error); return r.value; }

  @Get() @CheckPermissions('read', 'Case')
  async list(@Query() q: NoteListQuery) { const r = await this.service.list(q); if (r.isErr()) throw new InternalServerErrorException(r.error); return r.value; }

  @Get(':id') @CheckPermissions('read', 'Case')
  async get(@Param('id') id: string) { const r = await this.service.get(id); if (r.isErr()) { if (r.error.code === 'NOT_FOUND') throw new NotFoundException(); throw new InternalServerErrorException(r.error); } return r.value; }

  @Patch(':id') @CheckPermissions('update', 'Case')
  async update(@Param('id') id: string, @Body() dto: UpdateNoteDto) { const r = await this.service.update(id, dto); if (r.isErr()) { if (r.error.code === 'NOT_FOUND') throw new NotFoundException(); throw new InternalServerErrorException(r.error); } return r.value; }

  @Delete(':id') @CheckPermissions('delete', 'Case')
  async remove(@Param('id') id: string) { const r = await this.service.remove(id); if (r.isErr()) { if (r.error.code === 'NOT_FOUND') throw new NotFoundException(); throw new InternalServerErrorException(r.error); } return r.value; }
}
