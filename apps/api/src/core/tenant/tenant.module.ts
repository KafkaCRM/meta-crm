import { Global, Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PRISMA_CLIENT } from './prisma-client.token';
import { TenantScopedPrismaService } from './tenant-scoped-prisma.service';
import { PlatformPrismaService } from './platform-prisma.service';
import { TenantScopeGuard } from './tenant-scope.guard';

@Global()
@Module({
  providers: [
    {
      provide: PRISMA_CLIENT,
      useFactory: () => {
        const pool = new Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: { rejectUnauthorized: false },
        });
        const adapter = new PrismaPg(pool);
        return new PrismaClient({ adapter });
      },
    },
    TenantScopedPrismaService,
    PlatformPrismaService,
    TenantScopeGuard,
  ],
  exports: [TenantScopedPrismaService, PlatformPrismaService, TenantScopeGuard],
})
export class TenantModule {}
