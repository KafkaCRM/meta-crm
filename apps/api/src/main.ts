import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';
import { AppModule } from './app.module';
import { SafeValidationPipe } from './core/auth/safe-validation.pipe';
import { RedisIoAdapter } from './core/realtime/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  await app.register(fastifyCookie as any, {
    secret: process.env['COOKIE_SECRET'] || 'secure-cookie-secret-change-in-production',
  });

  app.useGlobalPipes(new SafeValidationPipe({
    whitelist: true,
    transform: true,
  }));

  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  app.setGlobalPrefix('api/v1');

  await app.listen(process.env['PORT'] ?? 3000, '0.0.0.0');
  console.warn(`API running on port ${process.env['PORT'] ?? 3000}`);
}

void bootstrap();



