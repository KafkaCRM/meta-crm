import { useLabelsContext } from '@/contexts/labels.context';

export function useLabels() {
  const { t, labels, isLoading } = useLabelsContext();
  return { t, labels, isLoading };
}
