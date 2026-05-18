import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let reconnectingCallback: (() => void) | null = null;
let disconnectCallback: (() => void) | null = null;

export function initSocket(token: string): Socket {
  if (socket?.connected) return socket;

  socket = io('/', {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  socket.on('reconnect', () => {
    reconnectingCallback?.();
  });

  socket.on('disconnect', () => {
    disconnectCallback?.();
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

export function onReconnecting(callback: () => void): void {
  reconnectingCallback = callback;
}

export function onDisconnect(callback: () => void): void {
  disconnectCallback = callback;
}

export function subscribe<T>(event: string, handler: (data: T) => void): () => void {
  socket?.on(event, handler);
  return () => {
    socket?.off(event, handler);
  };
}
