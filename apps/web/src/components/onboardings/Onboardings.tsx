import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { capabilitiesApi, type Onboarding, type OnboardingStep } from '@/api/capabilities';
import { partiesApi } from '@/api/parties';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ClipboardList, Plus, Trash2, ChevronRight, CheckCircle2, Circle, AlertCircle, PlayCircle, Loader2 } from 'lucide-react';
import dayjs from 'dayjs';

export function Onboardings() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedOnboarding, setSelectedOnboarding] = useState<Onboarding | null>(null);

  // Forms state
  const [partyId, setPartyId] = useState('');
  const [contractValue, setContractValue] = useState<number>(0);
  const [customSteps, setCustomSteps] = useState<{ title: string; order: number }[]>([]);

  // Fetch onboardings list
  const [filterStatus, setFilterStatus] = useState('');
  const { data: onboardings = [], isLoading: loadingOnboardings } = useQuery({
    queryKey: ['onboardings', 'list', filterStatus],
    queryFn: () => capabilitiesApi.onboardings.list({ status: filterStatus || undefined }),
  });

  // Fetch contacts
  const { data: contactsData } = useQuery({
    queryKey: ['parties', 'all'],
    queryFn: () => partiesApi.list({ limit: 100 }),
  });
  const contacts = contactsData?.data ?? [];

  // Create Onboarding mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => capabilitiesApi.onboardings.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboardings'] });
      toast.success('Onboarding checklist initialized successfully!');
      setIsCreateOpen(false);
      resetCreateForm();
    },
    onError: () => toast.error('Failed to create onboarding'),
  });

  // Update Status mutation
  const updateOnboardingMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      capabilitiesApi.onboardings.update(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['onboardings'] });
      toast.success('Onboarding details updated!');
      setSelectedOnboarding(data);
    },
    onError: () => toast.error('Failed to update onboarding'),
  });

  // Update Step mutation
  const toggleStepMutation = useMutation({
    mutationFn: ({ id, stepId, completed }: { id: string; stepId: string; completed: boolean }) =>
      capabilitiesApi.onboardings.updateStep(id, stepId, completed),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['onboardings'] });
      setSelectedOnboarding(data);
    },
    onError: () => toast.error('Failed to update step'),
  });

  const resetCreateForm = () => {
    setPartyId('');
    setContractValue(0);
    setCustomSteps([]);
  };

  const handleCreateOnboarding = () => {
    if (!partyId) {
      toast.error('Please select an account');
      return;
    }

    createMutation.mutate({
      party_id: partyId,
      contract_value: contractValue > 0 ? contractValue : undefined,
      steps: customSteps.length > 0 ? customSteps : undefined,
    });
  };

  const handleOnboardingDetail = async (id: string) => {
    try {
      const onboarding = await capabilitiesApi.onboardings.get(id);
      setSelectedOnboarding(onboarding);
      setIsDetailOpen(true);
    } catch {
      toast.error('Failed to load onboarding details');
    }
  };

  const handleStatusChange = (id: string, status: string) => {
    updateOnboardingMutation.mutate({ id, data: { status } });
  };

  const handleStepToggle = (stepId: string, currentVal: boolean) => {
    if (!selectedOnboarding) return;
    toggleStepMutation.mutate({
      id: selectedOnboarding.id,
      stepId,
      completed: !currentVal,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'completed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'suspended':
        return 'bg-rose-50 text-rose-700 border-rose-100';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-100';
    }
  };

  const calculateProgress = (steps: OnboardingStep[] = []) => {
    if (steps.length === 0) return 0;
    const completed = steps.filter((s) => s.completed).length;
    return Math.round((completed / steps.length) * 100);
  };

  return (
    <div className="space-y-6 max-w-[1280px]">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111111]">Customer Onboarding</h1>
          <p className="text-sm text-[#626260] mt-0.5">Track multi-step customer setup, onboarding workflow milestones, and values</p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if(!open) resetCreateForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-[#111111] hover:bg-black text-white rounded-lg text-sm font-medium h-9 px-4">
              <Plus size={16} className="mr-1.5" />
              Start Onboarding
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md bg-white border border-[#d3cec6] rounded-xl shadow-lg p-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-[#111111]">Start New Customer Onboarding</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-3">
              <div className="space-y-1">
                <Label htmlFor="party" className="text-xs font-semibold text-[#626260]">Client / Account *</Label>
                <select
                  id="party"
                  value={partyId}
                  onChange={(e) => setPartyId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-md bg-[#f5f1ec] border border-[#d3cec6] text-[#111111] focus:outline-none focus:ring-1 focus:ring-[#111111]"
                >
                  <option value="">Select Account</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="contract_value" className="text-xs font-semibold text-[#626260]">Contract Value ($)</Label>
                <Input
                  id="contract_value"
                  type="number"
                  placeholder="0.00"
                  value={contractValue}
                  onChange={(e) => setContractValue(Number(e.target.value))}
                  className="bg-[#f5f1ec] border-[#d3cec6] focus-visible:ring-[#111111]"
                />
              </div>

              <p className="text-xs text-[#9c9fa5] bg-[#f5f1ec] p-2.5 rounded-lg border border-[#ebe7e1]">
                <strong>Notice:</strong> This will create onboarding with the platform's default checklist: Kickoff Call, Account Configuration, User Training, and Go Live.
              </p>
            </div>

            <DialogFooter className="mt-4 flex gap-2">
              <Button
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                className="border-[#d3cec6] text-[#626260] hover:bg-[#f5f1ec]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateOnboarding}
                disabled={createMutation.isPending}
                className="bg-[#111111] hover:bg-black text-white"
              >
                {createMutation.isPending ? 'Starting...' : 'Start Onboarding'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Onboardings List */}
      <Card className="bg-white border-[#d3cec6] rounded-xl shadow-none">
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-4 flex-wrap">
          <CardTitle className="text-base font-semibold text-[#111111]">Ongoing Checklists</CardTitle>
          <div className="flex items-center gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-2 py-1 text-xs rounded-md bg-[#f5f1ec] border border-[#d3cec6] text-[#626260]"
            >
              <option value="">All Checklists</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingOnboardings ? (
            <div className="text-center py-8 text-[#9c9fa5]">Loading onboarding files...</div>
          ) : onboardings.length === 0 ? (
            <div className="text-center py-12 text-[#9c9fa5]">No customer onboarding records found.</div>
          ) : (
            <Table>
              <TableHeader className="bg-[#f5f1ec]">
                <TableRow className="hover:bg-transparent border-b border-[#ebe7e1]">
                  <TableHead className="text-xs font-semibold text-[#626260]">Account Name</TableHead>
                  <TableHead className="text-xs font-semibold text-[#626260]">Setup Value</TableHead>
                  <TableHead className="text-xs font-semibold text-[#626260]">Setup Completion</TableHead>
                  <TableHead className="text-xs font-semibold text-[#626260]">Overall Status</TableHead>
                  <TableHead className="text-xs font-semibold text-[#626260] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {onboardings.map((onb: Onboarding) => {
                  const pct = calculateProgress(onb.steps);
                  const totalSteps = onb.steps?.length ?? 0;
                  const completedSteps = onb.steps?.filter((s) => s.completed).length ?? 0;

                  return (
                    <TableRow key={onb.id} className="border-b border-[#ebe7e1] hover:bg-[#f5f1ec]/30">
                      <TableCell className="font-medium text-[#111111]">{onb.party?.name}</TableCell>
                      <TableCell className="text-sm font-mono text-[#111111]">
                        {onb.contract_value ? `$${onb.contract_value.toLocaleString()}` : '—'}
                      </TableCell>
                      <TableCell className="min-w-[150px]">
                        <div className="flex items-center gap-2">
                          <Progress value={pct} className="h-1.5 w-24 bg-[#ebe7e1]" />
                          <span className="text-xs text-[#626260] font-mono">
                            {completedSteps}/{totalSteps} ({pct}%)
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold uppercase border ${getStatusBadge(onb.status)}`}>
                          {onb.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOnboardingDetail(onb.id)}
                          className="h-7 text-xs text-[#111111] hover:bg-[#f5f1ec]"
                        >
                          Checklist
                          <ChevronRight size={14} className="ml-1" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-md bg-white border border-[#d3cec6] rounded-xl shadow-lg p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-[#111111]">Onboarding Checklist</DialogTitle>
          </DialogHeader>

          {selectedOnboarding && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="font-semibold text-[#9c9fa5]">Client:</p>
                  <p className="font-medium text-[#111111] mt-0.5">{selectedOnboarding.party?.name}</p>
                </div>
                <div>
                  <p className="font-semibold text-[#9c9fa5] text-right">Contract Value:</p>
                  <p className="font-medium text-[#111111] mt-0.5 text-right font-mono">
                    {selectedOnboarding.contract_value ? `$${selectedOnboarding.contract_value.toLocaleString()}` : '—'}
                  </p>
                </div>
              </div>

              <Separator className="bg-[#ebe7e1]" />

              <div className="space-y-1">
                <Label className="text-2xs font-semibold text-[#626260] uppercase">Update Workflow Status</Label>
                <select
                  value={selectedOnboarding.status}
                  onChange={(e) => handleStatusChange(selectedOnboarding.id, e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-md bg-[#f5f1ec] border border-[#d3cec6] text-[#111111]"
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>

              <Separator className="bg-[#ebe7e1]" />

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold text-[#626260]">Milestones / Tasks</span>
                  <span className="text-xs font-mono text-[#111111] font-semibold">
                    {calculateProgress(selectedOnboarding.steps)}% Complete
                  </span>
                </div>
                <Progress value={calculateProgress(selectedOnboarding.steps)} className="h-2 mb-4 bg-[#ebe7e1]" />

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {selectedOnboarding.steps?.map((step) => (
                    <div
                      key={step.id}
                      onClick={() => handleStepToggle(step.id, step.completed)}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        step.completed
                          ? 'bg-emerald-50/40 border-emerald-100 text-emerald-800'
                          : 'bg-[#f5f1ec]/40 border-[#ebe7e1] text-[#111111] hover:bg-[#f5f1ec]'
                      }`}
                    >
                      {step.completed ? (
                        <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
                      ) : (
                        <Circle className="h-4.5 w-4.5 text-[#9c9fa5] shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium truncate ${step.completed ? 'line-through text-emerald-600/80' : ''}`}>
                          {step.title}
                        </p>
                        {step.completed_at && (
                          <p className="text-3xs text-emerald-600/60 mt-0.5">
                            Completed on {dayjs(step.completed_at).format('DD MMM YYYY HH:mm')}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsDetailOpen(false)} className="border-[#d3cec6] text-[#626260] w-full">
              Close Checklist
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
