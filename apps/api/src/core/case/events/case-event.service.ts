import { Injectable } from '@nestjs/common';
import { TenantScopedPrismaService } from '../../tenant/tenant-scoped-prisma.service';
import { CaseEventType } from './case-event.types';

interface WriteEventInput {
  case_id: string;
  event_type: CaseEventType | string;
  from_stage?: string;
  to_stage?: string;
  actor_id: string;
  actor_type: string;
  payload?: Record<string, unknown>;
}

@Injectable()
export class CaseEventService {
  constructor(private readonly db: TenantScopedPrismaService) {}

  async write(input: WriteEventInput): Promise<void> {
    await this.db.getClient().caseEvent.create({
      data: {
        case_id: input.case_id,
        event_type: input.event_type,
        from_stage: input.from_stage,
        to_stage: input.to_stage,
        actor_id: input.actor_id,
        actor_type: input.actor_type,
        payload: (input.payload ?? {}) as any,
      } as any,
    });
  }
}
