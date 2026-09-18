import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../types/context';

export const requireTenant = createMiddleware<AppEnv>(async (c, next) => {
  const scope = c.get('scope');

  if (!scope || !scope.tenant_id) {
    return c.json(
      { code: 'FORBIDDEN', message: 'Tenant context required for this resource' },
      403
    );
  }

  await next();
});

export const requirePlatformAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const scope = c.get('scope');

  if (!scope || !scope.platform_role) {
    return c.json(
      { code: 'FORBIDDEN', message: 'Platform administration access required' },
      403
    );
  }

  await next();
});
