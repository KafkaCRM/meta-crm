import { z } from 'zod';
import { createMiddleware } from 'hono/factory';

export const validateJson = <T extends z.ZodTypeAny>(schema: T) =>
  createMiddleware(async (c, next) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        { code: 'INVALID_JSON', message: 'Malformed JSON payload' },
        400
      );
    }

    const result = schema.safeParse(body);
    if (!result.success) {
      const issues = (result.error as any).issues || (result.error as any).errors || [];
      const formatted = issues.map((err: any) => ({
        path: Array.isArray(err.path) ? err.path.join('.') : String(err.path || ''),
        message: err.message,
      }));

      return c.json(
        {
          code: 'VALIDATION_FAILED',
          message: formatted[0]?.message || 'Validation failed',
          errors: formatted,
        },
        400
      );
    }

    // Set parsed data on the context
    c.set('validatedJson' as any, result.data);
    await next();
  });

export const validateQuery = <T extends z.ZodTypeAny>(schema: T) =>
  createMiddleware(async (c, next) => {
    const query = c.req.query();
    const result = schema.safeParse(query);
    if (!result.success) {
      const issues = (result.error as any).issues || (result.error as any).errors || [];
      const formatted = issues.map((err: any) => ({
        path: Array.isArray(err.path) ? err.path.join('.') : String(err.path || ''),
        message: err.message,
      }));

      return c.json(
        {
          code: 'VALIDATION_FAILED',
          message: formatted[0]?.message || 'Invalid query parameters',
          errors: formatted,
        },
        400
      );
    }

    c.set('validatedQuery' as any, result.data);
    await next();
  });
