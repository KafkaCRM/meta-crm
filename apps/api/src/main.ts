import { serve } from '@hono/node-server';
import { Server as SocketIOServer } from 'socket.io';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { app } from './app';

dotenv.config({ path: resolve(__dirname, '../../../.env') });
dotenv.config();

const port = Number(process.env.PORT) || 3000;

const server = serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`🚀 Meta CRM API running on http://localhost:${info.port}`);
  }
);

// Attach Socket.IO for realtime lead notifications and interactions
const io = new SocketIOServer(server as any, {
  cors: {
    origin: '*',
    credentials: true,
  },
  path: '/socket.io',
});

io.on('connection', (socket) => {
  socket.on('join_tenant', (tenantId: string) => {
    if (tenantId) socket.join(`tenant:${tenantId}`);
  });

  socket.on('join_room', (roomId: string) => {
    if (roomId) socket.join(roomId);
  });
});

export { io };
