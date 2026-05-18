type VisibilityRule = {
  field: string;
  operator: 'eq' | 'neq' | 'in' | 'not_in' | 'gt' | 'lt' | 'is_empty' | 'is_not_empty';
  value: unknown;
};

type VisibilityRuleGroup = {
  all?: VisibilityRuleEntry[];
  any?: VisibilityRuleEntry[];
};

type VisibilityRuleEntry = VisibilityRule | VisibilityRuleGroup;

function evaluateRule(rule: VisibilityRule, values: Readonly<Record<string, unknown>>): boolean {
  const actual = values[rule.field];

  switch (rule.operator) {
    case 'eq':
      return actual === rule.value;
    case 'neq':
      return actual !== rule.value;
    case 'in': {
      if (!Array.isArray(rule.value)) return false;
      return rule.value.includes(actual);
    }
    case 'not_in': {
      if (!Array.isArray(rule.value)) return false;
      return !rule.value.includes(actual);
    }
    case 'gt': {
      if (typeof actual !== 'number' || typeof rule.value !== 'number') return false;
      return actual > rule.value;
    }
    case 'lt': {
      if (typeof actual !== 'number' || typeof rule.value !== 'number') return false;
      return actual < rule.value;
    }
    case 'is_empty':
      return actual === null || actual === undefined || actual === '';
    case 'is_not_empty':
      return actual !== null && actual !== undefined && actual !== '';
  }
}

function isGroup(entry: VisibilityRuleEntry): entry is VisibilityRuleGroup {
  return 'all' in entry || 'any' in entry;
}

function evaluateEntry(entry: VisibilityRuleEntry, values: Readonly<Record<string, unknown>>): boolean {
  if (isGroup(entry)) {
    if ('all' in entry && entry.all !== undefined) {
      if (entry.all.length === 0) return true;
      return entry.all.every((rule) => evaluateEntry(rule, values));
    }
    if ('any' in entry && entry.any !== undefined) {
      if (entry.any.length === 0) return false;
      return entry.any.some((rule) => evaluateEntry(rule, values));
    }
    return true;
  }
  return evaluateRule(entry, values);
}

export function evaluateVisibilityRules(
  rules: VisibilityRuleEntry[],
  values: Readonly<Record<string, unknown>>,
): boolean {
  return rules.every((entry) => evaluateEntry(entry, values));
}
