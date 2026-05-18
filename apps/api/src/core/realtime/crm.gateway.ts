import {
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayInit,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import type { Server, Socket } from 'socket.io';
import type { JwtPayload } from '../auth/jwt.strategy';
import { RoomManagerService } from './room-manager.service';

@WebSocketGateway()
export class CrmGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly roomManager: RoomManagerService,
  ) {}

  afterInit(server: Server): void {
    this.roomManager.setServer(server);
  }

  async handleConnection(socket: Socket): Promise<void> {
    const rawToken = socket.handshake.auth?.token;

    if (!rawToken) {
      socket.disconnect(true);
      return;
    }

    const token = rawToken.replace(/^Bearer\s+/i, '');

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(token);
    } catch {
      socket.disconnect(true);
      return;
    }

    socket.data.userId = payload.sub;
    socket.data.tenantId = payload.tenant_id;

    socket.join(`tenant:${payload.tenant_id}`);
    socket.join(`user:${payload.sub}`);

    for (const assignmentId of payload.assignment_ids) {
      socket.join(`assignment:${assignmentId}`);
    }
  }

  handleDisconnect(_socket: Socket): void {
    // Socket.io auto-cleans rooms on disconnect; nothing extra needed.
  }
}
