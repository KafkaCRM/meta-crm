import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { settingsApi } from '@/api/settings';
import { toast } from 'sonner';

const STORAGE_KEY = 'mc_selected_branch';
const STORAGE_KEY_MULTI = 'mc_selected_branches';

function loadPersistedBranchIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MULTI);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    }
    const legacy = localStorage.getItem(STORAGE_KEY);
    if (legacy) return [legacy];
    return [];
  } catch {
    return [];
  }
}

function persistBranchIds(ids: string[]) {
  try {
    if (ids.length > 0) {
      localStorage.setItem(STORAGE_KEY_MULTI, JSON.stringify(ids));
      localStorage.setItem(STORAGE_KEY, ids[0] || '');
    } else {
      localStorage.removeItem(STORAGE_KEY_MULTI);
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* noop */
  }
}

interface BranchContextValue {
  selectedBranchId: string;
  selectedBranchIds: string[];
  setSelectedBranchId: (id: string) => void;
  setSelectedBranchIds: (ids: string[]) => void;
  toggleBranchId: (id: string) => void;
  selectAllBranches: () => void;
  clearAllBranches: () => void;
  isAllBranchesSelected: boolean;
  branches: any[];
  verticals: any[];
  selectedVerticalId: string;
  setSelectedVerticalId: (id: string) => void;
  selectedVerticalIds: string[];
  isLoading: boolean;
  isSingleBranch: boolean;
  isSingleVertical: boolean;
  isSoloTenant: boolean;
}

const BranchContext = createContext<BranchContextValue>({
  selectedBranchId: '',
  selectedBranchIds: [],
  setSelectedBranchId: () => {},
  setSelectedBranchIds: () => {},
  toggleBranchId: () => {},
  selectAllBranches: () => {},
  clearAllBranches: () => {},
  isAllBranchesSelected: true,
  branches: [],
  verticals: [],
  selectedVerticalId: '',
  setSelectedVerticalId: () => {},
  selectedVerticalIds: [],
  isLoading: false,
  isSingleBranch: false,
  isSingleVertical: false,
  isSoloTenant: false,
});

export function BranchProvider({ children }: { children: ReactNode }) {
  const [selectedBranchIds, setSelectedBranchIdsState] = useState<string[]>(loadPersistedBranchIds);
  const [selectedVerticalId, setSelectedVerticalId] = useState('');

  const { data: branches = [] } = useQuery({
    queryKey: ['settings', 'branches', 'accessible'],
    queryFn: () => settingsApi.branches.list({ accessible: true }),
    staleTime: 60_000,
  });

  const branchQueryKey = selectedBranchIds.slice().sort().join(',');
  const { data: verticals = [], isLoading: verticalsLoading } = useQuery({
    queryKey: ['settings', 'verticals', branchQueryKey],
    queryFn: () => {
      if (selectedBranchIds.length === 0) {
        return settingsApi.verticals.list();
      }
      return settingsApi.verticals.list({ branch_ids: selectedBranchIds.join(',') });
    },
    staleTime: 60_000,
  });

  const selectedVerticalIds = verticals.map((v: any) => v.id);
  const isLoading = verticalsLoading && selectedBranchIds.length > 0;

  const isSingleBranch = branches.length <= 1;
  const isSingleVertical = verticals.length <= 1;
  const isSoloTenant = branches.length <= 1 && verticals.length <= 1;
  const isAllBranchesSelected =
    selectedBranchIds.length === 0 || (branches.length > 0 && selectedBranchIds.length === branches.length);

  // Auto-select the branch if the workspace only has 1 branch (individual / solo tenant)
  useEffect(() => {
    const singleBranch = branches[0];
    if (branches.length === 1 && singleBranch && (selectedBranchIds.length !== 1 || selectedBranchIds[0] !== singleBranch.id)) {
      setSelectedBranchIdsState([singleBranch.id]);
      persistBranchIds([singleBranch.id]);
    }
  }, [branches, selectedBranchIds]);

  // Clean up stale IDs if branches loaded
  useEffect(() => {
    if (branches.length > 0 && selectedBranchIds.length > 0) {
      const validIds = selectedBranchIds.filter((id) => branches.some((b: any) => b.id === id));
      if (validIds.length !== selectedBranchIds.length) {
        setSelectedBranchIdsState(validIds);
        persistBranchIds(validIds);
      }
    }
  }, [branches]);

  // Auto-select the vertical if only 1 vertical exists in the current scope
  useEffect(() => {
    const singleVert = verticals[0];
    if (verticals.length === 1 && singleVert && selectedVerticalId !== singleVert.id) {
      setSelectedVerticalId(singleVert.id);
    } else if (selectedVerticalId && !verticals.some((v: any) => v.id === selectedVerticalId)) {
      setSelectedVerticalId('');
    }
  }, [verticals, selectedVerticalId]);

  const handleSetBranchIds = (ids: string[], showToast = true) => {
    setSelectedBranchIdsState(ids);
    persistBranchIds(ids);
    if (showToast) {
      if (ids.length === 0 || (branches.length > 0 && ids.length === branches.length)) {
        toast('Showing all branches');
      } else if (ids.length === 1) {
        const branch = branches.find((b: any) => b.id === ids[0]);
        if (branch) {
          toast.success(`Switched to ${branch.name}`);
        }
      } else {
        toast.success(`Scoped to ${ids.length} branches`);
      }
    }
  };

  const handleSetBranchId = (id: string) => {
    if (!id) {
      handleSetBranchIds([]);
    } else {
      handleSetBranchIds([id]);
    }
  };

  const toggleBranchId = (id: string) => {
    let next: string[];
    if (selectedBranchIds.includes(id)) {
      next = selectedBranchIds.filter((bId) => bId !== id);
    } else {
      next = [...selectedBranchIds, id];
    }
    handleSetBranchIds(next);
  };

  const selectAllBranches = () => {
    handleSetBranchIds([]);
  };

  const clearAllBranches = () => {
    handleSetBranchIds([]);
  };

  const selectedBranchId = selectedBranchIds.length === 1 ? selectedBranchIds[0]! : '';

  return (
    <BranchContext.Provider
      value={{
        selectedBranchId,
        selectedBranchIds,
        setSelectedBranchId: handleSetBranchId,
        setSelectedBranchIds: handleSetBranchIds,
        toggleBranchId,
        selectAllBranches,
        clearAllBranches,
        isAllBranchesSelected,
        branches,
        verticals,
        selectedVerticalId,
        setSelectedVerticalId,
        selectedVerticalIds,
        isLoading,
        isSingleBranch,
        isSingleVertical,
        isSoloTenant,
      }}
    >
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  return useContext(BranchContext);
}
