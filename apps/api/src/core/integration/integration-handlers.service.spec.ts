import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { IntegrationHandlersService } from './integration-handlers.service';
import { PlatformPrismaService } from '../tenant/platform-prisma.service';
import { EncryptionService } from './encryption.service';
import { ok } from 'neverthrow';

function mockCls(): ClsService {
  const store = new Map();
  return {
    run: vi.fn().mockImplementation(async (cb) => cb()),
    set: vi.fn().mockImplementation((key, val) => store.set(key, val)),
    get: vi.fn().mockImplementation((key) => store.get(key)),
  } as unknown as ClsService;
}

function mockPlatformDb() {
  const mockTenantExtension = {
    extension_id: 'ext-zapier',
  };
  const mockSecureCredential = {
    cipher_text: 'cipher-abc',
    iv: 'iv-abc',
    tag: 'tag-abc',
  };
  const mockTenant = {
    id: 't-1',
    status: 'active',
  };
  const mockWorkflow = {
    id: 'wf-1',
    stages: [{ id: 'stage-1', order: 0 }],
  };

  return {
    client: {
      tenantExtension: {
        findFirst: vi.fn().mockResolvedValue(mockTenantExtension),
      },
      secureCredential: {
        findFirst: vi.fn().mockResolvedValue(mockSecureCredential),
      },
      tenant: {
        findUnique: vi.fn().mockResolvedValue(mockTenant),
      },
      party: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'party-1', name: 'John Doe Inbound' }),
      },
      workflowDefinition: {
        findFirst: vi.fn().mockResolvedValue(mockWorkflow),
      },
      case: {
        create: vi.fn().mockResolvedValue({ id: 'case-1' }),
      },
    },
  } as unknown as PlatformPrismaService;
}

describe('IntegrationHandlersService', () => {
  let eventEmitter: EventEmitter2;
  let platformDb: PlatformPrismaService;
  let encryption: EncryptionService;
  let cls: ClsService;
  let service: IntegrationHandlersService;

  beforeEach(() => {
    eventEmitter = new EventEmitter2();
    platformDb = mockPlatformDb();
    encryption = {
      decrypt: vi.fn().mockReturnValue(ok(JSON.stringify({
        webhook_url: 'https://zapier.com/hook/123',
        client_id: 'google-client-id',
        imap_host: 'imap.example.com',
        imap_user: 'support',
      }))),
    } as unknown as EncryptionService;
    cls = mockCls();

    service = new IntegrationHandlersService(eventEmitter, platformDb, encryption, cls);
  });

  describe('Zapier Event Forwarder', () => {
    it('dispatches webhook event successfully', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
      });
      global.fetch = fetchMock;

      service.onModuleInit();

      // Emit a fake event
      eventEmitter.emit('case:created', { tenant_id: 't-1', id: 'case-1' });

      // Wait a microtask for the async hook callback to fire
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(fetchMock).toHaveBeenCalledWith('https://zapier.com/hook/123', expect.any(Object));
    });
  });

  describe('Google Calendar Sync', () => {
    it('synchronizes appointments successfully', async () => {
      const loggerSpy = vi.spyOn(service['logger'], 'log');

      await service.handleAppointmentSync({
        tenant_id: 't-1',
        title: 'Patient Consult',
        start_time: new Date(),
      });

      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Google Calendar Sync: Synchronized appointment'));
    });
  });

  describe('Email-to-Case Router', () => {
    it('simulates inbound email sync by creating a support case', async () => {
      const loggerSpy = vi.spyOn(service['logger'], 'log');

      const count = await service.runEmailToCaseSync('t-1');

      expect(count).toBe(1);
      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Email-to-Case: Polling IMAP mailbox'));
      expect(platformDb.client.case.create).toHaveBeenCalled();
    });
  });
});
