import { Injectable } from '@nestjs/common';

export interface AttributeCriterion {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'exists' | 'regex';
  value?: unknown;
}

export type CriterionRule = AttributeCriterion;

export interface EvaluationResult {
  passed: boolean;
  unmet: string[];
}

@Injectable()
export class CriteriaEvaluatorService {
  evaluate(criteria: CriterionRule[], attributes: Record<string, unknown>): EvaluationResult {
    const unmet: string[] = [];

    for (const rule of criteria) {
      if (rule.operator === 'exists') {
        const val = this.resolveField(attributes, rule.field);
        const expected = rule.value !== false;
        const exists = val !== undefined && val !== null;
        if (expected && !exists) {
          unmet.push(`Field "${rule.field}" is required`);
        } else if (!expected && exists) {
          unmet.push(`Field "${rule.field}" must not be set`);
        }
        continue;
      }

      const attrVal = this.resolveField(attributes, rule.field);
      const criterionVal = rule.value;

      switch (rule.operator) {
        case 'eq':
          if (attrVal !== criterionVal) {
            unmet.push(`Expected ${rule.field} = ${criterionVal}, got ${attrVal}`);
          }
          break;
        case 'neq':
          if (attrVal === criterionVal) {
            unmet.push(`Expected ${rule.field} != ${criterionVal}`);
          }
          break;
        case 'gt':
          if (!(typeof attrVal === 'number' && typeof criterionVal === 'number' && attrVal > criterionVal)) {
            unmet.push(`Expected ${rule.field} > ${criterionVal}, got ${attrVal}`);
          }
          break;
        case 'gte':
          if (!(typeof attrVal === 'number' && typeof criterionVal === 'number' && attrVal >= criterionVal)) {
            unmet.push(`Expected ${rule.field} >= ${criterionVal}, got ${attrVal}`);
          }
          break;
        case 'lt':
          if (!(typeof attrVal === 'number' && typeof criterionVal === 'number' && attrVal < criterionVal)) {
            unmet.push(`Expected ${rule.field} < ${criterionVal}, got ${attrVal}`);
          }
          break;
        case 'lte':
          if (!(typeof attrVal === 'number' && typeof criterionVal === 'number' && attrVal <= criterionVal)) {
            unmet.push(`Expected ${rule.field} <= ${criterionVal}, got ${attrVal}`);
          }
          break;
        case 'in':
          if (!Array.isArray(criterionVal) || !criterionVal.includes(attrVal)) {
            unmet.push(`Expected ${rule.field} in [${criterionVal}], got ${attrVal}`);
          }
          break;
        case 'nin':
          if (Array.isArray(criterionVal) && criterionVal.includes(attrVal)) {
            unmet.push(`Expected ${rule.field} not in [${criterionVal}]`);
          }
          break;
        default:
          unmet.push(`Unknown operator "${rule.operator}" for field "${rule.field}"`);
      }
    }

    return { passed: unmet.length === 0, unmet };
  }

  private resolveField(attributes: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = attributes;
    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }
}
