import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { apiCall } from '@/lib/api';

interface LabelEntry {
  key: string;
  value: string;
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
  const [isLoading, setIsLoading] = useState(false);

  const loadLabels = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiCall<LabelEntry[]>('/labels');
      const map: Record<string, string> = {};
      for (const entry of data) {
        map[entry.key] = entry.value;
      }
      setLabels(map);
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
      return labels[key] ?? key;
    },
    [labels],
  );

  return (
    <LabelsContext.Provider value={{ labels, t, isLoading }}>
      {children}
    </LabelsContext.Provider>
  );
}
