import { Injectable, Inject, OnModuleDestroy } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis-client.token';

const CACHE_TTL = 300;

@Injectable()
export class PermissionCacheService implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onModuleDestroy() {
    await this.redis.quit();
  }

  async getRules(userId: string, tenantId: string): Promise<unknown[] | null> {
    const raw = await this.redis.get(`perm:${userId}:${tenantId}`);
    if (!raw) return null;
    return JSON.parse(raw) as unknown[];
  }

  async setRules(userId: string, tenantId: string, rules: unknown[]): Promise<void> {
    await this.redis.set(`perm:${userId}:${tenantId}`, JSON.stringify(rules), 'EX', CACHE_TTL);
  }

  async invalidate(userId: string, tenantId: string): Promise<void> {
    await this.redis.del(`perm:${userId}:${tenantId}`);
  }
}
