import { Injectable } from '@nestjs/common';
import { PlatformPrismaService } from '../../core/tenant/platform-prisma.service';
import { ok, err } from 'neverthrow';

@Injectable()
export class PlatformAuditService {
  constructor(private readonly prisma: PlatformPrismaService) {}

  async writeLog(data: {
    actor_id: string;
    actor_email?: string;
    actor_role: string;
    action: string;
    target_id?: string;
    actor_ip: string;
    user_agent: string;
    details: any;
    reason?: string;
  }) {
    try {
      let email = data.actor_email;
      if (!email) {
        const u = await this.prisma.client.platformUser.findUnique({
          where: { id: data.actor_id },
        });
        email = u?.email || 'unknown@platform.admin';
      }

      const log = await this.prisma.client.platformAuditLog.create({
        data: {
          actor_id: data.actor_id,
          actor_email: email,
          actor_role: data.actor_role,
          action: data.action,
          target_id: data.target_id || null,
          actor_ip: data.actor_ip,
          user_agent: data.user_agent,
          details: data.details || {},
          reason: data.reason || null,
        },
      });
      return ok(log);
    } catch (error: any) {
      return err(error?.message || 'Failed to write audit log');
    }
  }

  async list(query: { cursor?: string; limit?: number }) {
    try {
      const limit = Number(query.limit) || 50;
      const logs = await this.prisma.client.platformAuditLog.findMany({
        orderBy: { created_at: 'desc' },
        take: limit + 1,
        cursor: query.cursor ? { id: query.cursor } : undefined,
        skip: query.cursor ? 1 : 0,
      });

      const hasNext = logs.length > limit;
      const data = hasNext ? logs.slice(0, -1) : logs;
      const nextCursor = hasNext ? data[data.length - 1]?.id : undefined;

      return ok({ data, next_cursor: nextCursor });
    } catch (error: any) {
      return err(error?.message || 'Failed to retrieve audit logs');
    }
  }
}
