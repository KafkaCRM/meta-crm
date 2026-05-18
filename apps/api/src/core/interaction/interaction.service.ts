import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';
import { CreateInteractionDto } from './dto/create-interaction.dto';
import type {
  TimelineItem,
  InteractionListResponse,
  ThreadObject,
  InteractionDto,
} from './dto/interaction-response.dto';
import type { RequestScope } from '../tenant/request-scope.interface';

export type InteractionErrorCode = 'NOT_FOUND' | 'PARTY_NOT_FOUND' | 'CASE_NOT_FOUND';

export interface InteractionError {
  code: InteractionErrorCode;
  message?: string;
}

@Injectable()
export class InteractionService {
  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly cls: ClsService,
  ) {}

  async findTimeline(params: {
    party_id?: string;
    case_id?: string;
    cursor?: string;
    limit?: number;
  }): Promise<Result<InteractionListResponse, InteractionError>> {
    const limit = Math.min(params.limit ?? 50, 100);

    const interactionWhere: Record<string, unknown> = {};
    if (params.party_id) interactionWhere.party_id = params.party_id;
    if (params.case_id) interactionWhere.case_id = params.case_id;

    const interactions = await this.db.getClient().interaction.findMany({
      where: interactionWhere,
      orderBy: { created_at: 'desc' },
      take: Math.max(limit * 3, 200),
    });

    const pinned = interactions.filter((i: any) => i.is_pinned);

    const grouped = new Map<string, any[]>();
    const standalone: any[] = [];
    for (const i of interactions) {
      if (i.is_pinned) continue;
      if (i.thread_id) {
        const existing = grouped.get(i.thread_id);
        if (existing) {
          existing.push(i);
        } else {
          grouped.set(i.thread_id, [i]);
        }
      } else {
        standalone.push(i);
      }
    }

    const threadItems: TimelineItem[] = [];
    for (const [threadId, msgs] of grouped) {
      const sorted = msgs.sort((a: any, b: any) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      const last = sorted[sorted.length - 1]!;
      const preview = last.content.length > 80
        ? last.content.slice(0, 80) + '...'
        : last.content;
      threadItems.push({
        kind: 'thread',
        data: {
          thread_id: threadId,
          channel: last.channel,
          last_message_preview: preview,
          message_count: sorted.length,
          last_at: last.created_at.toISOString(),
          messages: sorted.map(this.toInteractionDto),
        },
      });
    }

    let caseEvents: any[] = [];
    if (params.case_id) {
      caseEvents = await this.db.getClient().caseEvent.findMany({
        where: { case_id: params.case_id },
        orderBy: { occurred_at: 'desc' },
        take: Math.max(limit * 3, 200),
      });
    }

    const standaloneItems: TimelineItem[] = [
      ...standalone.map((i) => ({
        kind: 'interaction' as const,
        data: this.toInteractionDto(i),
      })),
      ...caseEvents.map((e) => ({
        kind: 'system_event' as const,
        data: {
          id: e.id,
          case_id: e.case_id,
          event_type: e.event_type,
          from_stage: e.from_stage,
          to_stage: e.to_stage,
          actor_id: e.actor_id,
          actor_type: e.actor_type,
          payload: e.payload as Record<string, unknown>,
          occurred_at: e.occurred_at.toISOString(),
        },
      })),
      ...threadItems,
    ];

    const merged = standaloneItems.sort((a, b) => {
      const tA = this.getItemTimestamp(a);
      const tB = this.getItemTimestamp(b);
      return tB - tA;
    });

    const pinnedItems: TimelineItem[] = pinned.map((i) => ({
      kind: 'interaction' as const,
      data: this.toInteractionDto(i),
    }));
    pinnedItems.sort((a, b) => {
      const tA = new Date((a.data as any).created_at ?? (a.data as any).last_at ?? 0).getTime();
      const tB = new Date((b.data as any).created_at ?? (b.data as any).last_at ?? 0).getTime();
      return tB - tA;
    });

    const allItems: TimelineItem[] = [...pinnedItems, ...merged];

    let cursorIndex = 0;
    if (params.cursor) {
      const cursorDate = new Date(params.cursor).getTime();
      const idx = allItems.findIndex((item) => {
        const ts = this.getItemTimestamp(item);
        return ts < cursorDate;
      });
      cursorIndex = idx >= 0 ? idx : allItems.length;
    }

    const sliced = allItems.slice(cursorIndex, cursorIndex + limit);

    const nextCursor = sliced.length === limit && cursorIndex + limit < allItems.length
      ? new Date(this.getItemTimestamp(sliced[sliced.length - 1]!)).toISOString()
      : null;

    return ok({ items: sliced, next_cursor: nextCursor });
  }

  async create(dto: CreateInteractionDto): Promise<Result<InteractionDto, InteractionError>> {
    const party = await this.db.getClient().party.findUnique({
      where: { id: dto.party_id },
    });
    if (!party) {
      return err({ code: 'PARTY_NOT_FOUND', message: 'Party not found' });
    }

    if (dto.case_id) {
      const caseRecord = await this.db.getClient().case.findUnique({
        where: { id: dto.case_id },
      });
      if (!caseRecord) {
        return err({ code: 'CASE_NOT_FOUND', message: 'Case not found' });
      }
    }

    const interaction = await this.db.getClient().interaction.create({
      data: {
        party_id: dto.party_id,
        case_id: dto.case_id,
        channel: dto.channel,
        direction: dto.direction,
        content: dto.content,
        thread_id: dto.thread_id,
        metadata: (dto.metadata ?? {}) as any,
      } as any,
    });

    return ok(this.toInteractionDto(interaction));
  }

  async pin(id: string, userId: string): Promise<Result<InteractionDto, InteractionError>> {
    const interaction = await this.db.getClient().interaction.findUnique({
      where: { id },
    });
    if (!interaction) {
      return err({ code: 'NOT_FOUND', message: 'Interaction not found' });
    }

    const updated = await this.db.getClient().interaction.update({
      where: { id },
      data: { is_pinned: true, pinned_by: userId },
    });

    return ok(this.toInteractionDto(updated));
  }

  async unpin(id: string): Promise<Result<InteractionDto, InteractionError>> {
    const interaction = await this.db.getClient().interaction.findUnique({
      where: { id },
    });
    if (!interaction) {
      return err({ code: 'NOT_FOUND', message: 'Interaction not found' });
    }

    const updated = await this.db.getClient().interaction.update({
      where: { id },
      data: { is_pinned: false, pinned_by: null },
    });

    return ok(this.toInteractionDto(updated));
  }

  private getItemTimestamp(item: TimelineItem): number {
    switch (item.kind) {
      case 'interaction':
        return new Date(item.data.created_at).getTime();
      case 'thread':
        return new Date(item.data.last_at).getTime();
      case 'system_event':
        return new Date(item.data.occurred_at).getTime();
    }
  }

  private toInteractionDto(i: any): InteractionDto {
    return {
      id: i.id,
      party_id: i.party_id,
      case_id: i.case_id,
      channel: i.channel,
      direction: i.direction,
      content: i.content,
      thread_id: i.thread_id,
      is_pinned: i.is_pinned,
      pinned_by: i.pinned_by,
      metadata: i.metadata as Record<string, unknown>,
      created_at: i.created_at instanceof Date ? i.created_at.toISOString() : i.created_at,
    };
  }
}
