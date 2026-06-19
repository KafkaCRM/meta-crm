import { Injectable } from '@nestjs/common';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { PlatformPrismaService } from '../../core/tenant/platform-prisma.service';
import { PlatformAuditService } from '../audit/platform-audit.service';
import { AVAILABLE_CAPABILITIES } from '../../core/capability/capability.service';

export interface CapabilityPricingItem {
  id: string;
  capability_id: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_per_user: number;
}

export interface CapabilityPricingWithStatus extends CapabilityPricingItem {
  enabled: boolean;
}

@Injectable()
export class PricingService {
  constructor(
    private readonly db: PlatformPrismaService,
    private readonly audit: PlatformAuditService,
  ) {}

  async list(): Promise<CapabilityPricingWithStatus[]> {
    const pricings = await this.db.client.capabilityPricing.findMany();

    return AVAILABLE_CAPABILITIES.map((cap) => {
      const existing = pricings.find((p) => p.capability_id === cap.id);
      return {
        id: existing?.id ?? '',
        capability_id: cap.id,
        name: cap.name,
        description: cap.description,
        price_monthly: existing ? Number(existing.price_monthly) : 0,
        price_per_user: existing ? Number(existing.price_per_user) : 0,
        enabled: false,
      };
    });
  }

  async upsert(
    capabilityId: string,
    data: { price_monthly: number; price_per_user: number; name?: string; description?: string },
    auditMeta?: { actor_id: string; actor_role: string; actor_ip: string; user_agent: string },
  ): Promise<Result<CapabilityPricingItem, string>> {
    const cap = AVAILABLE_CAPABILITIES.find((c) => c.id === capabilityId);
    if (!cap) {
      return err(`Capability "${capabilityId}" not found`);
    }

    try {
      const pricing = await this.db.client.capabilityPricing.upsert({
        where: { capability_id: capabilityId },
        create: {
          capability_id: capabilityId,
          name: data.name ?? cap.name,
          description: data.description ?? cap.description,
          price_monthly: data.price_monthly,
          price_per_user: data.price_per_user,
        },
        update: {
          name: data.name ?? cap.name,
          description: data.description ?? cap.description,
          price_monthly: data.price_monthly,
          price_per_user: data.price_per_user,
        },
      });

      if (auditMeta) {
        await this.audit.writeLog({
          actor_id: auditMeta.actor_id,
          actor_role: auditMeta.actor_role,
          action: 'pricing:upsert',
          target_id: capabilityId,
          actor_ip: auditMeta.actor_ip,
          user_agent: auditMeta.user_agent,
          details: { capability_id: capabilityId, ...data },
        });
      }

      return ok({
        id: pricing.id,
        capability_id: pricing.capability_id,
        name: pricing.name,
        description: pricing.description,
        price_monthly: Number(pricing.price_monthly),
        price_per_user: Number(pricing.price_per_user),
      });
    } catch (e: any) {
      return err(e?.message ?? 'Failed to upsert capability pricing');
    }
  }

  async delete(capabilityId: string): Promise<Result<{ message: string }, string>> {
    try {
      await this.db.client.capabilityPricing.delete({
        where: { capability_id: capabilityId },
      });
      return ok({ message: 'Pricing deleted' });
    } catch (e: any) {
      if (e?.code === 'P2025') {
        return ok({ message: 'No pricing found for this capability' });
      }
      return err(e?.message ?? 'Failed to delete pricing');
    }
  }
}
