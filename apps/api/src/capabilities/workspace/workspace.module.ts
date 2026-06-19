import { Module } from '@nestjs/common';
import { TenantModule } from '../../core/tenant/tenant.module';
import { CapabilityModule } from '../../core/capability/capability.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';
import { InboxController } from './inbox.controller';
import { InboxService } from './inbox.service';

@Module({
  imports: [TenantModule, CapabilityModule],
  controllers: [TasksController, NotesController, InboxController],
  providers: [TasksService, NotesService, InboxService],
  exports: [TasksService, NotesService, InboxService],
})
export class WorkspaceModule {}
