import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { settingsApi } from '@/api/settings';
import { toast } from 'sonner';

interface BranchContextValue {
  selectedBranchId: string;
  setSelectedBranchId: (id: string) => void;
  branches: any[];
  selectedVerticalIds: string[];
  isLoading: boolean;
}

const BranchContext = createContext<BranchContextValue>({
  selectedBranchId: '',
  setSelectedBranchId: () => {},
  branches: [],
  selectedVerticalIds: [],
  isLoading: false,
});

export function BranchProvider({ children }: { children: ReactNode }) {
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const pendingBranchRef = useRef(false);
  const prevBranchRef = useRef(selectedBranchId);

  const { data: branches = [] } = useQuery({
    queryKey: ['settings', 'branches'],
    queryFn: () => settingsApi.branches.list(),
    staleTime: 60_000,
  });

  const { data: verticals = [], isLoading: verticalsLoading } = useQuery({
    queryKey: ['settings', 'verticals', selectedBranchId],
    queryFn: () => settingsApi.verticals.list(selectedBranchId ? { branch_id: selectedBranchId } : undefined),
    staleTime: 60_000,
    enabled: !!selectedBranchId,
  });

  const selectedVerticalIds = verticals.map((v: any) => v.id);
  const isLoading = verticalsLoading && !!selectedBranchId;

  useEffect(() => {
    if (!pendingBranchRef.current) return;
    if (isLoading) return;
    pendingBranchRef.current = false;
    const branch = branches.find((b: any) => b.id === selectedBranchId);
    if (branch) {
      toast.success(`Switched to ${branch.name}`);
    } else {
      toast('Showing all branches');
    }
  }, [selectedBranchId, verticals, isLoading, branches]);

  const handleSetBranchId = (id: string) => {
    if (id !== selectedBranchId) {
      prevBranchRef.current = selectedBranchId;
      setSelectedBranchId(id);
      if (id) {
        pendingBranchRef.current = true;
      }
    }
  };

  return (
    <BranchContext.Provider value={{ selectedBranchId, setSelectedBranchId: handleSetBranchId, branches, selectedVerticalIds, isLoading }}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  return useContext(BranchContext);
}
