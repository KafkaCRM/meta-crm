import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { apiCall } from '@/lib/api';

type LabelsResponse = Record<string, string> | Array<{ key: string; value: string }>;

export const DEFAULT_FALLBACKS: Record<string, string> = {
  'dashboard.title': 'Dashboard',
  'party.singular': 'Contact',
  'party.plural': 'Contacts',
  'case.singular': 'Case',
  'case.plural': 'Cases',
};

export const INDUSTRY_PRESETS: Record<string, Record<string, string>> = {
  education: {
    'party.singular': 'Student',
    'party.plural': 'Students',
  },
  healthcare: {
    'party.singular': 'Patient',
    'party.plural': 'Patients',
  },
  real_estate: {
    'party.singular': 'Lead',
    'party.plural': 'Leads',
  },
  retail: {
    'party.singular': 'Customer',
    'party.plural': 'Customers',
  },
  technology: {
    'party.singular': 'Account',
    'party.plural': 'Accounts',
  },
  finance: {
    'party.singular': 'Client',
    'party.plural': 'Clients',
  },
};

export function resolveLabel(key: string, overrides: Record<string, string>, industry?: string): string {
  if (key in overrides) return overrides[key] as string;
  const industryMatch = industry && INDUSTRY_PRESETS[industry]?.[key];
  if (industryMatch) return industryMatch;
  if (key in DEFAULT_FALLBACKS) return DEFAULT_FALLBACKS[key] as string;
  const parts = key.split('.');
  const last = parts[parts.length - 1] ?? key;
  return last.charAt(0).toUpperCase() + last.slice(1);
}

interface LabelsContextValue {
  labels: Record<string, string>;
  t: (key: string) => string;
  isLoading: boolean;
}

const LabelsContext = createContext<LabelsContextValue | null>(null);

export function useLabelsContext(): LabelsContextValue {
  const ctx = useContext(LabelsContext);
  if (!ctx) throw new Error('useLabelsContext must be used within LabelsProvider');
  return ctx;
}

export function LabelsProvider({ children }: { children: ReactNode }) {
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [industry, setIndustry] = useState<string | undefined>(undefined);

  const loadLabels = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiCall<LabelsResponse>('/labels');
      if (Array.isArray(data)) {
        const map: Record<string, string> = {};
        for (const entry of data) {
          if (entry.key === '_industry') {
            setIndustry(entry.value);
          } else {
            map[entry.key] = entry.value;
          }
        }
        setLabels(map);
      } else {
        const labelsData = data as Record<string, string>;
        const { _industry, ...rest } = labelsData;
        if (_industry) setIndustry(_industry);
        setLabels(rest);
      }
    } catch {
      // Labels will fall back to defaults — not fatal
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLabels();
  }, [loadLabels]);

  const t = useCallback(
    (key: string): string => {
      return resolveLabel(key, labels, industry);
    },
    [labels, industry],
  );

  if (isLoading) {
    return null;
  }

  return (
    <LabelsContext.Provider value={{ labels, t, isLoading }}>
      {children}
    </LabelsContext.Provider>
  );
}
