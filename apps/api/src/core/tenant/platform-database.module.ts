import { Module } from '@nestjs/common';
import { PlatformPrismaService } from './platform-prisma.service';

/**
 * Restricted module that exports the unscoped PrismaClient.
 * Only core/platform modules (TASK-015) and services that
 * explicitly need cross-tenant access should import this.
 */
@Module({
  providers: [PlatformPrismaService],
  exports: [PlatformPrismaService],
})
export class PlatformDatabaseModule {}
