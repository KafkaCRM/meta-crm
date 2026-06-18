import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { IntegrationHandlersService } from './integration-handlers.service';
import { PlatformPrismaService } from '../tenant/platform-prisma.service';
import { ConnectionService } from './connection.service';
import { ok, err } from 'neverthrow';

function mockCls(): ClsService {
  const store = new Map();
  return {
    run: vi.fn().mockImplementation(async (cb) => cb()),
    set: vi.fn().mockImplementation((key, val) => store.set(key, val)),
    get: vi.fn().mockImplementation((key) => store.get(key)),
  } as unknown as ClsService;
}

function mockPlatformDb() {
  const mockWorkflow = {
    id: 'wf-1',
    stages: [{ id: 'stage-1', order: 0 }],
  };

  return {
    client: {
      party: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'party-1', name: 'John Doe Inbound' }),
      },
      pipelineDefinition: {
        findFirst: vi.fn().mockResolvedValue(mockWorkflow),
      },
      lead: {
        create: vi.fn().mockResolvedValue({ id: 'lead-1' }),
      },
    },
  } as unknown as PlatformPrismaService;
}

function mockConnectionService(provider: string, creds: Record<string, string>) {
  return {
    getDecryptedCredentialsByProvider: vi.fn().mockResolvedValue(ok(creds)),
  } as unknown as ConnectionService;
}

describe('IntegrationHandlersService', () => {
  let eventEmitter: EventEmitter2;
  let platformDb: PlatformPrismaService;
  let connectionService: ConnectionService;
  let cls: ClsService;
  let service: IntegrationHandlersService;

  beforeEach(() => {
    eventEmitter = new EventEmitter2();
    platformDb = mockPlatformDb();
    connectionService = mockConnectionService('zapier', { webhook_url: 'https://zapier.com/hook/123' });
    cls = mockCls();

    service = new IntegrationHandlersService(eventEmitter, platformDb, connectionService, cls);
  });

  describe('Zapier Event Forwarder', () => {
    it('dispatches webhook event successfully', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      global.fetch = fetchMock;

      service.onModuleInit();
      eventEmitter.emit('case:created', { tenant_id: 't-1', id: 'case-1' });
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(fetchMock).toHaveBeenCalledWith('https://zapier.com/hook/123', expect.any(Object));
    });
  });

  describe('Google Calendar Sync', () => {
    it('synchronizes appointments successfully', async () => {
      const calService = new IntegrationHandlersService(
        eventEmitter,
        platformDb,
        mockConnectionService('google-calendar', { client_id: 'google-client-id' }),
        cls,
      );
      const loggerSpy = vi.spyOn(calService['logger'], 'log');

      await calService.handleAppointmentSync({
        tenant_id: 't-1',
        title: 'Patient Consult',
        start_time: new Date(),
      });

      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Google Calendar Sync'));
    });
  });

  describe('Email-to-Lead Router', () => {
    it('simulates inbound email sync by creating a lead', async () => {
      const emailService = new IntegrationHandlersService(
        eventEmitter,
        platformDb,
        mockConnectionService('email-to-case', { imap_host: 'imap.example.com', imap_user: 'support' }),
        cls,
      );
      const loggerSpy = vi.spyOn(emailService['logger'], 'log');

      const count = await emailService.runEmailToLeadSync('t-1');

      expect(count).toBe(1);
      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Email-to-Lead: Polling IMAP mailbox'));
      expect(platformDb.client.lead.create).toHaveBeenCalled();
    });
  });
});
