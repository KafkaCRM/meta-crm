import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import type { Server, Socket } from 'socket.io';
import { CrmGateway } from './crm.gateway';
import { RoomManagerService } from './room-manager.service';

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function mockSocket(overrides?: Partial<Socket>): Socket {
  return {
    handshake: { auth: { token: 'Bearer valid-jwt' } },
    join: vi.fn(),
    disconnect: vi.fn(),
    data: {},
    ...overrides,
  } as unknown as Socket;
}

function mockJwtService(verify: any): JwtService {
  return { verify } as unknown as JwtService;
}

/* ------------------------------------------------------------------ */
/*  CrmGateway — handleConnection                                       */
/* ------------------------------------------------------------------ */
describe('CrmGateway', () => {
  let roomManager: RoomManagerService;
  let server: Server;

  beforeEach(() => {
    roomManager = new RoomManagerService();
    server = { to: vi.fn().mockReturnValue({ emit: vi.fn() }) } as unknown as Server;
    roomManager.setServer(server);
  });

  describe('handleConnection', () => {
    it('joins tenant, user, and assignment rooms with valid JWT', async () => {
      const jwtService = mockJwtService(
        vi.fn().mockReturnValue({
          sub: 'user-1',
          tenant_id: 'tenant-a',
          assignment_ids: ['assign-1', 'assign-2'],
        }),
      );
      const gateway = new CrmGateway(jwtService, roomManager);
      const socket = mockSocket();

      await gateway.handleConnection(socket);

      expect(socket.join).toHaveBeenCalledWith('tenant:tenant-a');
      expect(socket.join).toHaveBeenCalledWith('user:user-1');
      expect(socket.join).toHaveBeenCalledWith('assignment:assign-1');
      expect(socket.join).toHaveBeenCalledWith('assignment:assign-2');
      expect(socket.disconnect).not.toHaveBeenCalled();
    });

    it('joins only tenant and user rooms when assignment_ids is empty', async () => {
      const jwtService = mockJwtService(
        vi.fn().mockReturnValue({
          sub: 'user-2',
          tenant_id: 'tenant-b',
          assignment_ids: [],
        }),
      );
      const gateway = new CrmGateway(jwtService, roomManager);
      const socket = mockSocket();

      await gateway.handleConnection(socket);

      expect(socket.join).toHaveBeenCalledWith('tenant:tenant-b');
      expect(socket.join).toHaveBeenCalledWith('user:user-2');
      expect(socket.join).toHaveBeenCalledTimes(2);
    });

    it('disconnects when token is missing', async () => {
      const jwtService = mockJwtService(vi.fn());
      const gateway = new CrmGateway(jwtService, roomManager);
      const socket = mockSocket({ handshake: { auth: {} } } as any);

      await gateway.handleConnection(socket);

      expect(socket.disconnect).toHaveBeenCalledWith(true);
      expect(socket.join).not.toHaveBeenCalled();
    });

    it('disconnects when JWT is invalid', async () => {
      const jwtService = mockJwtService(vi.fn().mockImplementation(() => { throw new Error('invalid'); }));
      const gateway = new CrmGateway(jwtService, roomManager);
      const socket = mockSocket();

      await gateway.handleConnection(socket);

      expect(socket.disconnect).toHaveBeenCalledWith(true);
      expect(socket.join).not.toHaveBeenCalled();
    });

    it('disconnects when JWT is expired', async () => {
      const jwtService = mockJwtService(vi.fn().mockImplementation(() => { throw new Error('jwt expired'); }));
      const gateway = new CrmGateway(jwtService, roomManager);
      const socket = mockSocket();

      await gateway.handleConnection(socket);

      expect(socket.disconnect).toHaveBeenCalledWith(true);
      expect(socket.join).not.toHaveBeenCalled();
    });

    it('handles token without Bearer prefix', async () => {
      const jwtService = mockJwtService(
        vi.fn().mockReturnValue({ sub: 'user-3', tenant_id: 'tenant-c', assignment_ids: [] }),
      );
      const gateway = new CrmGateway(jwtService, roomManager);
      const socket = mockSocket({ handshake: { auth: { token: 'raw-jwt' } } } as any);

      await gateway.handleConnection(socket);

      // Strips Bearer prefix — if none, uses raw token
      expect(jwtService.verify).toHaveBeenCalledWith('raw-jwt');
      expect(socket.disconnect).not.toHaveBeenCalled();
    });

    it('stores userId and tenantId on socket.data', async () => {
      const jwtService = mockJwtService(
        vi.fn().mockReturnValue({
          sub: 'user-4',
          tenant_id: 'tenant-d',
          assignment_ids: [],
        }),
      );
      const gateway = new CrmGateway(jwtService, roomManager);
      const socket = mockSocket();

      await gateway.handleConnection(socket);

      expect(socket.data.userId).toBe('user-4');
      expect(socket.data.tenantId).toBe('tenant-d');
    });
  });

  describe('afterInit', () => {
    it('passes server to RoomManagerService', () => {
      const jwtService = mockJwtService(vi.fn());
      const gateway = new CrmGateway(jwtService, roomManager);

      const roomSpy = vi.spyOn(roomManager, 'setServer');
      gateway.afterInit(server);

      expect(roomSpy).toHaveBeenCalledWith(server);
    });
  });
});

/* ------------------------------------------------------------------ */
/*  RoomManagerService                                                  */
/* ------------------------------------------------------------------ */
describe('RoomManagerService', () => {
  let roomManager: RoomManagerService;
  let server: Server;

  beforeEach(() => {
    roomManager = new RoomManagerService();
    server = { to: vi.fn().mockReturnValue({ emit: vi.fn() }) } as unknown as Server;
  });

  it('broadcastToTenant emits to correct room', () => {
    roomManager.setServer(server);
    roomManager.broadcastToTenant('tenant-a', 'case:stage_changed', { case_id: 'c-1' });

    expect(server.to).toHaveBeenCalledWith('tenant:tenant-a');
    expect((server.to as any).mock.results[0].value.emit).toHaveBeenCalledWith(
      'case:stage_changed',
      { case_id: 'c-1' },
    );
  });

  it('broadcastToUser emits to correct room', () => {
    roomManager.setServer(server);
    roomManager.broadcastToUser('user-1', 'interaction:received', { interaction_id: 'i-1' });

    expect(server.to).toHaveBeenCalledWith('user:user-1');
  });

  it('broadcastToAssignment emits to correct room', () => {
    roomManager.setServer(server);
    roomManager.broadcastToAssignment('assign-1', 'case:assigned', { case_id: 'c-2' });

    expect(server.to).toHaveBeenCalledWith('assignment:assign-1');
  });

  it('broadcastToTenant does nothing when server is not set', () => {
    // RoomManagerService without setServer — no crash
    expect(() => {
      roomManager.broadcastToTenant('tenant-a', 'event', {});
    }).not.toThrow();
  });

  it('broadcastToUser does nothing when server is not set', () => {
    expect(() => {
      roomManager.broadcastToUser('user-1', 'event', {});
    }).not.toThrow();
  });
});
