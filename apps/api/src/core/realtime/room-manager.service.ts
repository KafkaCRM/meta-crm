import { Injectable } from '@nestjs/common';

@Injectable()
export class RoomManagerService {
  private tenantRooms = new Map<string, Set<string>>();

  joinTenantRoom(socketId: string, tenantId: string): void {
    if (!this.tenantRooms.has(tenantId)) {
      this.tenantRooms.set(tenantId, new Set());
    }
    this.tenantRooms.get(tenantId)!.add(socketId);
  }

  leaveTenantRoom(socketId: string, tenantId: string): void {
    this.tenantRooms.get(tenantId)?.delete(socketId);
  }

  broadcastToTenant(tenantId: string, event: string, data: unknown): void {
    // Socket.io broadcast will be implemented when the gateway is wired up.
    // For now, this is a stub that satisfies the stage transition contract.
  }
}
