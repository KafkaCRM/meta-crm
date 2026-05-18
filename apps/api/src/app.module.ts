import { Module } from '@nestjs/common';
import { AuthModule } from './core/auth/auth.module';

@Module({
  imports: [
    AuthModule,
    // Core modules added in TASK-006 through TASK-014
    // Capability modules added in TASK-030+
    // Integration modules added in TASK-016, TASK-017+
    // Platform modules added in TASK-015
  ],
})
export class AppModule {}
