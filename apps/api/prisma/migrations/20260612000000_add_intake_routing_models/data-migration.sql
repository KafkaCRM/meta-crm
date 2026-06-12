-- ═══════════════════════════════════════════════════════════════════════════
-- Data Migration: IntegrationConfig + SecureCredential → IntegrationConnection
--
-- Run this AFTER the schema migration 20260612000000_add_intake_routing_models
-- has been applied. This is non-destructive — old tables are left intact.
-- ═══════════════════════════════════════════════════════════════════════════

-- Step 1: Create IntegrationConnection rows from IntegrationConfig
-- Map provider names from the static INTEGRATION_MANIFESTS catalog
INSERT INTO "IntegrationConnection" ("id", "tenant_id", "provider", "name", "status", "config_json", "last_tested_at", "created_at", "updated_at")
SELECT
  gen_random_uuid() AS id,
  ic.tenant_id,
  ic.provider,
  CASE ic.provider
    WHEN 'whatsapp' THEN 'WhatsApp Business'
    WHEN 'facebook' THEN 'Facebook Lead Ads'
    WHEN 'justdial' THEN 'JustDial'
    WHEN 'email' THEN 'Email (SMTP)'
    WHEN 'zapier' THEN 'Zapier'
    WHEN 'google-calendar' THEN 'Google Calendar'
    WHEN 'email-to-case' THEN 'Email-to-Case Router'
    ELSE ic.provider
  END AS name,
  CASE WHEN ic.enabled THEN 'connected' ELSE 'disconnected' END AS status,
  ic.config_json,
  NULL AS last_tested_at,
  ic.created_at,
  ic.updated_at
FROM "IntegrationConfig" ic
WHERE NOT EXISTS (
  SELECT 1 FROM "IntegrationConnection" conn
  WHERE conn.tenant_id = ic.tenant_id AND conn.provider = ic.provider
);

-- Step 2: Migrate encrypted credentials from SecureCredential into IntegrationConnection
-- Match via ExtensionRegistry.package_name → integration/ prefix → provider
UPDATE "IntegrationConnection" conn
SET
  "credentials_cipher_text" = sc.cipher_text,
  "credentials_iv" = sc.iv,
  "credentials_tag" = sc.tag
FROM "SecureCredential" sc
JOIN "ExtensionRegistry" er ON er.id = sc.extension_id
JOIN "TenantExtension" te ON te.extension_id = er.id AND te.tenant_id = sc.tenant_id
WHERE
  conn.tenant_id = sc.tenant_id
  AND REPLACE(er.package_name, 'integration/', '') = conn.provider
  AND conn.credentials_cipher_text IS NULL;

-- Step 3: Verify migration counts
-- Run this separately to verify:
-- SELECT 'IntegrationConfig', count(*) FROM "IntegrationConfig"
-- UNION ALL
-- SELECT 'IntegrationConnection', count(*) FROM "IntegrationConnection"
-- UNION ALL
-- SELECT 'Connections with creds', count(*) FROM "IntegrationConnection" WHERE credentials_cipher_text IS NOT NULL;
