import { useLabelsContext, DEFAULT_FALLBACKS, INDUSTRY_PRESETS, resolveLabel } from '@/contexts/labels.context';

export { DEFAULT_FALLBACKS, INDUSTRY_PRESETS, resolveLabel };

export function useLabels() {
  const { t, labels, isLoading } = useLabelsContext();
  return { t, labels, isLoading };
}
