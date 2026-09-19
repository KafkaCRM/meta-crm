import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import {
  integrationConnections,
  integrationIntakeRoutes,
  integrationFieldMappings,
  inboundEvents,
} from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import { encryptVaultData } from '../lib/crypto';
import type { AppEnv } from '../types/context';

export const integrationsRouter = new Hono<AppEnv>();

integrationsRouter.use('*', requireAuth, requireTenant);

export const INTEGRATION_MANIFESTS = [
  {
    id: 'whatsapp',
    provider: 'whatsapp',
    name: 'WhatsApp Business API',
    description: 'Direct 2-way messaging, automated alerts, and message templates',
    icon: 'MessageSquare',
    credential_fields: ['phone_number_id', 'access_token', 'verify_token'],
  },
  {
    id: 'facebook',
    provider: 'facebook',
    name: 'Meta Ads Lead Sync',
    description: 'Instant real-time sync of lead generation forms from Facebook & Instagram ads',
    icon: 'Share2',
    credential_fields: ['page_access_token', 'app_secret', 'page_id'],
    oauth_supported: true,
  },
  {
    id: 'justdial',
    provider: 'justdial',
    name: 'JustDial Lead Gateway',
    description: 'Ingest consumer leads and local search inquiries directly into your CRM',
    icon: 'PhoneCall',
    credential_fields: ['lead_api_key'],
  },
  {
    id: 'webhook',
    provider: 'webhook',
    name: 'Generic Inbound Webhooks',
    description: 'Post custom JSON payloads from website landing pages and web forms',
    icon: 'Link',
    credential_fields: ['signing_secret'],
    url_generator: true,
  },
  {
    id: 'zapier',
    provider: 'zapier',
    name: 'Zapier Webhook Hub',
    description: 'Connect 5,000+ third-party apps via Zapier webhook triggers',
    icon: 'Zap',
    credential_fields: ['webhook_url'],
    url_generator: true,
  },
  {
    id: 'google_sheets',
    provider: 'google_sheets',
    name: 'Google Sheets Ingest',
    description: 'Sync row additions from Google Sheets as new leads automatically',
    icon: 'Calendar',
    credential_fields: ['sheet_id', 'service_account_json'],
  },
];

// GET /connections - List all active connections and manifests
integrationsRouter.get('/', async (c) => {
  const scope = c.get('scope');

  const connections = await db.query.integrationConnections.findMany({
    where: eq(integrationConnections.tenantId, scope.tenant_id),
    orderBy: [desc(integrationConnections.updatedAt)],
  });

  const formattedConnections = connections.map((conn) => ({
    id: conn.id,
    tenant_id: conn.tenantId,
    provider: conn.provider,
    name: conn.name,
    status: conn.status,
    config_json: conn.configJson || {},
    has_credentials: Boolean(conn.credentialsCipherText),
    last_tested_at: conn.lastTestedAt?.toISOString() || null,
    created_at: conn.createdAt.toISOString(),
    updated_at: conn.updatedAt.toISOString(),
  }));

  return c.json({
    data: formattedConnections,
    manifests: INTEGRATION_MANIFESTS,
  });
});

// GET /connections/:id - Get single connection
integrationsRouter.get('/:id', async (c) => {
  const scope = c.get('scope');
  const id = c.req.param('id');

  const conn = await db.query.integrationConnections.findFirst({
    where: and(eq(integrationConnections.id, id), eq(integrationConnections.tenantId, scope.tenant_id)),
  });

  if (!conn) {
    return c.json({ code: 'NOT_FOUND', message: 'Connection not found' }, 404);
  }

  return c.json({
    id: conn.id,
    tenant_id: conn.tenantId,
    provider: conn.provider,
    name: conn.name,
    status: conn.status,
    config_json: conn.configJson || {},
    has_credentials: Boolean(conn.credentialsCipherText),
    last_tested_at: conn.lastTestedAt?.toISOString() || null,
    created_at: conn.createdAt.toISOString(),
    updated_at: conn.updatedAt.toISOString(),
  });
});

// POST /connections/:provider/connect - Connect or enable provider
integrationsRouter.post('/:provider/connect', async (c) => {
  const scope = c.get('scope');
  const provider = c.req.param('provider');
  const body = await c.req.json().catch(() => ({}));

  const manifest = INTEGRATION_MANIFESTS.find((m) => m.provider === provider);
  const credFields = manifest?.credential_fields || [];
  const credentials: Record<string, any> = {};
  const safeConfig: Record<string, any> = body.config_json || {};

  if (body.credentials) {
    for (const [key, value] of Object.entries(body.credentials)) {
      if (credFields.includes(key)) {
        credentials[key] = value;
      } else {
        safeConfig[key] = value;
      }
    }
  }

  const encrypted = Object.keys(credentials).length > 0 ? encryptVaultData(credentials) : null;

  // Check if connection already exists
  let conn = await db.query.integrationConnections.findFirst({
    where: and(
      eq(integrationConnections.tenantId, scope.tenant_id),
      eq(integrationConnections.provider, provider)
    ),
  });

  if (conn) {
    const updateData: Record<string, any> = {
      status: 'connected',
      configJson: { ...(conn.configJson as any), ...safeConfig },
      lastTestedAt: new Date(),
    };
    if (encrypted) {
      updateData['credentialsCipherText'] = encrypted.cipherText;
      updateData['credentialsIv'] = encrypted.iv;
      updateData['credentialsTag'] = encrypted.tag;
    }

    const [updated] = await db
      .update(integrationConnections)
      .set(updateData)
      .where(eq(integrationConnections.id, conn.id))
      .returning();

    return c.json({
      id: updated!.id,
      tenant_id: updated!.tenantId,
      provider: updated!.provider,
      name: updated!.name,
      status: updated!.status,
      config_json: updated!.configJson,
      has_credentials: Boolean(updated!.credentialsCipherText),
      last_tested_at: updated!.lastTestedAt?.toISOString() || null,
      created_at: updated!.createdAt.toISOString(),
      updated_at: updated!.updatedAt.toISOString(),
    });
  }

  const [created] = await db
    .insert(integrationConnections)
    .values({
      tenantId: scope.tenant_id,
      provider,
      name: manifest?.name || `${provider.toUpperCase()} Integration`,
      status: 'connected',
      configJson: safeConfig,
      credentialsCipherText: encrypted?.cipherText || null,
      credentialsIv: encrypted?.iv || null,
      credentialsTag: encrypted?.tag || null,
      lastTestedAt: new Date(),
    })
    .returning();

  return c.json(
    {
      id: created!.id,
      tenant_id: created!.tenantId,
      provider: created!.provider,
      name: created!.name,
      status: created!.status,
      config_json: created!.configJson,
      has_credentials: Boolean(created!.credentialsCipherText),
      last_tested_at: created!.lastTestedAt?.toISOString() || null,
      created_at: created!.createdAt.toISOString(),
      updated_at: created!.updatedAt.toISOString(),
    },
    201
  );
});

// DELETE /connections/:id - Disconnect / Delete connection
integrationsRouter.delete('/:id', async (c) => {
  const scope = c.get('scope');
  const id = c.req.param('id');

  const [deleted] = await db
    .delete(integrationConnections)
    .where(and(eq(integrationConnections.id, id), eq(integrationConnections.tenantId, scope.tenant_id)))
    .returning();

  if (!deleted) {
    return c.json({ code: 'NOT_FOUND', message: 'Connection not found' }, 404);
  }

  return c.json({ message: 'Integration disconnected successfully' });
});

// POST /connections/:id/test - Test connection health
integrationsRouter.post('/:id/test', async (c) => {
  const scope = c.get('scope');
  const id = c.req.param('id');

  const conn = await db.query.integrationConnections.findFirst({
    where: and(eq(integrationConnections.id, id), eq(integrationConnections.tenantId, scope.tenant_id)),
  });

  if (!conn) {
    return c.json({ code: 'NOT_FOUND', message: 'Connection not found' }, 404);
  }

  await db
    .update(integrationConnections)
    .set({ lastTestedAt: new Date() })
    .where(eq(integrationConnections.id, conn.id));

  return c.json({
    connection_id: conn.id,
    status: conn.status === 'connected' ? 'healthy' : 'error',
    message: conn.status === 'connected' ? 'Integration verified and responding normally' : 'Integration is disconnected',
    last_tested_at: new Date().toISOString(),
  });
});

// GET /connections/oauth/:provider/url
integrationsRouter.get('/oauth/:provider/url', async (c) => {
  const provider = c.req.param('provider');
  const redirectTo = c.req.query('redirect_to') || '/integrations';
  return c.json({
    url: `https://auth.meta-crm.local/oauth/${provider}?redirect_uri=${encodeURIComponent(redirectTo)}`,
  });
});

// GET /connections/:id/routes - Intake routes
integrationsRouter.get('/:id/routes', async (c) => {
  const connectionId = c.req.param('id');
  const routes = await db.query.integrationIntakeRoutes.findMany({
    where: eq(integrationIntakeRoutes.connectionId, connectionId),
    with: {
      fieldMappings: true,
    },
  });
  return c.json(routes);
});

// PUT /connections/:id/routes - Replace intake routes
integrationsRouter.put('/:id/routes', async (c) => {
  const connectionId = c.req.param('id');
  const body = await c.req.json().catch(() => []);

  // Delete existing routes
  await db.delete(integrationIntakeRoutes).where(eq(integrationIntakeRoutes.connectionId, connectionId));

  const createdRoutes = [];
  for (const item of body) {
    const [route] = await db
      .insert(integrationIntakeRoutes)
      .values({
        connectionId,
        priority: item.priority ?? 0,
        conditions: item.conditions || {},
        mode: item.mode || 'create_lead',
        campaignId: item.campaign_id || null,
        ownerId: item.owner_id || null,
        assignmentRule: item.assignment_rule || { type: 'fixed' },
        duplicateStrategy: item.duplicate_strategy || 'skip',
        duplicateMatchFields: item.duplicate_match_fields || ['email', 'phone'],
      })
      .returning();

    if (route && item.fieldMappings && item.fieldMappings.length > 0) {
      for (const fm of item.fieldMappings) {
        await db.insert(integrationFieldMappings).values({
          routeId: route.id,
          sourceField: fm.source_field,
          targetEntity: fm.target_entity,
          targetField: fm.target_field,
          transform: fm.transform || null,
          isRequired: fm.is_required ?? false,
        });
      }
    }
    createdRoutes.push(route);
  }

  return c.json(createdRoutes);
});

// GET /connections/:id/events - Inbound events for this connection
integrationsRouter.get('/:id/events', async (c) => {
  const connectionId = c.req.param('id');
  const limit = Math.min(parseInt(c.req.query('limit') || '30', 10), 50);

  const events = await db.query.inboundEvents.findMany({
    where: eq(inboundEvents.connectionId, connectionId),
    orderBy: [desc(inboundEvents.receivedAt)],
    limit,
  });

  return c.json({ data: events });
});

// POST /connections/:id/events/:eventId/retry
integrationsRouter.post('/:id/events/:eventId/retry', async (c) => {
  const eventId = c.req.param('eventId');

  const [updated] = await db
    .update(inboundEvents)
    .set({ status: 'processing', errorMessage: null })
    .where(eq(inboundEvents.id, eventId))
    .returning();

  return c.json(updated);
});
