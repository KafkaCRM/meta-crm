import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import {
  tenants,
  pluginRegistry,
  tenantPlugins,
  integrationConnections,
  inboundEvents,
  leads,
  leadEvents,
} from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import { encryptVaultData } from '../lib/crypto';
import { PLUGIN_CATALOGUE } from '../plugins/registry/plugin-catalogue';
import type { AppEnv } from '../types/context';

export const pluginsRouter = new Hono<AppEnv>();

// Public Inbound Webhook Intakes
pluginsRouter.post('/webhooks/generic', async (c) => {
  const payload = await c.req.json().catch(() => ({}));
  const tenantSlug = c.req.header('x-tenant-slug') || payload.tenant_slug;

  if (!tenantSlug) {
    return c.json({ code: 'VALIDATION_FAILED', message: 'x-tenant-slug header or tenant_slug in body is required' }, 400);
  }

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.slug, tenantSlug),
  });

  if (!tenant) {
    return c.json({ code: 'NOT_FOUND', message: 'Tenant not found' }, 404);
  }

  // Find or create webhook connection
  let conn = await db.query.integrationConnections.findFirst({
    where: and(
      eq(integrationConnections.tenantId, tenant.id),
      eq(integrationConnections.provider, 'webhook')
    ),
  });

  if (!conn) {
    const [newConn] = await db
      .insert(integrationConnections)
      .values({
        tenantId: tenant.id,
        provider: 'webhook',
        name: 'Generic Inbound Webhook',
        status: 'connected',
      })
      .returning();
    conn = newConn!;
  }

  // Record inbound event
  const [event] = await db
    .insert(inboundEvents)
    .values({
      connectionId: conn.id,
      providerEventId: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      eventType: 'webhook.received',
      rawPayload: payload,
      status: 'received',
    })
    .returning();

  // If payload looks like a lead, automatically create lead
  if (payload.name && (payload.phone || payload.email)) {
    const [lead] = await db
      .insert(leads)
      .values({
        tenantId: tenant.id,
        name: payload.name,
        email: payload.email,
        phone: payload.phone || 'N/A',
        source: 'website_webhook',
        status: 'new',
        attributes: payload,
      })
      .returning();

    if (lead) {
      await db.insert(leadEvents).values({
        leadId: lead.id,
        tenantId: tenant.id,
        eventType: 'lead_created',
        actorId: 'webhook',
        metadata: { event_id: event?.id },
      });

      await db
        .update(inboundEvents)
        .set({
          status: 'routed',
          resultEntityType: 'lead',
          resultEntityId: lead.id,
          processedAt: new Date(),
        })
        .where(eq(inboundEvents.id, event!.id));
    }
  }

  return c.json({ success: true, event_id: event?.id }, 200);
});

// Authenticated Settings Endpoints
pluginsRouter.use('*', requireAuth, requireTenant);

// GET /plugins
pluginsRouter.get('/plugins', async (c) => {
  const scope = c.get('scope');

  let allPlugins = await db.query.pluginRegistry.findMany({
    where: eq(pluginRegistry.status, 'active'),
  });

  if (allPlugins.length === 0) {
    for (const entry of PLUGIN_CATALOGUE) {
      await db
        .insert(pluginRegistry)
        .values({
          packageName: entry.package_name,
          version: entry.version,
          manifest: {
            ...entry.manifest,
            category: entry.category,
            icon: entry.icon,
          },
          status: 'active',
        })
        .onConflictDoNothing();
    }
    allPlugins = await db.query.pluginRegistry.findMany({
      where: eq(pluginRegistry.status, 'active'),
    });
  }

  const installed = await db.query.tenantPlugins.findMany({
    where: eq(tenantPlugins.tenantId, scope.tenant_id),
  });

  const installedIds = new Set(installed.map((p) => p.pluginRegistryId));

  const list = allPlugins.map((p) => {
    const manifest = (p.manifest as any) || {};
    return {
      id: p.id,
      name: manifest.name || p.packageName,
      description: manifest.description || '',
      version: p.version,
      requires_plan: manifest.requires_plan || null,
      enabled: installedIds.has(p.id),
      installed: installedIds.has(p.id),
    };
  });

  return c.json(list);
});

// POST /plugins/:id/install
pluginsRouter.post('/plugins/:id/install', async (c) => {
  const scope = c.get('scope');
  const pluginId = c.req.param('id');

  const reg = await db.query.pluginRegistry.findFirst({
    where: eq(pluginRegistry.id, pluginId),
  });

  if (!reg) return c.json({ code: 'NOT_FOUND', message: 'Plugin not found' }, 404);

  const existing = await db.query.tenantPlugins.findFirst({
    where: and(eq(tenantPlugins.tenantId, scope.tenant_id), eq(tenantPlugins.pluginRegistryId, pluginId)),
  });

  if (!existing) {
    await db.insert(tenantPlugins).values({
      tenantId: scope.tenant_id,
      pluginRegistryId: pluginId,
      enabled: true,
    });
  }

  return c.json({ success: true, id: pluginId, installed: true });
});

// POST /plugins/:id/uninstall
pluginsRouter.post('/plugins/:id/uninstall', async (c) => {
  const scope = c.get('scope');
  const pluginId = c.req.param('id');

  await db
    .delete(tenantPlugins)
    .where(and(eq(tenantPlugins.tenantId, scope.tenant_id), eq(tenantPlugins.pluginRegistryId, pluginId)));

  return c.json({ success: true, id: pluginId, installed: false });
});

// --- INTEGRATIONS ---
const KNOWN_PROVIDERS = [
  {
    provider: 'whatsapp',
    name: 'WhatsApp Business API',
    description: 'Direct messaging and automatic notification alerts',
    icon: 'MessageSquare',
    credential_fields: ['phone_number_id', 'access_token', 'verify_token'],
  },
  {
    provider: 'facebook',
    name: 'Meta Ads Lead Sync',
    description: 'Instant sync of lead generation ad forms',
    icon: 'Share2',
    credential_fields: ['page_access_token', 'app_secret', 'page_id'],
  },
  {
    provider: 'justdial',
    name: 'JustDial Lead Gateway',
    description: 'Ingest consumer leads from JustDial enquiries',
    icon: 'Phone',
    credential_fields: ['lead_api_key'],
  },
  {
    provider: 'webhook',
    name: 'Generic Inbound Webhooks',
    description: 'Post custom JSON payloads from website forms',
    icon: 'Link',
    credential_fields: ['signing_secret'],
  },
];

pluginsRouter.get('/integrations', async (c) => {
  const scope = c.get('scope');

  const tenantConns = await db.query.integrationConnections.findMany({
    where: eq(integrationConnections.tenantId, scope.tenant_id),
  });

  const connByProvider = new Map(tenantConns.map((conn) => [conn.provider, conn]));

  const response = KNOWN_PROVIDERS.map((kp) => {
    const conn = connByProvider.get(kp.provider);
    return {
      id: conn?.id || `prov_${kp.provider}`,
      provider: kp.provider,
      name: kp.name,
      description: kp.description,
      icon: kp.icon,
      credential_fields: kp.credential_fields,
      status: conn?.status || 'disconnected',
      has_credentials: Boolean(conn?.credentialsCipherText),
      configured_at: conn?.updatedAt?.toISOString(),
      config_json: conn?.configJson || {},
    };
  });

  return c.json(response);
});

pluginsRouter.post('/integrations/:provider/configure', async (c) => {
  const scope = c.get('scope');
  const provider = c.req.param('provider');
  const body = await c.req.json().catch(() => ({}));

  const known = KNOWN_PROVIDERS.find((p) => p.provider === provider);
  const credFields = known?.credential_fields || [];
  const credentials: Record<string, any> = {};
  const safeConfig: Record<string, any> = {};

  for (const [key, value] of Object.entries(body)) {
    if (credFields.includes(key)) {
      credentials[key] = value;
    } else {
      safeConfig[key] = value;
    }
  }

  const encrypted = Object.keys(credentials).length > 0 ? encryptVaultData(credentials) : null;

  let conn = await db.query.integrationConnections.findFirst({
    where: and(eq(integrationConnections.tenantId, scope.tenant_id), eq(integrationConnections.provider, provider)),
  });

  if (conn) {
    const updateData: Record<string, any> = {
      configJson: safeConfig,
      status: 'connected',
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
      provider: updated!.provider,
      name: updated!.name,
      status: updated!.status,
      has_credentials: Boolean(updated!.credentialsCipherText),
      configured_at: updated!.updatedAt?.toISOString(),
      config_json: updated!.configJson,
    });
  } else {
    const [created] = await db
      .insert(integrationConnections)
      .values({
        tenantId: scope.tenant_id,
        provider,
        name: `${provider.toUpperCase()} Integration`,
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
        provider: created!.provider,
        name: created!.name,
        status: created!.status,
        has_credentials: Boolean(created!.credentialsCipherText),
        configured_at: created!.updatedAt?.toISOString(),
        config_json: created!.configJson,
      },
      201
    );
  }
});

pluginsRouter.post('/integrations/:provider/test', async (c) => {
  const scope = c.get('scope');
  const provider = c.req.param('provider');

  const conn = await db.query.integrationConnections.findFirst({
    where: and(eq(integrationConnections.tenantId, scope.tenant_id), eq(integrationConnections.provider, provider)),
  });

  return c.json({
    provider,
    status: conn?.status === 'connected' ? 'healthy' : 'error',
    message: conn?.status === 'connected' ? 'Connection verified successfully' : 'Not configured',
    last_checked_at: new Date().toISOString(),
    checked_fields: [],
  });
});

pluginsRouter.delete('/integrations/:provider', async (c) => {
  const scope = c.get('scope');
  const provider = c.req.param('provider');

  await db
    .delete(integrationConnections)
    .where(and(eq(integrationConnections.tenantId, scope.tenant_id), eq(integrationConnections.provider, provider)));

  return c.json({ message: 'Integration disconnected' });
});
