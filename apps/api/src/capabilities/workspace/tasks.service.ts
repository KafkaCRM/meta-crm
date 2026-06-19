import { Injectable } from '@nestjs/common';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../../core/tenant/tenant-scoped-prisma.service';
import { ClsService } from 'nestjs-cls';
import type { RequestScope } from '../../core/tenant/request-scope.interface';

export type TaskErrorCode = 'NOT_FOUND' | 'QUERY_FAILED';
export interface TaskError { code: TaskErrorCode; message?: string }

export interface TaskListParams {
  cursor?: string; limit?: number; status?: string; priority?: string;
  assignee_id?: string; due_before?: string; due_after?: string; search?: string;
}

export interface CreateTaskData {
  title: string; description?: string; status?: string; priority?: string;
  due_date?: string; assignee_id?: string; related_type?: string; related_id?: string;
}

export interface UpdateTaskData {
  title?: string; description?: string; status?: string; priority?: string;
  due_date?: string; assignee_id?: string;
}

@Injectable()
export class TasksService {
  constructor(private readonly db: TenantScopedPrismaService, private readonly cls: ClsService) {}
  private getTenantId(): string | null { return this.cls.get<RequestScope>('scope')?.tenant_id ?? null; }

  async create(data: CreateTaskData): Promise<Result<any, TaskError>> {
    try {
      const tid = this.getTenantId(); if (!tid) return err({ code: 'QUERY_FAILED', message: 'No tenant' });
      const task = await this.db.getClient().task.create({
        data: {
          tenant_id: tid, title: data.title, description: data.description,
          status: data.status ?? 'todo', priority: data.priority ?? 'medium',
          due_date: data.due_date ? new Date(data.due_date) : undefined,
          assignee_id: data.assignee_id, related_type: data.related_type, related_id: data.related_id,
        } as any,
      });
      return ok(task);
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }

  async list(params: TaskListParams): Promise<Result<{ data: any[]; next_cursor?: string }, TaskError>> {
    try {
      const tid = this.getTenantId(); if (!tid) return err({ code: 'QUERY_FAILED', message: 'No tenant' });
      const where: any = { tenant_id: tid };
      if (params.status) where.status = params.status;
      if (params.priority) where.priority = params.priority;
      if (params.assignee_id) where.assignee_id = params.assignee_id;
      if (params.due_after || params.due_before) {
        where.due_date = {};
        if (params.due_after) where.due_date.gte = new Date(params.due_after);
        if (params.due_before) where.due_date.lte = new Date(params.due_before);
      }
      if (params.search) where.title = { contains: params.search, mode: 'insensitive' };
      const take = (params.limit ?? 20) + 1;
      const items = await this.db.getClient().task.findMany({
        where, take, orderBy: { created_at: 'desc' },
        ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
        include: { assignee: { select: { id: true, name: true } } },
      });
      let next_cursor: string | undefined;
      if (items.length > (params.limit ?? 20)) { next_cursor = items.pop()!.id; }
      return ok({ data: items, next_cursor });
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }

  async get(id: string): Promise<Result<any, TaskError>> {
    try {
      const tid = this.getTenantId(); if (!tid) return err({ code: 'QUERY_FAILED', message: 'No tenant' });
      const task = await this.db.getClient().task.findFirst({ where: { id, tenant_id: tid }, include: { assignee: { select: { id: true, name: true } } } });
      if (!task) return err({ code: 'NOT_FOUND' });
      return ok(task);
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }

  async update(id: string, data: UpdateTaskData): Promise<Result<any, TaskError>> {
    try {
      const tid = this.getTenantId(); if (!tid) return err({ code: 'QUERY_FAILED', message: 'No tenant' });
      const existing = await this.db.getClient().task.findFirst({ where: { id, tenant_id: tid } });
      if (!existing) return err({ code: 'NOT_FOUND' });
      const task = await this.db.getClient().task.update({ where: { id }, data: { ...data, due_date: data.due_date ? new Date(data.due_date) : undefined } as any });
      return ok(task);
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }

  async remove(id: string): Promise<Result<{ message: string }, TaskError>> {
    try {
      const tid = this.getTenantId(); if (!tid) return err({ code: 'QUERY_FAILED', message: 'No tenant' });
      const existing = await this.db.getClient().task.findFirst({ where: { id, tenant_id: tid } });
      if (!existing) return err({ code: 'NOT_FOUND' });
      await this.db.getClient().task.delete({ where: { id } });
      return ok({ message: 'Task deleted' });
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }
}
