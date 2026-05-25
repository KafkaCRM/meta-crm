import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: any;

  async connectToRedis(): Promise<void> {
    const redisUrl = process.env['REDIS_URL'] || 'redis://localhost:6379';
    
    const redisOptions = {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };

    const pubClient = new Redis(redisUrl, redisOptions);
    const subClient = new Redis(redisUrl, redisOptions);

    pubClient.on('error', (err) => {
      console.error('Redis IoAdapter pubClient error:', err);
    });

    subClient.on('error', (err) => {
      console.error('Redis IoAdapter subClient error:', err);
    });

    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  override createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}
