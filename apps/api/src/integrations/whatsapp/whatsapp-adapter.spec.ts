import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { ok, err } from 'neverthrow';
import { WhatsAppAdapter } from './whatsapp-adapter';
import { WhatsAppWebhookService } from './whatsapp-webhook.service';
import { SecretsService } from '../../core/secrets/secrets.service';
import { PartyUpsertService } from '../../core/party/party-upsert.service';
import { InteractionService } from '../../core/interaction/interaction.service';
import { HooksService } from '../../core/hooks/hooks.service';
import { RoomManagerService } from '../../core/realtime/room-manager.service';

const APP_SECRET_REF = 'secret/platform/whatsapp/app_secret';

/* ------------------------------------------------------------------ */
/*  WhatsAppAdapter                                                    */
/* ------------------------------------------------------------------ */
describe('WhatsAppAdapter', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function buildAdapter() {
    const secrets = { get: vi.fn() } as unknown as SecretsService;
    const adapter = new WhatsAppAdapter(secrets);
    return { adapter, secrets };
  }

  it('resolves credentials from SecretsService, not from env directly', async () => {
    const { adapter, secrets } = buildAdapter();
    (secrets.get as any).mockImplementation((ref: string) => {
      if (ref.includes('api_key')) return ok('test-api-key');
      if (ref.includes('phone_number_id')) return ok('123456789');
      return err({ code: 'SECRET_NOT_FOUND', ref });
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ messages: [{ id: 'wamid-abc123' }] }),
    });

    await adapter.send({
      to: '+919876543210',
      message: 'Hello',
      tenant_id: 'tenant-a',
    });

    expect(secrets.get).toHaveBeenCalledWith('secret/tenants/tenant-a/whatsapp/api_key');
    expect(secrets.get).toHaveBeenCalledWith('secret/tenants/tenant-a/whatsapp/phone_number_id');
  });

  it('returns Ok with message_id on successful send', async () => {
    const { adapter, secrets } = buildAdapter();
    (secrets.get as any).mockResolvedValue(ok('test-api-key'));

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ messages: [{ id: 'wamid-abc123' }] }),
    });

    const result = await adapter.send({
      to: '+919876543210',
      message: 'Hello',
      tenant_id: 'tenant-a',
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.message_id).toBe('wamid-abc123');
    }
  });

  it('returns Err on API error (does not throw)', async () => {
    const { adapter, secrets } = buildAdapter();
    (secrets.get as any).mockResolvedValue(ok('test-api-key'));

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve('{"error":{"message":"Invalid parameter"}}'),
    });

    const result = await adapter.send({
      to: '+919876543210',
      message: 'Hello',
      tenant_id: 'tenant-a',
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('ADAPTER_SEND_FAILED');
      expect(result.error.provider).toBe('whatsapp');
    }
  });

  it('returns Err on network error (does not throw)', async () => {
    const { adapter, secrets } = buildAdapter();
    (secrets.get as any).mockResolvedValue(ok('test-api-key'));

    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await adapter.send({
      to: '+919876543210',
      message: 'Hello',
      tenant_id: 'tenant-a',
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('ADAPTER_SEND_FAILED');
    }
  });

  it('returns Err when API key is missing', async () => {
    const { adapter, secrets } = buildAdapter();
    (secrets.get as any).mockReturnValue(err({ code: 'SECRET_NOT_FOUND', ref: APP_SECRET_REF }));

    const result = await adapter.send({
      to: '+919876543210',
      message: 'Hello',
      tenant_id: 'tenant-a',
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('ADAPTER_CREDENTIALS_MISSING');
    }
  });
});

/* ------------------------------------------------------------------ */
/*  WhatsAppWebhookService                                             */
/* ------------------------------------------------------------------ */
describe('WhatsAppWebhookService', () => {
  function buildService() {
    const secrets = { get: vi.fn() } as unknown as SecretsService;
    const partyUpsert = { upsertByPhone: vi.fn() } as unknown as PartyUpsertService;
    const interaction = { create: vi.fn() } as unknown as InteractionService;
    const hooks = { emit: vi.fn() } as unknown as HooksService;
    const roomManager = { broadcastToUser: vi.fn() } as unknown as RoomManagerService;

    const service = new WhatsAppWebhookService(secrets, partyUpsert, interaction, hooks, roomManager);
    return { service, secrets, partyUpsert, interaction, hooks, roomManager };
  }

  const APP_SECRET = 'whatsapp-app-secret-123';

  function signBody(body: string): string {
    return `sha256=${createHmac('sha256', APP_SECRET).update(body).digest('hex')}`;
  }

  /* ------------------------------------------------------------------ */
  /*  Signature verification                                             */
  /* ------------------------------------------------------------------ */
  it('valid HMAC signature → returns true', async () => {
    const { service, secrets } = buildService();
    (secrets.get as any).mockResolvedValue(ok(APP_SECRET));

    const rawBody = JSON.stringify({ entry: [] });
    const signature = signBody(rawBody);

    const result = await service.verifySignature(rawBody, signature);
    expect(result).toBe(true);
  });

  it('invalid HMAC signature → returns false', async () => {
    const { service, secrets } = buildService();
    (secrets.get as any).mockResolvedValue(ok(APP_SECRET));

    const rawBody = JSON.stringify({ entry: [] });
    const badSignature = 'sha256=invalidhexvalue';

    const result = await service.verifySignature(rawBody, badSignature);
    expect(result).toBe(false);
  });

  it('missing signature header → returns false', async () => {
    const { service, secrets } = buildService();
    (secrets.get as any).mockResolvedValue(ok(APP_SECRET));

    const result = await service.verifySignature('{}', undefined);
    expect(result).toBe(false);
  });

  /* ------------------------------------------------------------------ */
  /*  Payload parsing                                                    */
  /* ------------------------------------------------------------------ */
  it('parses valid WhatsApp payload to canonical form', () => {
    const { service } = buildService();

    const body = {
      entry: [
        {
          changes: [
            {
              value: {
                contacts: [{ wa_id: '+919876543210' }],
                messages: [
                  {
                    id: 'wamid-msg-1',
                    from: '+919876543210',
                    text: { body: 'Hello from WhatsApp' },
                  },
                ],
                metadata: { conversation_id: 'conv-abc-123' },
              },
            },
          ],
        },
      ],
    };

    const parsed = service.parsePayload(body);
    expect(parsed).not.toBeNull();
    expect(parsed!.from_phone).toBe('+919876543210');
    expect(parsed!.message).toBe('Hello from WhatsApp');
    expect(parsed!.conversation_id).toBe('conv-abc-123');
    expect(parsed!.metadata.whatsapp_message_id).toBe('wamid-msg-1');
  });

  it('returns null for empty payload', () => {
    const { service } = buildService();
    const result = service.parsePayload({});
    expect(result).toBeNull();
  });

  /* ------------------------------------------------------------------ */
  /*  Incoming message from known phone → finds existing party           */
  /* ------------------------------------------------------------------ */
  it('incoming message from known phone finds existing party (no duplicate)', async () => {
    const { service, partyUpsert, interaction, hooks } = buildService();

    (partyUpsert.upsertByPhone as any).mockResolvedValue(
      ok({ action: 'found', party: { id: 'party-1', name: 'John', assigned_to_id: null } }),
    );
    (interaction.create as any).mockResolvedValue(
      ok({ id: 'interaction-1', party_id: 'party-1', channel: 'whatsapp', direction: 'inbound', content: 'Hi', created_at: new Date().toISOString() }),
    );

    const scope = { tenant_id: 'tenant-a', user_id: '', assignment_ids: [], role: 'branch_user' } as any;

    await service.processIncoming(
      {
        from_phone: '+919876543210',
        message: 'Hi',
        conversation_id: 'conv-1',
        timestamp: new Date(),
        metadata: { whatsapp_message_id: 'wamid-1' },
      },
      scope,
    );

    expect(partyUpsert.upsertByPhone).toHaveBeenCalledTimes(1);
    expect(interaction.create).toHaveBeenCalledTimes(1);
    expect(hooks.emit).toHaveBeenCalledWith(
      'integration:whatsapp:message_received',
      expect.objectContaining({
        tenant_id: 'tenant-a',
        party_id: 'party-1',
        channel: 'whatsapp',
      }),
    );
  });

  /* ------------------------------------------------------------------ */
  /*  Incoming message from unknown phone → creates new party            */
  /* ------------------------------------------------------------------ */
  it('incoming message from unknown phone creates new party with source whatsapp', async () => {
    const { service, partyUpsert, interaction } = buildService();

    (partyUpsert.upsertByPhone as any).mockResolvedValue(
      ok({
        action: 'created',
        party: { id: 'party-new', name: '', assigned_to_id: null },
      }),
    );
    (interaction.create as any).mockResolvedValue(
      ok({ id: 'interaction-1', party_id: 'party-new', channel: 'whatsapp', direction: 'inbound', content: 'Hello', created_at: new Date().toISOString() }),
    );

    const scope = { tenant_id: 'tenant-a', user_id: '', assignment_ids: [], role: 'branch_user' } as any;

    await service.processIncoming(
      {
        from_phone: '+919999999999',
        message: 'Hello',
        conversation_id: 'conv-new',
        timestamp: new Date(),
        metadata: { whatsapp_message_id: 'wamid-new' },
      },
      scope,
    );

    expect(partyUpsert.upsertByPhone).toHaveBeenCalledWith(
      '+919999999999',
      expect.any(Object),
      'whatsapp',
      scope,
    );
  });

  /* ------------------------------------------------------------------ */
  /*  Thread grouping: same conversation_id → same thread_id             */
  /* ------------------------------------------------------------------ */
  it('same conversation_id produces same thread_id on interactions', async () => {
    const { service, partyUpsert, interaction } = buildService();

    (partyUpsert.upsertByPhone as any).mockResolvedValue(
      ok({ action: 'found', party: { id: 'party-1', name: 'John', assigned_to_id: null } }),
    );
    (interaction.create as any).mockResolvedValue(
      ok({ id: 'interaction-1', party_id: 'party-1', thread_id: 'conv-abc', channel: 'whatsapp', direction: 'inbound', content: 'Msg 1', created_at: new Date().toISOString() }),
    );

    const scope = { tenant_id: 'tenant-a', user_id: '', assignment_ids: [], role: 'branch_user' } as any;

    await service.processIncoming(
      {
        from_phone: '+919876543210',
        message: 'Msg 1',
        conversation_id: 'conv-abc',
        timestamp: new Date(),
        metadata: { whatsapp_message_id: 'wamid-1' },
      },
      scope,
    );

    expect(interaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        thread_id: 'conv-abc',
        channel: 'whatsapp',
        direction: 'inbound',
      }),
    );
  });

  /* ------------------------------------------------------------------ */
  /*  Socket.io notification to assigned counsellor                      */
  /* ------------------------------------------------------------------ */
  it('broadcasts to assigned counsellor when party has assigned_to_id', async () => {
    const { service, partyUpsert, interaction, roomManager } = buildService();

    (partyUpsert.upsertByPhone as any).mockResolvedValue(
      ok({ action: 'found', party: { id: 'party-1', name: 'John', assigned_to_id: 'user-counsellor' } }),
    );
    (interaction.create as any).mockResolvedValue(
      ok({ id: 'interaction-1', party_id: 'party-1', channel: 'whatsapp', direction: 'inbound', content: 'Hi', created_at: new Date().toISOString() }),
    );

    const scope = { tenant_id: 'tenant-a', user_id: '', assignment_ids: [], role: 'branch_user' } as any;

    await service.processIncoming(
      {
        from_phone: '+919876543210',
        message: 'Hi',
        conversation_id: 'conv-1',
        timestamp: new Date(),
        metadata: { whatsapp_message_id: 'wamid-1' },
      },
      scope,
    );

    expect(roomManager.broadcastToUser).toHaveBeenCalledWith(
      'user-counsellor',
      'interaction:received',
      expect.objectContaining({
        interaction_id: 'interaction-1',
        party_id: 'party-1',
        party_name: 'John',
        channel: 'whatsapp',
      }),
    );
  });
});
