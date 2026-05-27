import { Injectable, BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';

@Injectable()
export class DynamicValidatorService {
  constructor(private readonly db: TenantScopedPrismaService) {}

  async validateLookupExists(
    tenantId: string,
    relatedTo: string,
    id: string,
  ): Promise<boolean> {
    if (!id || typeof id !== 'string') return false;

    // If it's a custom dynamic object
    if (relatedTo.endsWith('__c')) {
      const record = await this.db.getClient().flexRecord.findFirst({
        where: {
          id,
          tenant_id: tenantId,
          object_type: relatedTo,
        },
      });
      return !!record;
    }

    // Standard CRM objects (e.g. Party, Case, User, Appointment, Invoice, Payment, Property, Order, Onboarding)
    const prismaModelName = relatedTo.charAt(0).toLowerCase() + relatedTo.slice(1);
    const client = this.db.getClient() as any;
    if (client[prismaModelName]) {
      try {
        const record = await client[prismaModelName].findFirst({
          where: {
            id,
            ...(prismaModelName !== 'user' ? { tenant_id: tenantId } : {}),
          },
        });
        return !!record;
      } catch (error) {
        return false;
      }
    }

    return false;
  }

  /**
   * Compiles a Zod schema at runtime from database FieldDefinition configurations
   * and validates the incoming attributes payload.
   */
  async validateAttributes(
    tenantId: string,
    objectType: string,
    attributes: Record<string, any>,
  ): Promise<Record<string, any>> {
    const fields = await this.db.getClient().fieldDefinition.findMany({
      where: { tenant_id: tenantId, entity_type: objectType },
    });

    const schemaFields: Record<string, z.ZodTypeAny> = {};

    for (const field of fields) {
      let validator: z.ZodTypeAny;

      switch (field.field_type) {
        case 'number':
          validator = z.number({
            error: `Field '${field.label}' must be a number`,
          });
          break;
        case 'boolean':
          validator = z.boolean({
            error: `Field '${field.label}' must be a boolean`,
          });
          break;
        case 'date':
          validator = z.string().refine((val) => !isNaN(Date.parse(val)), {
            message: `Field '${field.label}' must be a valid ISO date string`,
          });
          break;
        case 'picklist':
        case 'select':
          // Fetch picklist options from the Json options configuration
          let options: string[] = [];
          if (field.options) {
            if (Array.isArray(field.options)) {
              options = field.options as string[];
            } else if (typeof field.options === 'object') {
              options = (field.options as any).options ?? [];
            }
          }
          if (options.length > 0) {
            validator = z.string().refine((val) => options.includes(val), {
              message: `Field '${field.label}' must be one of: [${options.join(', ')}]`,
            });
          } else {
            validator = z.string();
          }
          break;
        case 'multi_select':
          let multiOptions: string[] = [];
          if (field.options) {
            if (Array.isArray(field.options)) {
              multiOptions = field.options as string[];
            } else if (typeof field.options === 'object') {
              multiOptions = (field.options as any).options ?? [];
            }
          }
          if (multiOptions.length > 0) {
            validator = z.array(z.string()).refine((vals) => Array.isArray(vals) && vals.every((val) => multiOptions.includes(val)), {
              message: `Field '${field.label}' values must be from: [${multiOptions.join(', ')}]`,
            });
          } else {
            validator = z.array(z.string());
          }
          break;
        case 'lookup':
          // Lookups are represented as cuid relationship references
          if (field.related_to) {
            validator = z.string().refine(async (val) => {
              if (!val) return true; // Let required validation handle empty check
              return this.validateLookupExists(tenantId, field.related_to!, val);
            }, {
              message: `Field '${field.label}' refers to a record in '${field.related_to}' that does not exist`,
            });
          } else {
            validator = z.string().refine((val) => /^[a-z0-9]+$/i.test(val), {
              message: `Field '${field.label}' must be a valid reference ID`,
            });
          }
          break;
        case 'text':
        default:
          validator = z.string({
            error: `Field '${field.label}' must be a string`,
          });
          break;
      }

      if (!field.required) {
        validator = validator.optional().nullable();
      } else {
        // Enforce required constraint for custom fields
        validator = validator.refine(
          (val) => val !== undefined && val !== null && val !== '',
          { message: `Field '${field.label}' is required` },
        );
      }

      schemaFields[field.name] = validator;
    }

    const dynamicSchema = z.object(schemaFields);
    const parsed = await dynamicSchema.safeParseAsync(attributes);

    if (!parsed.success) {
      const formattedErrors = parsed.error.format();
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Dynamic fields validation failed',
        errors: formattedErrors,
      });
    }

    return parsed.data;
  }
}
