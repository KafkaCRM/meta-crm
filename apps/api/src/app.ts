import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { logger } from 'hono/logger';
import type { AppEnv } from './types/context';
import { authRouter } from './routes/auth.routes';
import { leadsRouter } from './routes/leads.routes';
import { partiesRouter } from './routes/parties.routes';
import { workflowsRouter } from './routes/workflows.routes';
import { campaignsRouter } from './routes/campaigns.routes';
import { branchesRouter } from './routes/branches.routes';
import { verticalsRouter } from './routes/verticals.routes';
import { usersRouter } from './routes/users.routes';
import { rolesRouter } from './routes/roles.routes';
import { fieldsRouter } from './routes/fields.routes';
import { labelsRouter } from './routes/labels.routes';
import { capabilitiesRouter } from './routes/capabilities.routes';
import { academicsRouter } from './routes/academics.routes';
import { hrRouter } from './routes/hr.routes';
import { financeRouter } from './routes/finance.routes';
import { operationsRouter } from './routes/operations.routes';
import { reportsRouter } from './routes/reports.routes';
import { pluginsRouter } from './routes/plugins.routes';
import { platformRouter } from './routes/platform.routes';
import { franchiseRouter } from './routes/franchise.routes';
import { objectsRouter } from './routes/objects.routes';

export const app = new Hono<AppEnv>();

// 1. Global Logging
if (process.env.NODE_ENV !== 'test') {
  app.use('*', logger());
}

// 2. Fix SEC-01: Native CORS Configuration
app.use(
  '*',
  cors({
    origin: (origin) => {
      // Allow localhost dev servers and any explicit configured CORS origin
      if (!origin || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        return origin || '*';
      }
      if (process.env.ALLOWED_ORIGINS) {
        const allowed = process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
        if (allowed.includes(origin)) return origin;
      }
      return origin;
    },
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'x-tenant-slug', 'x-requested-with'],
    exposeHeaders: ['Content-Range', 'X-Total-Count'],
    maxAge: 86400,
  })
);

// 3. Fix SEC-02: Native Security Headers
app.use(
  '*',
  secureHeaders({
    xFrameOptions: 'DENY',
    xContentTypeOptions: 'nosniff',
    xXssProtection: '1; mode=block',
    strictTransportSecurity: 'max-age=31536000; includeSubDomains',
  })
);

// 4. Centralized Error Handler
app.onError((err, c) => {
  console.error('[API ERROR]', err);
  const status = (err as any).status || 500;
  const code = (err as any).code || 'INTERNAL_SERVER_ERROR';
  const message = err.message || 'An unexpected error occurred';

  return c.json({ code, message }, status);
});

// 5. Health check
app.get('/health', (c) => c.json({ status: 'healthy', timestamp: new Date().toISOString() }));

// 6. Mount API v1 Sub-routers
const apiV1 = new Hono<AppEnv>();

apiV1.route('/auth', authRouter);
apiV1.route('/leads', leadsRouter);
apiV1.route('/parties', partiesRouter);
apiV1.route('/pipelines', workflowsRouter);
apiV1.route('/campaigns', campaignsRouter);
apiV1.route('/branches', branchesRouter);
apiV1.route('/verticals', verticalsRouter);
apiV1.route('/users', usersRouter);
apiV1.route('/roles', rolesRouter);
apiV1.route('/field-definitions', fieldsRouter);
apiV1.route('/labels', labelsRouter);
apiV1.route('/reports', reportsRouter);
apiV1.route('/platform', platformRouter);
apiV1.route('/franchise', franchiseRouter);
apiV1.route('/objects', objectsRouter);
apiV1.route('/custom-objects', objectsRouter);

// Capabilities & Domain Verticals
apiV1.route('/', capabilitiesRouter);
apiV1.route('/', academicsRouter);
apiV1.route('/', hrRouter);
apiV1.route('/', financeRouter);
apiV1.route('/', operationsRouter);
apiV1.route('/', pluginsRouter);

// Mount under both `/api/v1` (standard) and `/` (if direct proxy)
app.route('/api/v1', apiV1);
app.route('/', apiV1);
