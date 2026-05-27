import { Module, Global } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis-client.token';
import { PermissionCacheService } from './permission-cache.service';
import { PermissionsService } from './permissions.service';
import { PermissionsGuard, PlatformPermissionsGuard } from './permissions.guard';
import { DynamicValidatorService } from './dynamic-validator.service';
import { RoleController } from './role.controller';

@Global()
@Module({
  imports: [],
  controllers: [RoleController],
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () => {
        const client = new Redis(process.env['REDIS_URL'] || 'redis://localhost:6379', {
          maxRetriesPerRequest: null,
          lazyConnect: true,
        });
        client.on('error', (err) => {
          console.error('Redis PermissionsModule client error:', err);
        });
        return client;
      },
    },
    PermissionCacheService,
    PermissionsService,
    PermissionsGuard,
    PlatformPermissionsGuard,
    DynamicValidatorService,
  ],
  exports: [PermissionsGuard, PlatformPermissionsGuard, PermissionsService, PermissionCacheService, DynamicValidatorService],
})
export class PermissionsModule {}
