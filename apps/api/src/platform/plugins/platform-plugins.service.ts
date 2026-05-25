import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { PlatformPrismaService } from '../../core/tenant/platform-prisma.service';

const PluginManifestSchema = z.object({
  id: z.string().min(1, 'Manifest id is required'),
  name: z.string().min(1, 'Manifest name is required'),
  description: z.string().min(1, 'Manifest description is required'),
  compatible_industries: z
    .array(z.string())
    .min(1, 'At least one compatible industry required'),
  hooks: z.array(z.string()).optional().default([]),
  extends: z.array(z.string()).optional().default([]),
  category: z.string().optional(),
  icon: z.string().optional(),
  requires_plan: z.string().optional(),
});

export type PluginManifest = z.infer<typeof PluginManifestSchema>;

export type PlatformPluginErrorCode =
  | 'PLUGIN_NOT_FOUND'
  | 'INVALID_MANIFEST'
  | 'TRANSACTION_FAILED';

export interface PlatformPluginError {
  code: PlatformPluginErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export interface CreatePluginInput {
  package_name: string;
  version: string;
  manifest: Record<string, unknown>;
}

@Injectable()
export class PlatformPluginsService {
  constructor(private readonly db: PlatformPrismaService) {}

  validateManifest(manifest: unknown): Result<PluginManifest, PlatformPluginError> {
    const parsed = PluginManifestSchema.safeParse(manifest);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      return err({
        code: 'INVALID_MANIFEST',
        message: 'Manifest validation failed',
        details: fieldErrors as Record<string, unknown>,
      });
    }
    return ok(parsed.data);
  }

  async list(): Promise<Result<any[], PlatformPluginError>> {
    const plugins = await this.db.client.pluginRegistry.findMany({
      orderBy: { created_at: 'desc' },
    });
    return ok(plugins);
  }

  async create(input: CreatePluginInput): Promise<Result<any, PlatformPluginError>> {
    const validation = this.validateManifest(input.manifest);
    if (validation.isErr()) {
      return err(validation.error);
    }

    try {
      const plugin = await this.db.client.pluginRegistry.create({
        data: {
          package_name: input.package_name,
          version: input.version,
          manifest: input.manifest as any,
          status: 'active',
        },
      });
      return ok(plugin);
    } catch (e: any) {
      return err({ code: 'TRANSACTION_FAILED', message: e?.message ?? 'Failed to create plugin' });
    }
  }

  async deprecate(id: string): Promise<Result<void, PlatformPluginError>> {
    const existing = await this.db.client.pluginRegistry.findUnique({ where: { id } });
    if (!existing) {
      return err({ code: 'PLUGIN_NOT_FOUND', message: 'Plugin not found' });
    }

    await this.db.client.pluginRegistry.update({
      where: { id },
      data: { status: 'deprecated' },
    });

    return ok(undefined);
  }

  async disable(id: string): Promise<Result<void, PlatformPluginError>> {
    const existing = await this.db.client.pluginRegistry.findUnique({ where: { id } });
    if (!existing) {
      return err({ code: 'PLUGIN_NOT_FOUND', message: 'Plugin not found' });
    }

    await this.db.client.pluginRegistry.update({
      where: { id },
      data: { status: 'disabled' },
    });

    return ok(undefined);
  }
}
