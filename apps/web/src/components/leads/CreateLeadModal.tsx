import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Loader2,
  Plus,
  AlertTriangle,
  Clock,
  User,
  GraduationCap,
  MessageSquare,
  GitBranch,
  Sliders,
  X,
  UserPlus,
} from 'lucide-react';
import { leadsApi, type CreateLeadDto } from '@/api/leads';
import { campaignsApi, type Campaign } from '@/api/campaigns';
import { settingsApi, type User as TeamUser, type Branch, type Vertical, type FieldDefinition } from '@/api/settings';
import { useBranch } from '@/contexts/branch.context';
import { useAuth } from '@/contexts/auth.context';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';

interface CreateLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const COUNTRY_CODES = [
  { code: '+91', label: '🇮🇳 +91 (IN)' },
  { code: '+1', label: '🇺🇸 +1 (US/CA)' },
  { code: '+44', label: '🇬🇧 +44 (UK)' },
  { code: '+971', label: '🇦🇪 +971 (UAE)' },
  { code: '+61', label: '🇦🇺 +61 (AU)' },
  { code: '+65', label: '🇸🇬 +65 (SG)' },
  { code: '+49', label: '🇩🇪 +49 (DE)' },
  { code: '+33', label: '🇫🇷 +33 (FR)' },
];

const STANDARD_SOURCES = [
  'Manual Entry',
  'Walk-in',
  'Website Form',
  'WhatsApp Inquiry',
  'Meta / Facebook Ad',
  'Google Search PPC',
  'Justdial',
  'Referral',
  'Phone Inquiry',
  'Direct Outreach',
];

const STANDARD_STATUSES = [
  'New',
  'Contacted',
  'Qualified',
  'Proposal Sent',
  'Hot',
  'Won',
  'Enrolled',
  'Lost',
  'Junk',
];

export function CreateLeadModal({ isOpen, onClose, onSuccess }: CreateLeadModalProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { selectedBranchId } = useBranch();

  // Contact Details
  const [name, setName] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [alternatePhone, setAlternatePhone] = useState('');
  const [syncWhatsAppWithMobile, setSyncWhatsAppWithMobile] = useState(true);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [parentsNumber, setParentsNumber] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [dob, setDob] = useState('');

  // Cascade & Routing
  const [branchId, setBranchId] = useState('');
  const [verticalId, setVerticalId] = useState('');
  const [pipelineId, setPipelineId] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [source, setSource] = useState('Manual Entry');
  const [customSources, setCustomSources] = useState<string[]>([]);

  // Assignment & Sales Follow-up
  const [assignedToId, setAssignedToId] = useState('');
  const [assignRoundRobin, setAssignRoundRobin] = useState(false);
  const [status, setStatus] = useState('New');
  const [stage, setStage] = useState('');
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [createdAt, setCreatedAt] = useState(() => dayjs().format('YYYY-MM-DD'));
  const [notes, setNotes] = useState('');

  // Course attributes (if applicable for vertical)
  const [course, setCourse] = useState('');
  const [courseFee, setCourseFee] = useState('');
  const [trainingMode, setTrainingMode] = useState('');

  // Dynamic Custom Fields State
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});

  // Duplicate warning state
  const [duplicateLead, setDuplicateLead] = useState<any | null>(null);

  // Form Validation highlight state
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  // Quick Entity Creator Modal state
  const [activeAddModal, setActiveAddModal] = useState<
    'branch' | 'vertical' | 'pipeline' | 'campaign' | 'source' | 'course' | 'custom_field' | null
  >(null);
  const [addInputValue, setAddInputValue] = useState('');
  const [addExtraValue, setAddExtraValue] = useState('');
  const [addCustomFieldType, setAddCustomFieldType] = useState('text');
  const [addCustomOptions, setAddCustomOptions] = useState('');
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // --- QUERIES ---
  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ['settings', 'branches'],
    queryFn: () => settingsApi.branches.list(),
    enabled: isOpen,
    staleTime: 60_000,
  });

  const { data: verticals = [] } = useQuery<Vertical[]>({
    queryKey: ['settings', 'verticals'],
    queryFn: () => settingsApi.verticals.list(),
    enabled: isOpen,
    staleTime: 60_000,
  });

  const { data: pipelines = [] } = useQuery<any[]>({
    queryKey: ['settings', 'pipelines'],
    queryFn: () => settingsApi.pipelines.list(),
    enabled: isOpen,
    staleTime: 60_000,
  });

  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ['campaigns'],
    queryFn: () => campaignsApi.list(),
    enabled: isOpen,
    staleTime: 60_000,
  });

  const { data: teamUsers = [] } = useQuery<TeamUser[]>({
    queryKey: ['settings', 'users'],
    queryFn: () => settingsApi.users.list(),
    enabled: isOpen,
    staleTime: 60_000,
  });

  // Query real courses from DB for the selected vertical
  const { data: dbCourses = [] } = useQuery<any[]>({
    queryKey: ['courses', verticalId],
    queryFn: async () => {
      const res = await settingsApi.courses.list({ vertical_id: verticalId || undefined });
      return Array.isArray(res) ? res : (res as any)?.data || [];
    },
    enabled: isOpen && !!verticalId,
    staleTime: 30_000,
  });

  // Query real custom fields defined for Leads
  const { data: customFields = [] } = useQuery<FieldDefinition[]>({
    queryKey: ['settings', 'fields', 'Lead'],
    queryFn: () => settingsApi.fieldDefinitions.list('Lead'),
    enabled: isOpen,
    staleTime: 30_000,
  });

  // Auto-fill branch on open
  useEffect(() => {
    if (isOpen && !branchId && branches.length > 0) {
      if (selectedBranchId && branches.some((b) => b.id === selectedBranchId)) {
        setBranchId(selectedBranchId);
      } else if (branches[0]?.id) {
        setBranchId(branches[0].id);
      }
    }
  }, [isOpen, branches, selectedBranchId, branchId]);

  // Sync WhatsApp with mobile
  useEffect(() => {
    if (syncWhatsAppWithMobile) {
      setWhatsappNumber(phone);
    }
  }, [phone, syncWhatsAppWithMobile]);

  // Cascading Verticals: filtered by Branch (memoized)
  const branchVerticals = useMemo(
    () => verticals.filter((v) => !branchId || v.branch_id === branchId),
    [verticals, branchId]
  );

  // Cascading Pipelines: filtered by Vertical (memoized)
  const verticalPipelines = useMemo(
    () => pipelines.filter((p) => !verticalId || p.vertical_id === verticalId),
    [pipelines, verticalId]
  );

  // Selected Pipeline & Stages
  const selectedPipeline = pipelines.find((p) => p.id === pipelineId);
  const availableStages = selectedPipeline?.stages || [];

  // Auto-select single vertical / single pipeline
  useEffect(() => {
    if (branchVerticals.length === 1 && (!verticalId || !branchVerticals.some((v) => v.id === verticalId))) {
      if (branchVerticals[0]?.id) setVerticalId(branchVerticals[0].id);
    } else if (branchVerticals.length > 0 && (!verticalId || !branchVerticals.some((v) => v.id === verticalId))) {
      if (branchVerticals[0]?.id) setVerticalId(branchVerticals[0].id);
    }
  }, [branchVerticals, verticalId]);

  useEffect(() => {
    if (verticalPipelines.length === 1 && (!pipelineId || !verticalPipelines.some((p) => p.id === pipelineId))) {
      const p = verticalPipelines[0];
      if (p?.id) {
        setPipelineId(p.id);
        if (p.stages?.[0]?.id) {
          setStage(p.stages[0].id);
        }
      }
    } else if (verticalPipelines.length > 0 && (!pipelineId || !verticalPipelines.some((p) => p.id === pipelineId))) {
      const p = verticalPipelines[0];
      if (p?.id) {
        setPipelineId(p.id);
        if (p.stages?.[0]?.id) {
          setStage(p.stages[0].id);
        }
      }
    }
  }, [verticalPipelines, pipelineId]);

  // Cascading Campaigns: filtered by branch/vertical/pipeline
  const branchCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      if (branchId && c.branch_id && c.branch_id !== branchId) return false;
      if (verticalId && c.vertical_id && c.vertical_id !== verticalId) return false;
      if (pipelineId && c.pipeline_id && c.pipeline_id !== pipelineId) return false;
      return true;
    });
  }, [campaigns, branchId, verticalId, pipelineId]);

  const handleBranchChange = (newBranchId: string) => {
    setBranchId(newBranchId);
    setVerticalId('');
    setPipelineId('');
    setCampaignId('');
    setStage('');
    setCourse('');
    setCourseFee('');
  };

  const handleVerticalChange = (newVerticalId: string) => {
    setVerticalId(newVerticalId);
    setPipelineId('');
    setCampaignId('');
    setStage('');
    setCourse('');
    setCourseFee('');
  };

  const handlePipelineChange = (newPipelineId: string) => {
    setPipelineId(newPipelineId);
    const pipe = pipelines.find((p) => p.id === newPipelineId);
    if (pipe?.stages && pipe.stages.length > 0) {
      setStage(pipe.stages[0].id);
    } else {
      setStage('');
    }
  };

  const handleCourseChange = (selectedCourseName: string) => {
    setCourse(selectedCourseName);
    const matched = dbCourses.find((c) => c.name === selectedCourseName);
    if (matched?.fee && !courseFee) {
      setCourseFee(String(matched.fee));
    }
  };

  // Live Duplicate Check Engine (phone + email)
  useEffect(() => {
    const rawDigits = phone.replace(/\D/g, '');
    const cleanEmail = email.trim();
    if (rawDigits.length < 8 && (!cleanEmail || !cleanEmail.includes('@'))) {
      setDuplicateLead(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await leadsApi.checkDuplicate({
          phone: rawDigits.length >= 7 ? `${countryCode} ${rawDigits}` : undefined,
          email: cleanEmail.includes('@') ? cleanEmail.toLowerCase() : undefined,
        });
        if (res?.is_duplicate && res.existing_lead) {
          setDuplicateLead(res.existing_lead);
        } else {
          setDuplicateLead(null);
        }
      } catch {}
    }, 400);
    return () => clearTimeout(timer);
  }, [phone, countryCode, email]);

  const resetForm = useCallback(() => {
    setName('');
    setPhone('');
    setAlternatePhone('');
    setWhatsappNumber('');
    setParentsNumber('');
    setEmail('');
    setCity('');
    setDob('');
    setNotes('');
    setCourse('');
    setCourseFee('');
    setTrainingMode('');
    setCustomFieldValues({});
    setDuplicateLead(null);
    setNextFollowUpDate('');
    setStatus('New');
    setCreatedAt(dayjs().format('YYYY-MM-DD'));
    setShowValidationErrors(false);
  }, []);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen, resetForm]);

  const createMutation = useMutation({
    mutationFn: (data: CreateLeadDto) => leadsApi.create(data),
    onSuccess: (newLead) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead created successfully!', {
        description: `${newLead.name} (${newLead.phone})`,
      });
      onSuccess();
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to create lead');
    },
  });

  const validate = () => {
    if (!name.trim()) return false;
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 7) return false;
    if (!branchId) return false;
    if (!verticalId) return false;
    if (!pipelineId) return false;
    return true;
  };

  const executeCreate = (isAddAnother: boolean = false) => {
    if (!validate()) {
      setShowValidationErrors(true);
      toast.error('Please fill in required fields: Name, Mobile, Branch, Vertical, and Pipeline');
      return;
    }
    setShowValidationErrors(false);

    const rawDigits = phone.replace(/\D/g, '');
    const formattedPhone = `${countryCode} ${rawDigits}`;
    const rawWhatsAppDigits = whatsappNumber ? whatsappNumber.replace(/\D/g, '') : rawDigits;
    const formattedWhatsApp = `${countryCode} ${rawWhatsAppDigits}`;

    const attributes: Record<string, any> = {
      ...customFieldValues,
      city: city.trim() || null,
      course: course || null,
      course_fee: courseFee ? Number(courseFee.replace(/[^0-9.]/g, '')) : null,
      training_mode: trainingMode || null,
      parents_number: parentsNumber.trim() || null,
      last_call_disposition: 'New Lead',
    };

    const payload: CreateLeadDto = {
      name: name.trim(),
      phone: formattedPhone,
      alternate_phone: alternatePhone.trim() || null,
      whatsapp_number: formattedWhatsApp,
      email: email.trim().toLowerCase() || null,
      dob: dob || null,
      branch_id: branchId,
      vertical_id: verticalId,
      pipeline_definition_id: pipelineId,
      campaign_id: campaignId || null,
      source: source,
      course: course || null,
      training_mode: trainingMode || null,
      course_fee: courseFee ? Number(courseFee.replace(/[^0-9.]/g, '')) : null,
      city: city.trim() || null,
      assigned_to_id: assignRoundRobin ? null : assignedToId || null,
      assign_round_robin: assignRoundRobin,
      status: status.toLowerCase(),
      stage: stage || null,
      next_follow_up_date: nextFollowUpDate || null,
      created_at: createdAt || null,
      notes: notes.trim() || null,
      parents_number: parentsNumber.trim() || null,
      last_call_disposition: 'New Lead',
      attributes,
    };

    createMutation.mutate(payload, {
      onSuccess: () => {
        if (isAddAnother) {
          resetForm();
          toast.info('Form cleared — ready for next lead entry');
        } else {
          onClose();
        }
      },
    });
  };

  // Keep a stable ref for keyboard shortcut execution
  const executeCreateRef = useRef(executeCreate);
  executeCreateRef.current = executeCreate;

  // Save new entity via "+ Add ..." buttons
  const handleSaveNewEntity = async () => {
    const val = addInputValue.trim();
    if (!val) return;
    setIsSubmittingAdd(true);

    try {
      if (activeAddModal === 'branch') {
        const created = await settingsApi.branches.create({ name: val, city: addExtraValue || undefined });
        await queryClient.invalidateQueries({ queryKey: ['settings', 'branches'] });
        setBranchId(created.id);
        toast.success(`Branch "${created.name}" created and selected!`);
      } else if (activeAddModal === 'vertical') {
        if (!branchId) {
          toast.error('Please select a Branch first!');
          return;
        }
        const created = await settingsApi.verticals.create({ branch_id: branchId, name: val });
        await queryClient.invalidateQueries({ queryKey: ['settings', 'verticals'] });
        setVerticalId(created.id);
        toast.success(`Vertical "${created.name}" created!`);
      } else if (activeAddModal === 'pipeline') {
        if (!verticalId) {
          toast.error('Please select a Vertical first!');
          return;
        }
        const created = await settingsApi.pipelines.create({ vertical_id: verticalId, name: val });
        await queryClient.invalidateQueries({ queryKey: ['settings', 'pipelines'] });
        setPipelineId(created.id);
        toast.success(`Pipeline "${created.name}" created!`);
      } else if (activeAddModal === 'campaign') {
        if (!branchId || !verticalId || !pipelineId) {
          toast.error('Please select Branch, Vertical, and Pipeline first!');
          return;
        }
        const created = await campaignsApi.create({
          name: val,
          channel: addExtraValue || 'walk_in',
          branch_id: branchId,
          vertical_id: verticalId,
          pipeline_id: pipelineId,
          start_date: new Date().toISOString(),
          status: 'active',
        });
        await queryClient.invalidateQueries({ queryKey: ['campaigns'] });
        setCampaignId(created.id);
        toast.success(`Campaign "${created.name}" created!`);
      } else if (activeAddModal === 'source') {
        setCustomSources((prev) => Array.from(new Set([...prev, val])));
        setSource(val);
        toast.success(`Source "${val}" added!`);
      } else if (activeAddModal === 'course') {
        if (!verticalId) {
          toast.error('Please select a Vertical first to create a course!');
          return;
        }
        const created = await settingsApi.courses.create({
          name: val,
          code: val.toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 16) || 'CRS',
          vertical_id: verticalId,
          fee: addExtraValue ? Number(addExtraValue.replace(/[^0-9.]/g, '')) : undefined,
        });
        await queryClient.invalidateQueries({ queryKey: ['courses'] });
        setCourse(created?.name || val);
        if (addExtraValue) setCourseFee(addExtraValue);
        toast.success(`Course "${val}" saved to database!`);
      } else if (activeAddModal === 'custom_field') {
        const fieldName = val.toLowerCase().replace(/[^a-z0-9_]/g, '_');
        const optionsList = addCustomOptions
          ? addCustomOptions.split(',').map((s) => s.trim()).filter(Boolean)
          : undefined;
        await settingsApi.fieldDefinitions.create({
          entity_type: 'Lead',
          name: fieldName,
          label: val,
          field_type: addCustomFieldType || 'text',
          options: optionsList,
          required: false,
          order: customFields.length + 1,
        });
        await queryClient.invalidateQueries({ queryKey: ['settings', 'fields', 'Lead'] });
        toast.success(`Custom field "${val}" added to Lead Form!`);
      }

      setActiveAddModal(null);
      setAddInputValue('');
      setAddExtraValue('');
      setAddCustomOptions('');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create entry');
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  // Keyboard shortcut Ctrl/Cmd + Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || activeAddModal) return;
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        executeCreateRef.current(true);
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        executeCreateRef.current(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeAddModal]);

  const allSources = Array.from(new Set([...STANDARD_SOURCES, ...customSources]));

  const setQuickFollowUp = (mode: '2h' | 'today5pm' | 'tomorrow10am') => {
    let target: dayjs.Dayjs;
    if (mode === '2h') {
      target = dayjs().add(2, 'hour');
    } else if (mode === 'today5pm') {
      target = dayjs().hour(17).minute(0).second(0);
    } else {
      target = dayjs().add(1, 'day').hour(10).minute(0).second(0);
    }
    setNextFollowUpDate(target.format('YYYY-MM-DDTHH:mm'));
  };

  const currentBranch = branches.find((b) => b.id === branchId);
  const currentVertical = verticals.find((v) => v.id === verticalId);
  const currentPipeline = pipelines.find((p) => p.id === pipelineId);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-3xl w-[calc(100%-2rem)] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-background border-border shadow-2xl rounded-2xl">
          {/* 1. HEADER */}
          <DialogHeader className="px-6 py-4 pr-12 border-b border-border bg-card/50 shrink-0">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                  <UserPlus size={18} />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground">
                    Add New Lead
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Capture lead details with automatic branch, vertical, and pipeline routing.
                  </DialogDescription>
                </div>
              </div>

              {/* Hierarchy Context Badge */}
              <div className="hidden sm:flex items-center gap-1.5 text-xs bg-muted/50 px-2.5 py-1 rounded-lg border border-border/60 shrink-0">
                <span className={currentBranch ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
                  {currentBranch?.name || 'Branch'}
                </span>
                <span className="text-border">›</span>
                <span className={currentVertical ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
                  {currentVertical?.name || 'Vertical'}
                </span>
                <span className="text-border">›</span>
                <span className={currentPipeline ? 'font-semibold text-primary' : 'text-muted-foreground'}>
                  {currentPipeline?.name || 'Pipeline'}
                </span>
              </div>
            </div>
          </DialogHeader>

          {/* 2. SCROLLABLE FORM BODY */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* LIVE DUPLICATE WARNING */}
            {duplicateLead && (
              <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 flex items-start justify-between gap-3 text-xs animate-in fade-in duration-150">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Duplicate Lead Warning:</span>
                    <p className="mt-0.5 text-amber-800 dark:text-amber-300">
                      A record with this contact info already exists: <strong>{duplicateLead.name}</strong> ({duplicateLead.phone})
                      {' · '}Status: <span className="capitalize font-semibold">{duplicateLead.status}</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDuplicateLead(null)}
                  className="text-amber-600 hover:text-amber-800 p-0.5 cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* SECTION 1: CONTACT INFORMATION */}
            <div className="bg-card border border-border rounded-xl p-4 space-y-3.5 shadow-none">
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-blue-500/10 text-blue-600 flex items-center justify-center">
                    <User size={12} />
                  </div>
                  <span>Contact Information</span>
                </h4>
                <span className="text-[11px] text-muted-foreground font-medium">* Required</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Full Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Full Name *</label>
                  <Input
                    autoFocus
                    type="text"
                    placeholder="e.g. Rahul Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={cn(
                      "h-9 text-xs bg-background border-border rounded-lg",
                      showValidationErrors && !name.trim() && "border-destructive ring-1 ring-destructive"
                    )}
                  />
                </div>

                {/* Mobile Phone */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Mobile Phone *</label>
                  <div className="flex gap-1.5">
                    <select
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="w-28 h-9 rounded-lg border border-border bg-background text-foreground px-2 text-xs font-mono font-medium focus:ring-1 focus:ring-primary cursor-pointer shrink-0"
                    >
                      {COUNTRY_CODES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <Input
                      type="tel"
                      placeholder="9876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className={cn(
                        "h-9 text-xs bg-background border-border rounded-lg flex-1 font-mono font-medium",
                        showValidationErrors && phone.replace(/\D/g, '').length < 7 && "border-destructive ring-1 ring-destructive"
                      )}
                    />
                  </div>
                </div>

                {/* WhatsApp Number */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <MessageSquare size={13} className="text-emerald-500" />
                      <span>WhatsApp Number</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={syncWhatsAppWithMobile}
                        onChange={(e) => {
                          setSyncWhatsAppWithMobile(e.target.checked);
                          if (e.target.checked) setWhatsappNumber(phone);
                        }}
                        className="rounded text-primary focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span>Same as mobile</span>
                    </label>
                  </div>
                  <div className="flex gap-1.5">
                    <div className="w-28 h-9 rounded-lg border border-border bg-muted/40 px-2 flex items-center justify-center text-xs font-mono text-muted-foreground shrink-0 select-none">
                      {countryCode}
                    </div>
                    <Input
                      type="tel"
                      disabled={syncWhatsAppWithMobile}
                      placeholder="WhatsApp Number"
                      value={syncWhatsAppWithMobile ? phone : whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      className="h-9 text-xs bg-background border-border rounded-lg flex-1 font-mono disabled:opacity-60"
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Email Address</label>
                  <Input
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-9 text-xs bg-background border-border rounded-lg"
                  />
                </div>

                {/* Alternate Phone */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Alternate / Second Phone</label>
                  <Input
                    type="tel"
                    placeholder="Optional second contact number"
                    value={alternatePhone}
                    onChange={(e) => setAlternatePhone(e.target.value)}
                    className="h-9 text-xs bg-background border-border rounded-lg font-mono"
                  />
                </div>

                {/* Parent / Guardian Phone */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Parent / Guardian Phone</label>
                  <Input
                    type="tel"
                    placeholder="Parent or guardian contact"
                    value={parentsNumber}
                    onChange={(e) => setParentsNumber(e.target.value)}
                    className="h-9 text-xs bg-background border-border rounded-lg font-mono"
                  />
                </div>

                {/* City / Location */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">City / Location</label>
                  <Input
                    type="text"
                    placeholder="e.g. New Delhi"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="h-9 text-xs bg-background border-border rounded-lg"
                  />
                </div>

                {/* Date of Birth */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Date of Birth</label>
                  <Input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="h-9 text-xs bg-background border-border rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 2: HIERARCHY TAGGING & SOURCE */}
            <div className="bg-card border border-border rounded-xl p-4 space-y-3.5 shadow-none">
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-purple-500/10 text-purple-600 flex items-center justify-center">
                    <GitBranch size={12} />
                  </div>
                  <span>Hierarchy Tagging & Source</span>
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Branch */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Branch *</label>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={branchId}
                      onChange={(e) => handleBranchChange(e.target.value)}
                      className={cn(
                        "flex-1 h-9 rounded-lg border border-border bg-background text-foreground px-3 text-xs font-medium focus:ring-1 focus:ring-primary cursor-pointer",
                        showValidationErrors && !branchId && "border-destructive ring-1 ring-destructive"
                      )}
                    >
                      <option value="">-- Select Branch --</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0 border-border bg-background hover:bg-muted text-primary cursor-pointer"
                      onClick={() => {
                        setAddInputValue('');
                        setAddExtraValue('');
                        setActiveAddModal('branch');
                      }}
                      title="Add new branch"
                    >
                      <Plus size={14} />
                    </Button>
                  </div>
                </div>

                {/* Vertical */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Vertical *</label>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={verticalId}
                      disabled={!branchId}
                      onChange={(e) => handleVerticalChange(e.target.value)}
                      className={cn(
                        "flex-1 h-9 rounded-lg border border-border bg-background text-foreground px-3 text-xs font-medium focus:ring-1 focus:ring-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
                        showValidationErrors && !verticalId && "border-destructive ring-1 ring-destructive"
                      )}
                    >
                      <option value="">
                        {!branchId ? '-- Choose Branch First --' : '-- Select Vertical --'}
                      </option>
                      {branchVerticals.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={!branchId}
                      className="h-9 w-9 shrink-0 border-border bg-background hover:bg-muted text-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => {
                        setAddInputValue('');
                        setAddExtraValue('');
                        setActiveAddModal('vertical');
                      }}
                      title="Add new vertical"
                    >
                      <Plus size={14} />
                    </Button>
                  </div>
                </div>

                {/* Pipeline */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Pipeline *</label>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={pipelineId}
                      disabled={!verticalId}
                      onChange={(e) => handlePipelineChange(e.target.value)}
                      className={cn(
                        "flex-1 h-9 rounded-lg border border-border bg-background text-foreground px-3 text-xs font-medium focus:ring-1 focus:ring-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
                        showValidationErrors && !pipelineId && "border-destructive ring-1 ring-destructive"
                      )}
                    >
                      <option value="">
                        {!verticalId ? '-- Choose Vertical First --' : '-- Select Pipeline --'}
                      </option>
                      {verticalPipelines.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={!verticalId}
                      className="h-9 w-9 shrink-0 border-border bg-background hover:bg-muted text-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => {
                        setAddInputValue('');
                        setAddExtraValue('');
                        setActiveAddModal('pipeline');
                      }}
                      title="Add new pipeline"
                    >
                      <Plus size={14} />
                    </Button>
                  </div>
                </div>

                {/* Campaign */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Campaign (Optional)</label>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={campaignId}
                      onChange={(e) => setCampaignId(e.target.value)}
                      className="flex-1 h-9 rounded-lg border border-border bg-background text-foreground px-3 text-xs font-medium focus:ring-1 focus:ring-primary cursor-pointer"
                    >
                      <option value="">-- Direct / Organic (No Campaign) --</option>
                      {branchCampaigns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.channel})
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0 border-border bg-background hover:bg-muted text-primary cursor-pointer"
                      onClick={() => {
                        setAddInputValue('');
                        setAddExtraValue('');
                        setActiveAddModal('campaign');
                      }}
                      title="Add new campaign"
                    >
                      <Plus size={14} />
                    </Button>
                  </div>
                </div>

                {/* Lead Source */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Lead Source</label>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                      className="flex-1 h-9 rounded-lg border border-border bg-background text-foreground px-3 text-xs font-medium focus:ring-1 focus:ring-primary cursor-pointer"
                    >
                      {allSources.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0 border-border bg-background hover:bg-muted text-primary cursor-pointer"
                      onClick={() => {
                        setAddInputValue('');
                        setActiveAddModal('source');
                      }}
                      title="Add new lead source"
                    >
                      <Plus size={14} />
                    </Button>
                  </div>
                </div>

                {/* Registration / Capture Date */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Registration / Capture Date</label>
                  <Input
                    type="date"
                    value={createdAt}
                    onChange={(e) => setCreatedAt(e.target.value)}
                    className="h-9 text-xs bg-background border-border rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 3: ASSIGNMENT & FOLLOW-UP */}
            <div className="bg-card border border-border rounded-xl p-4 space-y-3.5 shadow-none">
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-amber-500/10 text-amber-600 flex items-center justify-center">
                    <Clock size={12} />
                  </div>
                  <span>Assignment & Follow-up</span>
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Lead Counsellor */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground">Lead Counsellor</label>
                    <label className="flex items-center gap-1.5 text-[11px] font-medium text-primary cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={assignRoundRobin}
                        onChange={(e) => setAssignRoundRobin(e.target.checked)}
                        className="rounded text-primary focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span>Auto Round-Robin</span>
                    </label>
                  </div>
                  <select
                    disabled={assignRoundRobin}
                    value={assignedToId}
                    onChange={(e) => setAssignedToId(e.target.value)}
                    className="w-full h-9 rounded-lg border border-border bg-background text-foreground px-3 text-xs font-medium focus:ring-1 focus:ring-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">
                      {assignRoundRobin ? 'Auto-assign to available counsellor' : '-- Unassigned --'}
                    </option>
                    {teamUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email || 'User'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Lead Status */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Lead Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full h-9 rounded-lg border border-border bg-background text-foreground px-3 text-xs font-medium focus:ring-1 focus:ring-primary cursor-pointer capitalize"
                  >
                    {STANDARD_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Pipeline Stage */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Pipeline Stage</label>
                  <select
                    value={stage}
                    disabled={availableStages.length === 0}
                    onChange={(e) => setStage(e.target.value)}
                    className="w-full h-9 rounded-lg border border-border bg-background text-foreground px-3 text-xs font-medium focus:ring-1 focus:ring-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {availableStages.length === 0 ? (
                      <option value="">-- No stages defined for pipeline --</option>
                    ) : (
                      availableStages.map((s: any) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Scheduled Next Follow-up */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Scheduled Next Follow-up</label>
                  <Input
                    type="datetime-local"
                    value={nextFollowUpDate}
                    onChange={(e) => setNextFollowUpDate(e.target.value)}
                    className="h-9 text-xs bg-background border-border rounded-lg"
                  />
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] text-muted-foreground">Presets:</span>
                    <button
                      type="button"
                      onClick={() => setQuickFollowUp('2h')}
                      className="px-2 py-0.5 rounded text-[10px] font-semibold bg-muted hover:bg-muted/80 text-foreground transition-colors cursor-pointer"
                    >
                      +2 Hours
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickFollowUp('today5pm')}
                      className="px-2 py-0.5 rounded text-[10px] font-semibold bg-muted hover:bg-muted/80 text-foreground transition-colors cursor-pointer"
                    >
                      Today 5 PM
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickFollowUp('tomorrow10am')}
                      className="px-2 py-0.5 rounded text-[10px] font-semibold bg-muted hover:bg-muted/80 text-foreground transition-colors cursor-pointer"
                    >
                      Tomorrow 10 AM
                    </button>
                  </div>
                </div>

                {/* Initial Remarks / Ingestion Notes */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-semibold text-foreground">Initial Remarks / Ingestion Notes</label>
                  <Input
                    type="text"
                    placeholder="Enter prospect query, background notes, or initial requirements..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="h-9 text-xs bg-background border-border rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 4: INDUSTRY & CUSTOM FIELDS */}
            <div className="bg-card border border-border rounded-xl p-4 space-y-3.5 shadow-none">
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                    <Sliders size={12} />
                  </div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Custom & Industry Fields
                  </h4>
                </div>

                <div className="flex items-center gap-2">
                  {verticalId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setAddInputValue('');
                        setAddExtraValue('');
                        setActiveAddModal('course');
                      }}
                      className="h-7 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10 font-semibold cursor-pointer"
                    >
                      <Plus size={12} className="mr-1" />
                      Add Course
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAddInputValue('');
                      setAddCustomFieldType('text');
                      setAddCustomOptions('');
                      setActiveAddModal('custom_field');
                    }}
                    className="h-7 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10 font-semibold cursor-pointer"
                  >
                    <Plus size={12} className="mr-1" />
                    Add Custom Field
                  </Button>
                </div>
              </div>

              {/* If courses exist for this vertical in the database, render the Course Selector */}
              {dbCourses.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-3 border-b border-border/50">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <GraduationCap size={13} className="text-primary" />
                      <span>Target Course</span>
                    </label>
                    <select
                      value={course}
                      onChange={(e) => handleCourseChange(e.target.value)}
                      className="w-full h-9 rounded-lg border border-border bg-background text-foreground px-3 text-xs font-medium focus:ring-1 focus:ring-primary cursor-pointer"
                    >
                      <option value="">-- Select Course --</option>
                      {dbCourses.map((c: any) => (
                        <option key={c.id || c.name} value={c.name}>
                          {c.name} {c.fee ? `(₹${Number(c.fee).toLocaleString('en-IN')})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Training Mode</label>
                    <select
                      value={trainingMode}
                      onChange={(e) => setTrainingMode(e.target.value)}
                      className="w-full h-9 rounded-lg border border-border bg-background text-foreground px-3 text-xs font-medium focus:ring-1 focus:ring-primary cursor-pointer"
                    >
                      <option value="">-- Mode (Optional) --</option>
                      <option value="Classroom / Offline">Classroom / Offline</option>
                      <option value="Online Live">Online Live</option>
                      <option value="Hybrid">Hybrid</option>
                      <option value="Self-Paced">Self-Paced</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Course Fee (₹)</label>
                    <Input
                      type="text"
                      placeholder="e.g. 15000"
                      value={courseFee}
                      onChange={(e) => setCourseFee(e.target.value)}
                      className="h-9 text-xs bg-background border-border rounded-lg font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Render dynamic custom fields defined for Leads */}
              {customFields.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {customFields.map((field) => {
                    const fieldVal = customFieldValues[field.name] ?? '';

                    if (field.field_type === 'select' || field.field_type === 'multi_select') {
                      const options = Array.isArray(field.options) ? field.options : [];
                      return (
                        <div key={field.id} className="space-y-1.5">
                          <label className="text-xs font-semibold text-foreground">
                            {field.label} {field.required ? '*' : ''}
                          </label>
                          <select
                            value={fieldVal}
                            onChange={(e) =>
                              setCustomFieldValues((prev) => ({
                                ...prev,
                                [field.name]: e.target.value,
                              }))
                            }
                            className="w-full h-9 rounded-lg border border-border bg-background text-foreground px-3 text-xs font-medium focus:ring-1 focus:ring-primary cursor-pointer"
                          >
                            <option value="">-- Select {field.label} --</option>
                            {options.map((opt: string) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    }

                    if (field.field_type === 'boolean') {
                      return (
                        <div key={field.id} className="space-y-1.5">
                          <label className="text-xs font-semibold text-foreground cursor-pointer">
                            {field.label} {field.required ? '*' : ''}
                          </label>
                          <div className="flex items-center justify-between h-9 px-3 rounded-lg border border-border bg-background">
                            <span className="text-xs text-muted-foreground">{fieldVal ? 'Yes' : 'No'}</span>
                            <Switch
                              checked={Boolean(fieldVal)}
                              onCheckedChange={(checked) =>
                                setCustomFieldValues((prev) => ({
                                  ...prev,
                                  [field.name]: checked,
                                }))
                              }
                            />
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={field.id} className="space-y-1.5">
                        <label className="text-xs font-semibold text-foreground">
                          {field.label} {field.required ? '*' : ''}
                        </label>
                        <Input
                          type={field.field_type === 'number' || field.field_type === 'currency' ? 'number' : field.field_type === 'date' ? 'date' : 'text'}
                          placeholder={`Enter ${field.label}...`}
                          value={fieldVal}
                          onChange={(e) =>
                            setCustomFieldValues((prev) => ({
                              ...prev,
                              [field.name]: e.target.value,
                            }))
                          }
                          className="h-9 text-xs bg-background border-border rounded-lg"
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                dbCourses.length === 0 && (
                  <div className="py-4 text-center">
                    <p className="text-xs text-muted-foreground">
                      No custom attributes configured yet. Click "+ Add Custom Field" to customize for your industry.
                    </p>
                  </div>
                )
              )}
            </div>
          </div>

          {/* 3. MODAL FOOTER */}
          <DialogFooter className="m-0 px-6 py-3.5 border-t border-border bg-card/50 shrink-0 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="hidden sm:inline">Shortcut:</span>
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">
                Ctrl + Enter
              </kbd>
              <span>to Save</span>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="h-9 px-4 text-xs font-semibold border-border rounded-xl cursor-pointer"
              >
                Cancel
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={createMutation.isPending}
                onClick={() => executeCreate(true)}
                className="h-9 px-4 text-xs font-semibold border-border bg-background hover:bg-muted rounded-xl cursor-pointer"
              >
                Save & Add Another
              </Button>

              <Button
                type="button"
                disabled={createMutation.isPending}
                onClick={() => executeCreate(false)}
                className="h-9 px-5 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm rounded-xl cursor-pointer"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 size={13} className="animate-spin mr-1.5" />
                    Creating Lead...
                  </>
                ) : (
                  'Create Lead'
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QUICK ADD ENTITY MODAL */}
      {activeAddModal && (
        <Dialog open={!!activeAddModal} onOpenChange={(open) => !open && setActiveAddModal(null)}>
          <DialogContent className="sm:max-w-md w-[calc(100%-2rem)] p-5 bg-background border-border rounded-2xl shadow-xl">
            <DialogHeader className="pb-2 pr-8">
              <DialogTitle className="text-sm font-bold text-foreground capitalize">
                Add New {activeAddModal.replace('_', ' ')}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Create and save a new {activeAddModal.replace('_', ' ')} directly to your workspace.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">
                  {activeAddModal === 'branch'
                    ? 'Branch Name *'
                    : activeAddModal === 'vertical'
                    ? 'Vertical Name *'
                    : activeAddModal === 'pipeline'
                    ? 'Pipeline Name *'
                    : activeAddModal === 'campaign'
                    ? 'Campaign Name *'
                    : activeAddModal === 'course'
                    ? 'Course Name *'
                    : activeAddModal === 'custom_field'
                    ? 'Field Display Label *'
                    : 'Source Name *'}
                </label>
                <Input
                  autoFocus
                  type="text"
                  placeholder={`Enter ${activeAddModal.replace('_', ' ')} title...`}
                  value={addInputValue}
                  onChange={(e) => setAddInputValue(e.target.value)}
                  className="h-9 text-xs bg-background border-border rounded-lg"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && activeAddModal !== 'custom_field') {
                      e.preventDefault();
                      handleSaveNewEntity();
                    }
                  }}
                />
              </div>

              {activeAddModal === 'branch' && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">City (Optional)</label>
                  <Input
                    type="text"
                    placeholder="e.g. New Delhi"
                    value={addExtraValue}
                    onChange={(e) => setAddExtraValue(e.target.value)}
                    className="h-9 text-xs bg-background border-border rounded-lg"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveNewEntity();
                      }
                    }}
                  />
                </div>
              )}

              {activeAddModal === 'course' && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Standard Tuition Fee (₹) (Optional)</label>
                  <Input
                    type="text"
                    placeholder="e.g. 15000"
                    value={addExtraValue}
                    onChange={(e) => setAddExtraValue(e.target.value)}
                    className="h-9 text-xs bg-background border-border rounded-lg font-mono"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveNewEntity();
                      }
                    }}
                  />
                </div>
              )}

              {activeAddModal === 'campaign' && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Marketing Channel</label>
                  <select
                    value={addExtraValue || 'walk_in'}
                    onChange={(e) => setAddExtraValue(e.target.value)}
                    className="w-full h-9 rounded-lg border border-border bg-background text-foreground px-2.5 text-xs font-medium cursor-pointer"
                  >
                    <option value="walk_in">Walk-in</option>
                    <option value="meta_ad">Meta Ad (FB/IG)</option>
                    <option value="google_ad">Google Search PPC</option>
                    <option value="website">Website Webhook</option>
                    <option value="referral">Referral</option>
                  </select>
                </div>
              )}

              {activeAddModal === 'custom_field' && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">Field Type</label>
                    <select
                      value={addCustomFieldType}
                      onChange={(e) => setAddCustomFieldType(e.target.value)}
                      className="w-full h-9 rounded-lg border border-border bg-background text-foreground px-2.5 text-xs font-medium cursor-pointer"
                    >
                      <option value="text">Single Line Text</option>
                      <option value="number">Number</option>
                      <option value="currency">Currency (₹)</option>
                      <option value="select">Dropdown Select</option>
                      <option value="date">Date</option>
                      <option value="boolean">Yes / No Switch</option>
                    </select>
                  </div>

                  {addCustomFieldType === 'select' && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-foreground">
                        Dropdown Options (comma-separated)
                      </label>
                      <Input
                        type="text"
                        placeholder="e.g. 1BHK, 2BHK, 3BHK, Villa"
                        value={addCustomOptions}
                        onChange={(e) => setAddCustomOptions(e.target.value)}
                        className="h-9 text-xs bg-background border-border rounded-lg"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveNewEntity();
                          }
                        }}
                      />
                    </div>
                  )}
                </>
              )}
            </div>

            <DialogFooter className="m-0 pt-3 border-t border-border mt-4 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setActiveAddModal(null)}
                className="h-8 text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!addInputValue.trim() || isSubmittingAdd}
                onClick={handleSaveNewEntity}
                className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold cursor-pointer rounded-lg"
              >
                {isSubmittingAdd ? <Loader2 size={12} className="animate-spin" /> : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
