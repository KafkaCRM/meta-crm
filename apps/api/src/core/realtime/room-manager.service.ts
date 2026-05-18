import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';

@Injectable()
export class RoomManagerService {
  private server: Server | null = null;

  setServer(server: Server): void {
    this.server = server;
  }

  broadcastToTenant(tenantId: string, event: string, payload: unknown): void {
    if (!this.server) return;
    this.server.to(`tenant:${tenantId}`).emit(event, payload);
  }

  broadcastToUser(userId: string, event: string, payload: unknown): void {
    if (!this.server) return;
    this.server.to(`user:${userId}`).emit(event, payload);
  }

  broadcastToAssignment(assignmentId: string, event: string, payload: unknown): void {
    if (!this.server) return;
    this.server.to(`assignment:${assignmentId}`).emit(event, payload);
  }
}
