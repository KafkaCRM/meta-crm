import { Module } from '@nestjs/common';
import { AuthModule } from './core/auth/auth.module';
import { TenantModule } from './core/tenant/tenant.module';
import { PartyModule } from './core/party/party.module';

@Module({
  imports: [
    TenantModule,
    AuthModule,
    PartyModule,
    // Core modules added in TASK-006 through TASK-014
    // Capability modules added in TASK-030+
    // Integration modules added in TASK-016, TASK-017+
    // Platform modules added in TASK-015
  ],
})
export class AppModule {}
