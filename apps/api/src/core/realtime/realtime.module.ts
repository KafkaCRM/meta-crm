import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CrmGateway } from './crm.gateway';
import { RoomManagerService } from './room-manager.service';

@Module({
  imports: [AuthModule],
  providers: [CrmGateway, RoomManagerService],
  exports: [RoomManagerService],
})
export class RealtimeModule {}
