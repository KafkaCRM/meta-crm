import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PlatformPrismaService } from '../tenant/platform-prisma.service';

@Injectable()
export class HooksService {
  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly platformDb: PlatformPrismaService,
  ) {}

  private async injectActivePlugins(payload: Record<string, any>): Promise<void> {
    if (payload && payload.tenant_id && typeof payload.tenant_id === 'string' && !payload.active_plugins) {
      try {
        const activePlugins = await this.platformDb.client.tenantPlugin.findMany({
          where: { tenant_id: payload.tenant_id, enabled: true },
          include: { pluginRegistry: true },
        });
        payload.active_plugins = activePlugins.map((tp) => {
          const manifest = tp.pluginRegistry.manifest as any;
          return manifest?.id || tp.pluginRegistry.id;
        });
      } catch (e) {
        payload.active_plugins = [];
      }
    } else if (payload && !payload.active_plugins) {
      payload.active_plugins = [];
    }
  }

  async emit(event: string, payload: Record<string, unknown>): Promise<void> {
    await this.injectActivePlugins(payload);
    this.eventEmitter.emit(event, payload);
  }

  async emitSynchronous(event: string, payload: Record<string, unknown>): Promise<any[]> {
    await this.injectActivePlugins(payload);
    return this.eventEmitter.emitAsync(event, payload);
  }
}
