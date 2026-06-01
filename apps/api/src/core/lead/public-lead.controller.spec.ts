import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClsService } from 'nestjs-cls';
import { PublicLeadController } from './public-lead.controller';
import { LeadService } from './lead.service';
import { PlatformPrismaService } from '../tenant/platform-prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ok, err } from 'neverthrow';

function mockCls(): ClsService {
  const store = new Map();
  return {
    run: vi.fn().mockImplementation(async (cb) => cb()),
    set: vi.fn().mockImplementation((key, val) => store.set(key, val)),
    get: vi.fn().mockImplementation((key) => store.get(key)),
  } as unknown as ClsService;
}

function mockPlatformDb(tenant: any) {
  return {
    client: {
      tenant: {
        findUnique: vi.fn().mockResolvedValue(tenant),
      },
    },
  } as unknown as PlatformPrismaService;
}

function mockLeadService(creationResult: any) {
  return {
    create: vi.fn().mockResolvedValue(creationResult),
  } as unknown as LeadService;
}

describe('PublicLeadController', () => {
  let cls: ClsService;
  let platformDb: PlatformPrismaService;

  beforeEach(() => {
    cls = mockCls();
  });

  it('successfully ingests a lead with a valid tenant ID', async () => {
    const tenant = { id: 'tenant-1', status: 'active' };
    platformDb = mockPlatformDb(tenant);
    const leadService = mockLeadService(ok({ id: 'lead-1' }));

    const controller = new PublicLeadController(leadService, platformDb, cls);

    const result = await controller.createWebToLead(
      { name: 'John Doe', phone: '1234567890', source: 'web_form' },
      'tenant-1',
    );

    expect(result).toEqual({ id: 'lead-1' });
    expect(leadService.create).toHaveBeenCalledWith({
      name: 'John Doe',
      phone: '1234567890',
      source: 'web_form',
    });
  });

  it('successfully ingests a lead with a valid tenant slug fallback', async () => {
    platformDb = {
      client: {
        tenant: {
          findUnique: vi.fn()
            .mockResolvedValueOnce(null) // first try by ID returns null
            .mockResolvedValueOnce({ id: 'tenant-1', status: 'active' }), // second try by slug succeeds
        },
      },
    } as unknown as PlatformPrismaService;
    const leadService = mockLeadService(ok({ id: 'lead-1' }));

    const controller = new PublicLeadController(leadService, platformDb, cls);

    const result = await controller.createWebToLead(
      { name: 'John Doe', phone: '1234567890', source: 'web_form' },
      undefined,
      'apex-global',
    );

    expect(result).toEqual({ id: 'lead-1' });
    expect(leadService.create).toHaveBeenCalled();
  });

  it('throws BadRequestException if tenant ID is missing', async () => {
    const leadService = mockLeadService(ok({}));
    platformDb = mockPlatformDb(null);
    const controller = new PublicLeadController(leadService, platformDb, cls);

    await expect(
      controller.createWebToLead({ name: 'John', phone: '1234', source: 'web' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException if tenant is not found', async () => {
    const leadService = mockLeadService(ok({}));
    platformDb = mockPlatformDb(null);
    const controller = new PublicLeadController(leadService, platformDb, cls);

    await expect(
      controller.createWebToLead({ name: 'John', phone: '1234', source: 'web' }, 'invalid-tenant'),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException if tenant is inactive', async () => {
    const leadService = mockLeadService(ok({}));
    platformDb = mockPlatformDb({ id: 'tenant-1', status: 'suspended' });
    const controller = new PublicLeadController(leadService, platformDb, cls);

    await expect(
      controller.createWebToLead({ name: 'John', phone: '1234', source: 'web' }, 'tenant-1'),
    ).rejects.toThrow(BadRequestException);
  });
});
