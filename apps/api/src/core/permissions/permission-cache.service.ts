import { Injectable, Inject, OnModuleDestroy } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis-client.token';

const CACHE_TTL = 300;

@Injectable()
export class PermissionCacheService implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onModuleDestroy() {
    try {
      await this.redis.quit();
    } catch (err) {
      console.error('PermissionCacheService.onModuleDestroy failed:', err);
    }
  }

  async getRules(userId: string, tenantId: string): Promise<unknown[] | null> {
    try {
      const raw = await this.redis.get(`perm:${userId}:${tenantId}`);
      if (!raw) return null;
      return JSON.parse(raw) as unknown[];
    } catch (err) {
      console.error('PermissionCacheService.getRules failed:', err);
      return null;
    }
  }

  async setRules(userId: string, tenantId: string, rules: unknown[]): Promise<void> {
    try {
      await this.redis.set(`perm:${userId}:${tenantId}`, JSON.stringify(rules), 'EX', CACHE_TTL);
    } catch (err) {
      console.error('PermissionCacheService.setRules failed:', err);
    }
  }

  async invalidate(userId: string, tenantId: string): Promise<void> {
    try {
      await this.redis.del(`perm:${userId}:${tenantId}`);
    } catch (err) {
      console.error('PermissionCacheService.invalidate failed:', err);
    }
  }
}
