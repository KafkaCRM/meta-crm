import { Global, Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PRISMA_CLIENT } from './prisma-client.token';
import { TenantScopedPrismaService } from './tenant-scoped-prisma.service';
import { PlatformPrismaService } from './platform-prisma.service';
import { TenantScopeGuard } from './tenant-scope.guard';

@Global()
@Module({
  providers: [
    {
      provide: PRISMA_CLIENT,
      useFactory: () => new PrismaClient(),
    },
    TenantScopedPrismaService,
    PlatformPrismaService,
    TenantScopeGuard,
  ],
  exports: [TenantScopedPrismaService, PlatformPrismaService, TenantScopeGuard],
})
export class TenantModule {}
