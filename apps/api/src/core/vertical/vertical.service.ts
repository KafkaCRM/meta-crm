import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';
import { CreateVerticalDto } from './dto/create-vertical.dto';
import { UpdateVerticalDto } from './dto/update-vertical.dto';
import type { VerticalResponse } from './dto/vertical-response.dto';

@Injectable()
export class VerticalService {
  constructor(private readonly db: TenantScopedPrismaService) {}

  async list(tenantId: string, branch_id?: string): Promise<VerticalResponse[]> {
    const where: Record<string, unknown> = { tenant_id: tenantId };
    if (branch_id) {
      where.branch_id = branch_id;
    }

    return this.db.getClient().vertical.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string): Promise<VerticalResponse> {
    const vertical = await this.db.getClient().vertical.findFirst({
      where: { id, tenant_id: tenantId },
    });

    if (!vertical) {
      throw new NotFoundException('Vertical not found');
    }

    return vertical;
  }

  async create(tenantId: string, dto: CreateVerticalDto): Promise<VerticalResponse> {
    return this.db.getClient().vertical.create({
      data: {
        tenant_id: tenantId,
        branch_id: dto.branch_id,
        name: dto.name,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateVerticalDto): Promise<VerticalResponse> {
    const existing = await this.db.getClient().vertical.findFirst({
      where: { id, tenant_id: tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Vertical not found');
    }

    return this.db.getClient().vertical.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
      },
    });
  }
}
