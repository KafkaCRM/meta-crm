import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { settingsApi } from '@/api/settings';

interface BranchContextValue {
  selectedBranchId: string;
  setSelectedBranchId: (id: string) => void;
  branches: any[];
  selectedVerticalIds: string[];
}

const BranchContext = createContext<BranchContextValue>({
  selectedBranchId: '',
  setSelectedBranchId: () => {},
  branches: [],
  selectedVerticalIds: [],
});

export function BranchProvider({ children }: { children: ReactNode }) {
  const [selectedBranchId, setSelectedBranchId] = useState('');

  const { data: branches = [] } = useQuery({
    queryKey: ['settings', 'branches'],
    queryFn: () => settingsApi.branches.list(),
    staleTime: 60_000,
  });

  const { data: verticals = [] } = useQuery({
    queryKey: ['settings', 'verticals', selectedBranchId],
    queryFn: () => settingsApi.verticals.list(selectedBranchId ? { branch_id: selectedBranchId } : undefined),
    staleTime: 60_000,
    enabled: !!selectedBranchId,
  });

  const selectedVerticalIds = verticals.map((v: any) => v.id);

  return (
    <BranchContext.Provider value={{ selectedBranchId, setSelectedBranchId, branches, selectedVerticalIds }}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  return useContext(BranchContext);
}
