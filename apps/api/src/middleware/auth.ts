import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie';
import type { AppEnv } from '../types/context';
import { verifyJwt, payloadToScope } from '../lib/jwt';

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  let token: string | undefined;

  // 1. Check Authorization Bearer header
  const authHeader = c.req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }

  // 2. Check cookie if header not provided
  if (!token) {
    token = getCookie(c, 'access_token');
  }

  if (!token) {
    return c.json(
      { code: 'UNAUTHORIZED', message: 'Missing or invalid authentication token' },
      401
    );
  }

  const payload = verifyJwt(token);
  if (!payload) {
    return c.json(
      { code: 'UNAUTHORIZED', message: 'Invalid or expired authentication token' },
      401
    );
  }

  const scope = payloadToScope(payload);
  c.set('scope', scope);

  await next();
});

export const optionalAuth = createMiddleware<AppEnv>(async (c, next) => {
  let token: string | undefined;
  const authHeader = c.req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }
  if (!token) {
    token = getCookie(c, 'access_token');
  }

  if (token) {
    const payload = verifyJwt(token);
    if (payload) {
      c.set('scope', payloadToScope(payload));
    }
  }

  await next();
});
