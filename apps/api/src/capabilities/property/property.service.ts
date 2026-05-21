import { Injectable, Logger } from '@nestjs/common';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../../core/tenant/tenant-scoped-prisma.service';
import { ClsService } from 'nestjs-cls';
import type { RequestScope } from '../../core/tenant/request-scope.interface';

export type PropertyErrorCode = 'QUERY_FAILED' | 'NOT_FOUND' | 'TENANT_NOT_FOUND';

export interface PropertyError {
  code: PropertyErrorCode;
  message?: string;
}

export interface CreatePropertyDto {
  title: string;
  description?: string;
  address: string;
  city: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  square_footage: number;
  latitude?: number;
  longitude?: number;
  status?: string;
  images?: string[];
}

export interface UpdatePropertyDto {
  title?: string;
  description?: string;
  address?: string;
  city?: string;
  price?: number;
  bedrooms?: number;
  bathrooms?: number;
  square_footage?: number;
  latitude?: number;
  longitude?: number;
  status?: string;
  images?: string[];
}

@Injectable()
export class PropertyService {
  private readonly logger = new Logger(PropertyService.name);

  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly cls: ClsService,
  ) {}

  private getTenantId(): string | null {
    const scope = this.cls.get<RequestScope>('scope');
    return scope?.tenant_id ?? null;
  }

  async listProperties(filters: {
    city?: string;
    status?: string;
    min_price?: number;
    max_price?: number;
    bedrooms?: number;
  }): Promise<Result<any[], PropertyError>> {
    try {
      const tenantId = this.getTenantId();
      if (!tenantId) {
        return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant context missing' });
      }

      const where: any = { tenant_id: tenantId };
      if (filters.city) {
        where.city = { contains: filters.city, mode: 'insensitive' };
      }
      if (filters.status) {
        where.status = filters.status;
      }
      if (filters.bedrooms) {
        where.bedrooms = { gte: filters.bedrooms };
      }
      if (filters.min_price || filters.max_price) {
        where.price = {};
        if (filters.min_price) {
          where.price.gte = filters.min_price;
        }
        if (filters.max_price) {
          where.price.lte = filters.max_price;
        }
      }

      const properties = await this.db.getClient().property.findMany({
        where,
        orderBy: { price: 'asc' },
      });

      return ok(properties);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async getProperty(id: string): Promise<Result<any, PropertyError>> {
    try {
      const tenantId = this.getTenantId();
      if (!tenantId) {
        return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant context missing' });
      }

      const property = await this.db.getClient().property.findFirst({
        where: { id, tenant_id: tenantId },
      });

      if (!property) {
        return err({ code: 'NOT_FOUND', message: 'Property not found' });
      }

      return ok(property);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async createProperty(dto: CreatePropertyDto): Promise<Result<any, PropertyError>> {
    try {
      const tenantId = this.getTenantId();
      if (!tenantId) {
        return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant context missing' });
      }

      const property = await this.db.getClient().property.create({
        data: {
          tenant_id: tenantId,
          title: dto.title,
          description: dto.description,
          address: dto.address,
          city: dto.city,
          price: dto.price,
          bedrooms: dto.bedrooms,
          bathrooms: dto.bathrooms,
          square_footage: dto.square_footage,
          latitude: dto.latitude,
          longitude: dto.longitude,
          status: dto.status || 'available',
          images: dto.images || [],
        },
      });

      return ok(property);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async updateProperty(id: string, dto: UpdatePropertyDto): Promise<Result<any, PropertyError>> {
    try {
      const tenantId = this.getTenantId();
      if (!tenantId) {
        return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant context missing' });
      }

      const propertyExists = await this.db.getClient().property.findFirst({
        where: { id, tenant_id: tenantId },
      });

      if (!propertyExists) {
        return err({ code: 'NOT_FOUND', message: 'Property not found' });
      }

      const updated = await this.db.getClient().property.update({
        where: { id },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.address !== undefined && { address: dto.address }),
          ...(dto.city !== undefined && { city: dto.city }),
          ...(dto.price !== undefined && { price: dto.price }),
          ...(dto.bedrooms !== undefined && { bedrooms: dto.bedrooms }),
          ...(dto.bathrooms !== undefined && { bathrooms: dto.bathrooms }),
          ...(dto.square_footage !== undefined && { square_footage: dto.square_footage }),
          ...(dto.latitude !== undefined && { latitude: dto.latitude }),
          ...(dto.longitude !== undefined && { longitude: dto.longitude }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.images !== undefined && { images: dto.images }),
        },
      });

      return ok(updated);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async deleteProperty(id: string): Promise<Result<{ success: boolean }, PropertyError>> {
    try {
      const tenantId = this.getTenantId();
      if (!tenantId) {
        return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant context missing' });
      }

      const propertyExists = await this.db.getClient().property.findFirst({
        where: { id, tenant_id: tenantId },
      });

      if (!propertyExists) {
        return err({ code: 'NOT_FOUND', message: 'Property not found' });
      }

      await this.db.getClient().property.delete({
        where: { id },
      });

      return ok({ success: true });
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }
}
