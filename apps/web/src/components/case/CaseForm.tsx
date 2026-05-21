import { useState, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { casesApi } from '@/api/cases';
import { partiesApi } from '@/api/parties';
import { settingsApi } from '@/api/settings';
import { usePermissions } from '@/hooks/usePermissions';
import { useLabels } from '@/hooks/useLabels';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Loader2 } from 'lucide-react';

interface CaseFormProps {
  partyId?: string;
}

export function CaseForm({ partyId: propPartyId }: CaseFormProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const { t } = useLabels();

  // Search parameters for party_id
  const searchPartyId = useMemo(() => {
    if (propPartyId) return propPartyId;
    const search = location.search as any;
    if (search && typeof search === 'object' && search.party_id) {
      return String(search.party_id);
    }
    return '';
  }, [location.search, propPartyId]);

  const [title, setTitle] = useState('');
  const [type, setType] = useState('enrollment');
  const [partyId, setPartyId] = useState(searchPartyId);
  const [assignmentId, setAssignmentId] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 1. Fetch parties (to select one if not prefilled)
  const { data: partiesData, isLoading: partiesLoading } = useQuery({
    queryKey: ['parties', 'list-simple'],
    queryFn: () => partiesApi.list({ limit: 100 }),
    staleTime: 60_000,
  });

  // 2. Fetch specific prefilled party name if searchPartyId exists
  const { data: prefilledParty } = useQuery({
    queryKey: ['parties', searchPartyId],
    queryFn: () => partiesApi.get(searchPartyId),
    enabled: !!searchPartyId,
    staleTime: 60_000,
  });

  // 3. Fetch branch-brand assignments
  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ['settings', 'assignments'],
    queryFn: () => settingsApi.assignments.list(),
    staleTime: 60_000,
  });

  // 4. Fetch branches and brands to resolve their names
  const { data: branches = [] } = useQuery({
    queryKey: ['settings', 'branches'],
    queryFn: () => settingsApi.branches.list(),
    staleTime: 60_000,
  });

  const { data: brands = [] } = useQuery({
    queryKey: ['settings', 'brands'],
    queryFn: () => settingsApi.brands.list(),
    staleTime: 60_000,
  });

  // 5. Fetch team members/users
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['settings', 'users'],
    queryFn: () => settingsApi.users.list(),
    staleTime: 60_000,
  });

  // Build resolved assignments options
  const assignmentOptions = useMemo(() => {
    return assignments.map((asg) => {
      const branchName = branches.find((b) => b.id === asg.branch_id)?.name ?? `Branch (${asg.branch_id})`;
      const brandName = brands.find((b) => b.id === asg.brand_id)?.name ?? `Brand (${asg.brand_id})`;
      return {
        id: asg.id,
        label: `${branchName} · ${brandName} ${asg.is_primary ? '(Primary)' : ''}`,
      };
    });
  }, [assignments, branches, brands]);

  // Set default assignment once loaded
  useMemo(() => {
    if (assignmentOptions.length > 0 && !assignmentId) {
      // Prefill primary or first assignment
      const primary = assignments.find((a) => a.is_primary);
      setAssignmentId(primary ? primary.id : assignmentOptions[0]!.id);
    }
  }, [assignmentOptions, assignmentId, assignments]);

  const createMutation = useMutation({
    mutationFn: (data: {
      title: string;
      type: string;
      party_id: string;
      workflow_definition_id: string;
      branch_brand_assignment_id: string;
      assigned_to_id?: string;
    }) => casesApi.create(data),
    onSuccess: (newCase) => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.invalidateQueries({ queryKey: ['parties', partyId] });
      toast.success('Case created successfully', {
        description: newCase.title,
      });
      navigate({ to: '/cases/$id', params: { id: newCase.id } });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to create case');
    },
  });

  const validate = (): boolean => {
    const nextErrors: Record<string, string> = {};
    if (!title.trim()) nextErrors.title = 'Title is required';
    if (!partyId) nextErrors.partyId = 'Contact selection is required';
    if (!assignmentId) nextErrors.assignmentId = 'Branch assignment is required';

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;

      createMutation.mutate({
        title: title.trim(),
        type,
        party_id: partyId,
        workflow_definition_id: 'wf_default_001',
        branch_brand_assignment_id: assignmentId,
        ...(assignedToId ? { assigned_to_id: assignedToId } : {}),
      });
    },
    [title, type, partyId, assignmentId, assignedToId, createMutation],
  );

  if (!can('create', 'Case')) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-[#9c9fa5]">You do not have permission to create cases.</p>
      </div>
    );
  }

  const isPageLoading = partiesLoading || assignmentsLoading || usersLoading;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (searchPartyId) {
              navigate({ to: '/parties/$id', params: { id: searchPartyId } });
            } else {
              navigate({ to: '/cases' });
            }
          }}
          className="text-[#9c9fa5] hover:text-[#111111] h-8"
        >
          <ArrowLeft size={14} className="mr-1" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-medium text-[#111111] tracking-tight">
            New Case
          </h1>
          <p className="text-sm text-[#9c9fa5] mt-0.5">
            Initialize a new case on default pipeline definition
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#d3cec6] p-8 shadow-none">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#111111]">
              Case Title
            </label>
            <Input
              type="text"
              placeholder="e.g., Admission Inquiry - Rahul Sharma"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-[#f5f1ec] border-[#d3cec6] placeholder:text-[#9c9fa5] focus-visible:ring-[#111111]"
            />
            {errors.title && (
              <p className="text-xs text-red-600 mt-1">{errors.title}</p>
            )}
          </div>

          {/* Type & Workflow */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#111111]">
                Case Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full h-9 rounded-lg border border-[#d3cec6] bg-[#f5f1ec] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#111111] transition-colors"
              >
                <option value="enrollment">Enrollment</option>
                <option value="appointment">Appointment</option>
                <option value="deal">Deal</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#111111]">
                Pipeline Workflow
              </label>
              <select
                disabled
                className="w-full h-9 rounded-lg border border-[#d3cec6]/60 bg-[#f5f1ec]/60 px-3 text-sm text-[#9c9fa5] cursor-not-allowed"
              >
                <option value="wf_default_001">Default Admissions Workflow</option>
              </select>
            </div>
          </div>

          {/* Contact (Party) */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#111111]">
              Select Contact (Party)
            </label>
            {searchPartyId && prefilledParty ? (
              <div className="flex items-center justify-between rounded-lg border border-[#d3cec6]/60 bg-[#f5f1ec]/50 px-3 py-2 text-sm text-[#111111]">
                <div>
                  <p className="font-medium">{prefilledParty.name}</p>
                  <p className="text-xs text-[#9c9fa5]">{prefilledParty.phone_raw} · {prefilledParty.email}</p>
                </div>
                <span className="text-xs bg-[#111111]/10 px-2 py-0.5 rounded text-[#111111] font-semibold">Prefilled</span>
              </div>
            ) : (
              <select
                value={partyId}
                onChange={(e) => setPartyId(e.target.value)}
                className="w-full h-9 rounded-lg border border-[#d3cec6] bg-[#f5f1ec] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#111111] transition-colors"
              >
                <option value="">-- Choose Contact --</option>
                {partiesData?.data.map((party) => (
                  <option key={party.id} value={party.id}>
                    {party.name} ({party.phone_raw})
                  </option>
                ))}
              </select>
            )}
            {errors.partyId && (
              <p className="text-xs text-red-600 mt-1">{errors.partyId}</p>
            )}
          </div>

          {/* Assignment Group */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#111111]">
              Branch & Brand Assignment
            </label>
            <select
              value={assignmentId}
              onChange={(e) => setAssignmentId(e.target.value)}
              className="w-full h-9 rounded-lg border border-[#d3cec6] bg-[#f5f1ec] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#111111] transition-colors"
            >
              <option value="">-- Choose Branch Assignment --</option>
              {assignmentOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
            {errors.assignmentId && (
              <p className="text-xs text-red-600 mt-1">{errors.assignmentId}</p>
            )}
          </div>

          {/* Assigned To (User) */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#111111]">
              Assigned Agent (Optional)
            </label>
            <select
              value={assignedToId}
              onChange={(e) => setAssignedToId(e.target.value)}
              className="w-full h-9 rounded-lg border border-[#d3cec6] bg-[#f5f1ec] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#111111] transition-colors"
            >
              <option value="">-- Unassigned --</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.email})
                </option>
              ))}
            </select>
          </div>

          <Button
            type="submit"
            disabled={createMutation.isPending || isPageLoading}
            className="w-full bg-[#111111] hover:bg-black text-white font-medium rounded-lg h-10 mt-2"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Case...
              </>
            ) : (
              'Create Case'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
