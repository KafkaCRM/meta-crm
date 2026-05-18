import { describe, it, expect } from 'vitest';
import { evaluateVisibilityRules } from './field-evaluator';
import type { VisibilityRuleEntry } from './schemas';

describe('evaluateVisibilityRules', () => {
  describe('eq operator', () => {
    it('returns true when field equals value (string)', () => {
      const rules: VisibilityRuleEntry[] = [{ field: 'type', operator: 'eq', value: 'individual' }];
      expect(evaluateVisibilityRules(rules, { type: 'individual' })).toBe(true);
    });

    it('returns false when field does not equal value', () => {
      const rules: VisibilityRuleEntry[] = [{ field: 'type', operator: 'eq', value: 'individual' }];
      expect(evaluateVisibilityRules(rules, { type: 'organization' })).toBe(false);
    });

    it('returns false when field is missing', () => {
      const rules: VisibilityRuleEntry[] = [{ field: 'type', operator: 'eq', value: 'individual' }];
      expect(evaluateVisibilityRules(rules, {})).toBe(false);
    });
  });

  describe('neq operator', () => {
    it('returns true when field does not equal value', () => {
      const rules: VisibilityRuleEntry[] = [{ field: 'type', operator: 'neq', value: 'organization' }];
      expect(evaluateVisibilityRules(rules, { type: 'individual' })).toBe(true);
    });

    it('returns false when field equals value', () => {
      const rules: VisibilityRuleEntry[] = [{ field: 'type', operator: 'neq', value: 'individual' }];
      expect(evaluateVisibilityRules(rules, { type: 'individual' })).toBe(false);
    });
  });

  describe('in operator', () => {
    it('returns true when value is in the array', () => {
      const rules: VisibilityRuleEntry[] = [{ field: 'stage', operator: 'in', value: ['new', 'contacted'] }];
      expect(evaluateVisibilityRules(rules, { stage: 'contacted' })).toBe(true);
    });

    it('returns false when value is not in the array', () => {
      const rules: VisibilityRuleEntry[] = [{ field: 'stage', operator: 'in', value: ['new', 'contacted'] }];
      expect(evaluateVisibilityRules(rules, { stage: 'won' })).toBe(false);
    });

    it('returns false when rule value is not an array', () => {
      const rules: VisibilityRuleEntry[] = [{ field: 'stage', operator: 'in', value: 'not-an-array' }];
      expect(evaluateVisibilityRules(rules, { stage: 'new' })).toBe(false);
    });
  });

  describe('not_in operator', () => {
    it('returns true when value is not in the array', () => {
      const rules: VisibilityRuleEntry[] = [{ field: 'stage', operator: 'not_in', value: ['won', 'lost'] }];
      expect(evaluateVisibilityRules(rules, { stage: 'new' })).toBe(true);
    });

    it('returns false when value is in the array', () => {
      const rules: VisibilityRuleEntry[] = [{ field: 'stage', operator: 'not_in', value: ['won', 'lost'] }];
      expect(evaluateVisibilityRules(rules, { stage: 'won' })).toBe(false);
    });

    it('returns false when rule value is not an array for not_in', () => {
      const rules: VisibilityRuleEntry[] = [{ field: 'stage', operator: 'not_in', value: 'not-an-array' }];
      expect(evaluateVisibilityRules(rules, { stage: 'new' })).toBe(false);
    });
  });

  describe('gt operator', () => {
    it('returns true when actual > value', () => {
      const rules: VisibilityRuleEntry[] = [{ field: 'age', operator: 'gt', value: 18 }];
      expect(evaluateVisibilityRules(rules, { age: 25 })).toBe(true);
    });

    it('returns false when actual <= value', () => {
      const rules: VisibilityRuleEntry[] = [{ field: 'age', operator: 'gt', value: 18 }];
      expect(evaluateVisibilityRules(rules, { age: 18 })).toBe(false);
    });

    it('returns false when actual is not a number', () => {
      const rules: VisibilityRuleEntry[] = [{ field: 'age', operator: 'gt', value: 18 }];
      expect(evaluateVisibilityRules(rules, { age: 'twenty-five' })).toBe(false);
    });
  });

  describe('lt operator', () => {
    it('returns true when actual < value', () => {
      const rules: VisibilityRuleEntry[] = [{ field: 'age', operator: 'lt', value: 18 }];
      expect(evaluateVisibilityRules(rules, { age: 15 })).toBe(true);
    });

    it('returns false when actual >= value', () => {
      const rules: VisibilityRuleEntry[] = [{ field: 'age', operator: 'lt', value: 18 }];
      expect(evaluateVisibilityRules(rules, { age: 20 })).toBe(false);
    });
  });

  describe('is_empty operator', () => {
    it('returns true when value is null', () => {
      const rules: VisibilityRuleEntry[] = [{ field: 'email', operator: 'is_empty', value: true }];
      expect(evaluateVisibilityRules(rules, { email: null })).toBe(true);
    });

    it('returns true when value is undefined', () => {
      const rules: VisibilityRuleEntry[] = [{ field: 'email', operator: 'is_empty', value: true }];
      expect(evaluateVisibilityRules(rules, { email: undefined })).toBe(true);
    });

    it('returns true when value is empty string', () => {
      const rules: VisibilityRuleEntry[] = [{ field: 'email', operator: 'is_empty', value: true }];
      expect(evaluateVisibilityRules(rules, { email: '' })).toBe(true);
    });

    it('returns false when value is present', () => {
      const rules: VisibilityRuleEntry[] = [{ field: 'email', operator: 'is_empty', value: true }];
      expect(evaluateVisibilityRules(rules, { email: 'a@b.com' })).toBe(false);
    });
  });

  describe('is_not_empty operator', () => {
    it('returns true when value is present', () => {
      const rules: VisibilityRuleEntry[] = [{ field: 'email', operator: 'is_not_empty', value: true }];
      expect(evaluateVisibilityRules(rules, { email: 'a@b.com' })).toBe(true);
    });

    it('returns false when value is null', () => {
      const rules: VisibilityRuleEntry[] = [{ field: 'email', operator: 'is_not_empty', value: true }];
      expect(evaluateVisibilityRules(rules, { email: null })).toBe(false);
    });

    it('returns false when value is empty string', () => {
      const rules: VisibilityRuleEntry[] = [{ field: 'email', operator: 'is_not_empty', value: true }];
      expect(evaluateVisibilityRules(rules, { email: '' })).toBe(false);
    });
  });

  describe('all (AND) group', () => {
    it('returns true when all rules in all group pass', () => {
      const rules: VisibilityRuleEntry[] = [
        {
          all: [
            { field: 'type', operator: 'eq', value: 'individual' },
            { field: 'age', operator: 'gt', value: 18 },
          ],
        },
      ];
      expect(evaluateVisibilityRules(rules, { type: 'individual', age: 25 })).toBe(true);
    });

    it('returns false when one rule in all group fails', () => {
      const rules: VisibilityRuleEntry[] = [
        {
          all: [
            { field: 'type', operator: 'eq', value: 'individual' },
            { field: 'age', operator: 'gt', value: 18 },
          ],
        },
      ];
      expect(evaluateVisibilityRules(rules, { type: 'organization', age: 25 })).toBe(false);
    });

    it('returns true for empty all group', () => {
      const rules: VisibilityRuleEntry[] = [{ all: [] }];
      expect(evaluateVisibilityRules(rules, {})).toBe(true);
    });
  });

  describe('any (OR) group', () => {
    it('returns true when at least one rule in any group passes', () => {
      const rules: VisibilityRuleEntry[] = [
        {
          any: [
            { field: 'stage', operator: 'eq', value: 'new' },
            { field: 'stage', operator: 'eq', value: 'contacted' },
          ],
        },
      ];
      expect(evaluateVisibilityRules(rules, { stage: 'contacted' })).toBe(true);
    });

    it('returns false when no rules in any group pass', () => {
      const rules: VisibilityRuleEntry[] = [
        {
          any: [
            { field: 'stage', operator: 'eq', value: 'won' },
            { field: 'stage', operator: 'eq', value: 'lost' },
          ],
        },
      ];
      expect(evaluateVisibilityRules(rules, { stage: 'new' })).toBe(false);
    });

    it('returns false for empty any group', () => {
      const rules: VisibilityRuleEntry[] = [{ any: [] }];
      expect(evaluateVisibilityRules(rules, {})).toBe(false);
    });
  });

  describe('mixed top-level entries', () => {
    it('evaluates multiple top-level rules as AND', () => {
      const rules: VisibilityRuleEntry[] = [
        { field: 'type', operator: 'eq', value: 'individual' },
        { field: 'age', operator: 'gt', value: 18 },
      ];
      expect(evaluateVisibilityRules(rules, { type: 'individual', age: 25 })).toBe(true);
    });

    it('returns false when one of multiple top-level rules fails', () => {
      const rules: VisibilityRuleEntry[] = [
        { field: 'type', operator: 'eq', value: 'individual' },
        { field: 'age', operator: 'gt', value: 18 },
      ];
      expect(evaluateVisibilityRules(rules, { type: 'organization', age: 25 })).toBe(false);
    });

    it('returns true for empty rules array', () => {
      expect(evaluateVisibilityRules([], {})).toBe(true);
    });
  });

  describe('nested groups', () => {
    it('evaluates all + any groups together', () => {
      const rules: VisibilityRuleEntry[] = [
        {
          all: [
            { field: 'type', operator: 'eq', value: 'individual' },
            {
              any: [
                { field: 'stage', operator: 'eq', value: 'new' },
                { field: 'stage', operator: 'eq', value: 'contacted' },
              ],
            },
          ],
        },
      ];
      expect(
        evaluateVisibilityRules(rules, { type: 'individual', stage: 'contacted' }),
      ).toBe(true);
    });

    it('evaluates all + any groups together (any fails)', () => {
      const rules: VisibilityRuleEntry[] = [
        {
          all: [
            { field: 'type', operator: 'eq', value: 'individual' },
            {
              any: [
                { field: 'stage', operator: 'eq', value: 'won' },
                { field: 'stage', operator: 'eq', value: 'lost' },
              ],
            },
          ],
        },
      ];
      expect(
        evaluateVisibilityRules(rules, { type: 'individual', stage: 'new' }),
      ).toBe(false);
    });
  });
});
