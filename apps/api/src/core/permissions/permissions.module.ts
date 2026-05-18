import { Module } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis-client.token';
import { PermissionCacheService } from './permission-cache.service';
import { PermissionsService } from './permissions.service';
import { PermissionsGuard, PlatformPermissionsGuard } from './permissions.guard';

@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () =>
        new Redis({
          host: process.env['REDIS_HOST'] || 'localhost',
          port: Number(process.env['REDIS_PORT']) || 6379,
          maxRetriesPerRequest: null,
          lazyConnect: true,
        }),
    },
    PermissionCacheService,
    PermissionsService,
    PermissionsGuard,
    PlatformPermissionsGuard,
  ],
  exports: [PermissionsGuard, PlatformPermissionsGuard, PermissionsService, PermissionCacheService],
})
export class PermissionsModule {}
