import { Injectable } from '@nestjs/common';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../../core/tenant/tenant-scoped-prisma.service';
import { ClsService } from 'nestjs-cls';
import type { RequestScope } from '../../core/tenant/request-scope.interface';

export type NoteErrorCode = 'NOT_FOUND' | 'QUERY_FAILED';
export interface NoteError { code: NoteErrorCode; message?: string }

export interface NoteListParams {
  cursor?: string; limit?: number; search?: string;
  related_type?: string; related_id?: string;
}

export interface CreateNoteData {
  title: string; content?: string; related_type?: string; related_id?: string;
}

export interface UpdateNoteData {
  title?: string; content?: string;
}

@Injectable()
export class NotesService {
  constructor(private readonly db: TenantScopedPrismaService, private readonly cls: ClsService) {}
  private getTenantId(): string | null { return this.cls.get<RequestScope>('scope')?.tenant_id ?? null; }

  async create(data: CreateNoteData): Promise<Result<any, NoteError>> {
    try {
      const tid = this.getTenantId(); if (!tid) return err({ code: 'QUERY_FAILED', message: 'No tenant' });
      const note = await this.db.getClient().note.create({
        data: { tenant_id: tid, title: data.title, content: data.content, related_type: data.related_type, related_id: data.related_id } as any,
      });
      return ok(note);
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }

  async list(params: NoteListParams): Promise<Result<{ data: any[]; next_cursor?: string }, NoteError>> {
    try {
      const tid = this.getTenantId(); if (!tid) return err({ code: 'QUERY_FAILED', message: 'No tenant' });
      const where: any = { tenant_id: tid };
      if (params.related_type) where.related_type = params.related_type;
      if (params.related_id) where.related_id = params.related_id;
      if (params.search) where.title = { contains: params.search, mode: 'insensitive' };
      const take = (params.limit ?? 20) + 1;
      const items = await this.db.getClient().note.findMany({
        where, take, orderBy: { created_at: 'desc' },
        ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      });
      let next_cursor: string | undefined;
      if (items.length > (params.limit ?? 20)) { next_cursor = items.pop()!.id; }
      return ok({ data: items, next_cursor });
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }

  async get(id: string): Promise<Result<any, NoteError>> {
    try {
      const tid = this.getTenantId(); if (!tid) return err({ code: 'QUERY_FAILED', message: 'No tenant' });
      const note = await this.db.getClient().note.findFirst({ where: { id, tenant_id: tid } });
      if (!note) return err({ code: 'NOT_FOUND' });
      return ok(note);
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }

  async update(id: string, data: UpdateNoteData): Promise<Result<any, NoteError>> {
    try {
      const tid = this.getTenantId(); if (!tid) return err({ code: 'QUERY_FAILED', message: 'No tenant' });
      const existing = await this.db.getClient().note.findFirst({ where: { id, tenant_id: tid } });
      if (!existing) return err({ code: 'NOT_FOUND' });
      const note = await this.db.getClient().note.update({ where: { id }, data });
      return ok(note);
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }

  async remove(id: string): Promise<Result<{ message: string }, NoteError>> {
    try {
      const tid = this.getTenantId(); if (!tid) return err({ code: 'QUERY_FAILED', message: 'No tenant' });
      const existing = await this.db.getClient().note.findFirst({ where: { id, tenant_id: tid } });
      if (!existing) return err({ code: 'NOT_FOUND' });
      await this.db.getClient().note.delete({ where: { id } });
      return ok({ message: 'Note deleted' });
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }
}
