import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { PlatformPrismaService } from '../../core/tenant/platform-prisma.service';
import { PlatformAuditService } from '../audit/platform-audit.service';

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
  constructor(
    private readonly db: PlatformPrismaService,
    private readonly audit: PlatformAuditService,
  ) {}

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

  async create(
    input: CreatePluginInput,
    auditMeta?: { actor_id: string; actor_role: string; actor_ip: string; user_agent: string; reason?: string },
  ): Promise<Result<any, PlatformPluginError>> {
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

      if (auditMeta) {
        await this.audit.writeLog({
          actor_id: auditMeta.actor_id,
          actor_role: auditMeta.actor_role,
          action: 'plugin:create',
          target_id: plugin.id,
          actor_ip: auditMeta.actor_ip,
          user_agent: auditMeta.user_agent,
          details: { plugin_id: plugin.id, package_name: plugin.package_name, version: plugin.version },
          reason: auditMeta.reason,
        });
      }

      return ok(plugin);
    } catch (e: any) {
      return err({ code: 'TRANSACTION_FAILED', message: e?.message ?? 'Failed to create plugin' });
    }
  }

  async deprecate(
    id: string,
    auditMeta?: { actor_id: string; actor_role: string; actor_ip: string; user_agent: string; reason?: string },
  ): Promise<Result<void, PlatformPluginError>> {
    const existing = await this.db.client.pluginRegistry.findUnique({ where: { id } });
    if (!existing) {
      return err({ code: 'PLUGIN_NOT_FOUND', message: 'Plugin not found' });
    }

    await this.db.client.pluginRegistry.update({
      where: { id },
      data: { status: 'deprecated' },
    });

    if (auditMeta) {
      await this.audit.writeLog({
        actor_id: auditMeta.actor_id,
        actor_role: auditMeta.actor_role,
        action: 'plugin:deprecate',
        target_id: id,
        actor_ip: auditMeta.actor_ip,
        user_agent: auditMeta.user_agent,
        details: { plugin_id: id, package_name: existing.package_name },
        reason: auditMeta.reason,
      });
    }

    return ok(undefined);
  }

  async disable(
    id: string,
    auditMeta?: { actor_id: string; actor_role: string; actor_ip: string; user_agent: string; reason?: string },
  ): Promise<Result<void, PlatformPluginError>> {
    const existing = await this.db.client.pluginRegistry.findUnique({ where: { id } });
    if (!existing) {
      return err({ code: 'PLUGIN_NOT_FOUND', message: 'Plugin not found' });
    }

    await this.db.client.pluginRegistry.update({
      where: { id },
      data: { status: 'disabled' },
    });

    if (auditMeta) {
      await this.audit.writeLog({
        actor_id: auditMeta.actor_id,
        actor_role: auditMeta.actor_role,
        action: 'plugin:disable',
        target_id: id,
        actor_ip: auditMeta.actor_ip,
        user_agent: auditMeta.user_agent,
        details: { plugin_id: id, package_name: existing.package_name },
        reason: auditMeta.reason,
      });
    }

    return ok(undefined);
  }
}
