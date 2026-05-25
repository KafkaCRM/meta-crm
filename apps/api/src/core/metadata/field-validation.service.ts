import { Injectable } from '@nestjs/common';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';

@Injectable()
export class FieldValidationService {
  constructor(private readonly db: TenantScopedPrismaService) {}

  async validateAttributes(
    entityType: 'Case' | 'Party',
    attributes: Record<string, unknown>,
  ): Promise<Result<void, string[]>> {
    // 1. Fetch definitions for the active tenant and entity type
    const definitions = await this.db.getClient().fieldDefinition.findMany({
      where: { entity_type: entityType },
    });

    const errors: string[] = [];

    for (const def of definitions) {
      const val = attributes[def.name];
      const hasValue = val !== undefined && val !== null && val !== '';

      // 2. Validate required constraint
      if (def.required && !hasValue) {
        errors.push(`Field "${def.label}" (${def.name}) is required`);
        continue;
      }

      // If optional and has no value, skip type checks
      if (!hasValue) {
        continue;
      }

      // 3. Validate field types
      switch (def.field_type) {
        case 'number': {
          const num = Number(val);
          if (isNaN(num)) {
            errors.push(`Field "${def.label}" must be a valid number`);
          }
          break;
        }
        case 'boolean': {
          if (typeof val !== 'boolean' && val !== 'true' && val !== 'false' && val !== 1 && val !== 0) {
            errors.push(`Field "${def.label}" must be a boolean`);
          }
          break;
        }
        case 'date': {
          const parsedDate = Date.parse(val as string);
          if (isNaN(parsedDate)) {
            errors.push(`Field "${def.label}" must be a valid date format`);
          }
          break;
        }
        case 'select': {
          const options = Array.isArray(def.options) ? def.options : [];
          if (options.length > 0 && !options.includes(val)) {
            errors.push(`Field "${def.label}" must be one of the specified options: [${options.join(', ')}]`);
          }
          break;
        }
        default:
          break;
      }
    }

    if (errors.length > 0) {
      return err(errors);
    }

    return ok(undefined);
  }
}
