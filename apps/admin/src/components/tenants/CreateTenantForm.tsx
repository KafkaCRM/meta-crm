import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createTenant, CreateTenantResponse, listPlans, listAvailableCapabilities } from '@/api/platform';
import { useNavigate } from '@tanstack/react-router';
import { 
  CheckCircle2, 
  Copy, 
  Check, 
  AlertTriangle, 
  Globe, 
  User, 
  Mail, 
  ShieldAlert, 
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Building,
  Loader2,
  CheckCircle,
  HelpCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth.context';

const INDUSTRIES = ['education', 'healthcare', 'real-estate', 'retail', 'finance', 'technology'];



export function CreateTenantForm() {
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const [step, setStep] = useState(1);
  const [logs, setLogs] = useState<Array<{ stage: string; message: string; progress: number; timestamp: string }>>([]);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [activeStage, setActiveStage] = useState('');
  
  // Step 1: Basic Details
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  
  // Step 2: Entitlements (Slug & Plans)
  const [slug, setSlug] = useState('');
  const [planId, setPlanId] = useState('');
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  
  // Step 3: Capabilities
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([]);
  
  // Step 4: Owner Credentials
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  
  // Submitting and Result States
  const [error, setError] = useState('');
  const [result, setResult] = useState<CreateTenantResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: plans, isLoading: isLoadingPlans, error: plansError } = useQuery({
    queryKey: ['plans'],
    queryFn: listPlans,
  });

  const { data: availableCapabilities = [] } = useQuery({
    queryKey: ['available-capabilities'],
    queryFn: listAvailableCapabilities,
  });

  // Auto-select first plan when plans load
  useEffect(() => {
    if (plans && plans.length > 0 && !planId) {
      const firstPlan = plans[0];
      if (firstPlan) {
        setPlanId(firstPlan.id);
      }
    }
  }, [plans, planId]);

  // Live Slug Checks Mock (with Debounce)
  useEffect(() => {
    if (!slug) {
      setSlugAvailable(null);
      return;
    }
    setCheckingSlug(true);
    const timer = setTimeout(() => {
      setCheckingSlug(false);
      // Simulating slug checks
      setSlugAvailable(slug.length >= 3 && !slug.includes('admin') && !slug.includes('meta'));
    }, 500);
    return () => clearTimeout(timer);
  }, [slug]);

  const handleSlugChange = (val: string) => {
    const sanitized = val
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-');
    setSlug(sanitized);
  };

  const handleIndustryChange = (val: string) => {
    setIndustry(val);
    const coreCap = availableCapabilities.find(c => c.industry === val);
    setSelectedCapabilities(coreCap ? [coreCap.id] : []);
  };

  const handleToggleCapability = (id: string) => {
    setSelectedCapabilities(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleCopyPassword = async (password: string) => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      toast.success('Temporary password copied to clipboard!');
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLogs([]);
    setCurrentProgress(0);
    setActiveStage('VALIDATE');
    setIsSubmitting(true);

    const sessionId = Math.random().toString(36).substring(2, 15);
    const tokenParam = accessToken ? `&token=${encodeURIComponent(accessToken)}` : '';
    const eventSource = new EventSource(`/api/v1/platform/tenants/provision-stream?session=${sessionId}${tokenParam}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLogs((prev) => [
          ...prev,
          {
            stage: data.stage,
            message: data.message,
            progress: data.progress,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
        if (data.progress !== undefined) {
          setCurrentProgress(data.progress);
        }
        if (data.stage) {
          setActiveStage(data.stage);
        }
      } catch (err) {
        console.error('Failed to parse SSE event data', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE Error:', err);
      eventSource.close();
    };

    try {
      const response = await createTenant({
        name,
        slug,
        industry,
        plan_id: planId,
        owner: {
          name: ownerName,
          email: ownerEmail,
        },
        capabilities: selectedCapabilities,
        session_id: sessionId,
      });
      setResult(response);
      toast.success('Workspace tenant provisioned successfully!');
    } catch (err: any) {
      setError(err.message ?? 'Failed to create tenant');
    } finally {
      eventSource.close();
      setIsSubmitting(false);
    }
  };

  // Step Navigations
  const handleNextStep = () => {
    if (step === 1 && (!name.trim() || !industry)) {
      toast.error('Please specify workspace name and select industry scope.');
      return;
    }
    if (step === 2 && (!slug.trim() || !slugAvailable || !planId)) {
      toast.error('Please input a valid URL slug and select subscription plan.');
      return;
    }
    if (step === 4 && (!ownerName.trim() || !ownerEmail.trim() || !ownerEmail.includes('@'))) {
      toast.error('Please enter valid administrator profile details.');
      return;
    }
    setStep(prev => prev + 1);
  };

  const handleBackStep = () => {
    setStep(prev => prev - 1);
  };

  // PROVISIONING STREAM LOGS SCREEN
  if (isSubmitting) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm max-w-2xl mx-auto space-y-6 animate-in fade-in duration-200">
        <div className="flex flex-col items-center text-center pb-6 border-b border-border/50">
          <div className="w-12 h-12 bg-indigo-50/50 text-indigo-600 rounded-full flex items-center justify-center mb-3">
            <Loader2 size={24} className="animate-spin text-fin-orange" />
          </div>
          <h2 className="text-xl font-semibold text-foreground tracking-tight text-center">Provisioning Workspace</h2>
          <p className="text-xs text-muted-foreground mt-1">Please wait while we allocate infrastructure and configure resources.</p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-muted-foreground">Current Stage: <span className="text-indigo-600 font-bold uppercase">{activeStage || 'VALIDATE'}</span></span>
            <span className="text-foreground">{currentProgress}%</span>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-fin-orange h-full rounded-full transition-all duration-500 ease-out" 
              style={{ width: `${currentProgress}%` }}
            />
          </div>
        </div>

        {/* Terminal/Console Logs */}
        <div className="bg-slate-950 text-slate-100 rounded-xl p-4 font-mono text-[11px] leading-relaxed h-64 overflow-y-auto shadow-inner border border-slate-800">
          <div className="text-slate-500 mb-2 border-b border-slate-900 pb-1.5 flex justify-between">
            <span>SYSTEM CONSOLE LOGS</span>
            <span className="animate-pulse text-emerald-400">● LIVE</span>
          </div>
          <div className="space-y-1.5">
            {logs.map((log, index) => (
              <div key={index} className="flex gap-2">
                <span className="text-slate-600">[{log.timestamp}]</span>
                <span className={`font-semibold ${
                  log.stage === 'ERROR' ? 'text-rose-400' :
                  log.stage === 'COMPLETE' ? 'text-emerald-400' :
                  'text-indigo-400'
                }`}>[{log.stage}]</span>
                <span className="text-slate-300">{log.message}</span>
              </div>
            ))}
            {logs.length === 0 && (
              <div className="text-slate-500 italic">Initializing stream connection...</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // SUCCESS SCREEN
  if (result) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm max-w-2xl mx-auto animate-in fade-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center text-center pb-6 border-b border-border/50">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-3">
            <CheckCircle2 size={28} className="animate-bounce" />
          </div>
          <h2 className="text-xl font-semibold text-foreground tracking-tight">Tenant Created Successfully</h2>
          <p className="text-xs text-muted-foreground mt-1">The workspace has been successfully provisioned and is ready for use.</p>
        </div>

        <div className="py-6 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="p-3 bg-muted rounded-lg border border-border/50">
              <span className="text-xs text-muted-foreground font-medium block">Workspace Name</span>
              <span className="font-semibold text-foreground mt-0.5 block">{result.tenant.name}</span>
            </div>
            <div className="p-3 bg-muted rounded-lg border border-border/50">
              <span className="text-xs text-muted-foreground font-medium block">Industry Scope</span>
              <span className="font-semibold text-foreground mt-0.5 block capitalize">{result.tenant.industry}</span>
            </div>
            <div className="p-3 bg-muted rounded-lg border border-border/50 col-span-2">
              <span className="text-xs text-muted-foreground font-medium block">Domain / Access Link</span>
              <span className="font-semibold text-foreground mt-0.5 block flex items-center gap-1.5 font-mono">
                <Globe size={14} className="text-muted-foreground" />
                https://{result.tenant.slug}.meta-crm.local
              </span>
            </div>
            <div className="p-3 bg-muted rounded-lg border border-border/50 col-span-2">
              <span className="text-xs text-muted-foreground font-medium block">Owner Account</span>
              <span className="font-semibold text-foreground mt-0.5 block flex items-center gap-1.5">
                <Mail size={14} className="text-muted-foreground" />
                {result.owner.email}
              </span>
            </div>
          </div>

          <div className="border border-amber-200 bg-amber-50/40 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-2 text-amber-800">
              <ShieldAlert size={16} className="mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold">Temporary Password (Shown Once)</p>
                <p className="text-[11px] text-amber-700/80 mt-0.5">Copy this password now. It is cryptographically salted and cannot be retrieved again.</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 bg-card border border-amber-200/60 rounded-lg p-2.5">
              <span className="font-mono text-lg font-bold text-amber-950 tracking-wider pl-1.5 select-all">
                {result.owner.temporary_password}
              </span>
              <button
                onClick={() => handleCopyPassword(result.owner.temporary_password)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  copied 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                    : 'bg-fin-orange border-indigo-700 text-white hover:bg-fin-orange/90'
                }`}
              >
                {copied ? (
                  <>
                    <Check size={13} />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    Copy Key
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border/50">
          <button
            onClick={() => {
              setResult(null);
              setStep(1);
              setName('');
              setSlug('');
              setIndustry('');
              setPlanId('');
              setOwnerName('');
              setOwnerEmail('');
            }}
            className="w-full py-2.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
          >
            Create Another
          </button>
          
          <button
            onClick={() => navigate({ to: `/admin/tenants/${result.tenant.id}` })}
            className="w-full py-2.5 rounded-lg bg-fin-orange text-white hover:bg-fin-orange/90 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all"
          >
            Manage Tenant
            <ArrowRight size={13} />
          </button>
        </div>
      </div>
    );
  }

  // WIZARD RENDER STEPS
  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm max-w-4xl mx-auto">
      {/* Step Progress indicators */}
      <div className="mb-8 border-b border-border/50 pb-6">
        <div className="flex items-center justify-between">
          {[
            { id: 1, name: 'General', label: 'Basic configurations' },
            { id: 2, name: 'Subscription', label: 'Billing and slugs' },
            { id: 3, name: 'Capabilities', label: 'Add-ons registry' },
            { id: 4, name: 'Administrator', label: 'Primary owner details' },
            { id: 5, name: 'Provision', label: 'System verification' },
          ].map((item, idx) => {
            const isCompleted = step > item.id;
            const isCurrent = step === item.id;
            return (
              <div key={item.id} className="flex-1 relative last:flex-initial">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all border ${
                      isCompleted
                        ? 'bg-fin-orange border-indigo-600 text-white shadow-sm'
                        : isCurrent
                        ? 'bg-card border-indigo-600 text-fin-orange font-bold ring-2 ring-indigo-100'
                        : 'bg-card border-border text-muted-foreground'
                    }`}
                  >
                    {isCompleted ? <Check size={12} strokeWidth={3} /> : item.id}
                  </div>
                  <div className="hidden md:block text-left min-w-0">
                    <p className={`text-xs font-bold truncate leading-none ${isCurrent ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {item.name}
                    </p>
                    <p className="text-[9px] text-muted-foreground truncate mt-0.5">{item.label}</p>
                  </div>
                </div>
                {idx < 4 && (
                  <div className={`hidden md:block absolute top-[13px] left-[135px] right-4 h-0.5 bg-slate-100 -z-10 transition-colors ${step > item.id ? 'bg-fin-orange/30' : ''}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* STEP 1: GENERAL PARAMETERS */}
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 pb-2 border-b border-border/50 mb-2">
              <Building size={16} className="text-fin-orange" />
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Workspace Profile</h3>
            </div>

            <div>
              <label htmlFor="name" className="mb-1 block text-xs font-bold text-foreground/80">
                Workspace / Tenant Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Acme Corporation"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 transition-all font-medium text-foreground"
                required
              />
            </div>

            <div className="pt-2">
              <label htmlFor="industry" className="mb-1 block text-xs font-bold text-foreground/80">
                Industry Scope Focus
              </label>
              <select
                id="industry"
                value={industry}
                onChange={(e) => handleIndustryChange(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-card focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 transition-all cursor-pointer font-medium text-foreground"
                required
              >
                <option value="">Select industry scope focus...</option>
                {INDUSTRIES.map((ind) => (
                  <option key={ind} value={ind}>
                    {ind.charAt(0).toUpperCase() + ind.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* STEP 2: SUBSCRIPTION & INSTANT URL */}
        {step === 2 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 pb-2 border-b border-border/50 mb-2">
              <Globe size={16} className="text-fin-orange" />
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Workspace Subdomain URL & Plan</h3>
            </div>

            <div>
              <label htmlFor="slug" className="mb-1 block text-xs font-bold text-foreground/80">
                Subdomain URL Slug
              </label>
              <div className="relative">
                <input
                  id="slug"
                  type="text"
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="e.g. acme-corp"
                  className={`w-full rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 transition-all ${
                    slugAvailable === true
                      ? 'border-emerald-200 focus:ring-emerald-600 focus:border-emerald-600'
                      : slugAvailable === false
                      ? 'border-rose-200 focus:ring-rose-600 focus:border-rose-600'
                      : 'border-border focus:ring-indigo-600 focus:border-indigo-600'
                  }`}
                  required
                />
                <div className="absolute right-3 top-2.5 flex items-center gap-1.5 text-xs">
                  {checkingSlug && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
                  {!checkingSlug && slugAvailable === true && (
                    <span className="text-emerald-600 font-bold flex items-center gap-1">
                      <CheckCircle size={13} />
                      Available
                    </span>
                  )}
                  {!checkingSlug && slugAvailable === false && (
                    <span className="text-rose-600 font-bold flex items-center gap-1">
                      <AlertTriangle size={13} />
                      Invalid / Taken
                    </span>
                  )}
                </div>
              </div>
              
              <p className="mt-1.5 text-xs text-muted-foreground flex items-center gap-1.5 font-mono bg-muted p-2 rounded border border-border/50 select-all">
                <Globe size={13} className="text-muted-foreground flex-shrink-0" />
                https://{slug || 'workspace'}.meta-crm.local
              </p>
            </div>

            <div>
              <label htmlFor="plan" className="mb-1 block text-xs font-bold text-foreground/80">
                Subscription Plan Entitlements
              </label>
              <select
                id="plan"
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-card focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 transition-all cursor-pointer font-medium text-foreground"
                required
                disabled={isLoadingPlans || !!plansError}
              >
                {isLoadingPlans && <option value="">Loading subscription plans...</option>}
                {plansError && <option value="">Failed to load subscription plans</option>}
                {!isLoadingPlans && !plansError && <option value="">Select plan entitlement...</option>}
                {plans?.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} — Max {plan.max_branches} branches, {plan.max_users} users, {plan.max_plugins} plugins (${plan.price_monthly ?? 0}/mo)
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* STEP 3: CAPABILITIES ADD-ONS */}
        {step === 3 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 pb-2 border-b border-border/50 mb-2">
              <Sparkles size={16} className="text-fin-orange" />
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Workflows & Core Capabilities</h3>
            </div>

            {industry ? (
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] font-bold text-fin-orange tracking-wider uppercase block mb-2">Core Included (Based on Industry: {industry})</span>
                  {availableCapabilities.filter(c => c.industry === industry).map(cap => (
                    <div key={cap.id} className="flex items-start gap-3 p-3 bg-fin-orange/10/40 border border-fin-orange/20 rounded-xl">
                      <input
                        type="checkbox"
                        checked={true}
                        disabled={true}
                        className="mt-0.5 h-4 w-4 rounded border-indigo-300 text-fin-orange focus:ring-indigo-500 cursor-not-allowed"
                      />
                      <div>
                        <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          {cap.name}
                          <span className="text-[9px] font-bold px-1.5 py-0.2 bg-indigo-100 text-fin-orange rounded-full">Core</span>
                        </label>
                        <p className="text-[11px] text-muted-foreground leading-normal mt-0.5">{cap.description}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <span className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase block mb-2">Optional Domain Add-ons</span>
                  <div className="grid gap-3">
                    {availableCapabilities.filter(c => c.industry !== industry).map(cap => {
                      const isChecked = selectedCapabilities.includes(cap.id);
                      return (
                        <div 
                          key={cap.id} 
                          onClick={() => handleToggleCapability(cap.id)}
                          className={`flex items-start gap-3 p-3 rounded-xl border transition-all duration-200 cursor-pointer ${
                            isChecked 
                              ? 'bg-card border-indigo-300 ring-1 ring-indigo-200 shadow-sm' 
                              : 'bg-card/80 border-border hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleToggleCapability(cap.id);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-fin-orange focus:ring-indigo-500 cursor-pointer"
                          />
                          <div>
                            <label className="text-xs font-bold text-foreground cursor-pointer">
                              {cap.name}
                            </label>
                            <p className="text-[11px] text-muted-foreground leading-normal mt-0.5">{cap.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground font-semibold text-xs border border-dashed border-border rounded-xl">
                <HelpCircle size={22} className="mx-auto mb-2 text-muted-foreground/70" />
                Please select an industry scope focus in Step 1.
              </div>
            )}
          </div>
        )}

        {/* STEP 4: ADMINISTRATOR CREDENTIALS */}
        {step === 4 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 pb-2 border-b border-border/50 mb-2">
              <User size={16} className="text-fin-orange" />
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Primary Owner Credentials</h3>
            </div>

            <div>
              <label htmlFor="ownerName" className="mb-1 block text-xs font-bold text-foreground/80">
                Owner Full Name
              </label>
              <input
                id="ownerName"
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="e.g. John Doe"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 transition-all font-medium text-foreground"
                required
              />
            </div>

            <div>
              <label htmlFor="ownerEmail" className="mb-1 block text-xs font-bold text-foreground/80">
                Administrative Email Address
              </label>
              <input
                id="ownerEmail"
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="e.g. owner@acme-corp.com"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 transition-all font-medium text-foreground"
                required
              />
            </div>

            <div className="p-4 bg-amber-50/40 border border-amber-200 text-xs text-amber-900 space-y-2 mt-6 rounded-xl">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertTriangle size={13} className="text-amber-600" />
                Administrative Credentials Verification
              </p>
              <p className="leading-relaxed text-amber-800/90 font-medium">
                Verify this email address. The system will send provisioned verification links and register this address as the root administrator access account for the tenant.
              </p>
            </div>
          </div>
        )}

        {/* STEP 5: REVIEW & VERIFY */}
        {step === 5 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 pb-2 border-b border-border/50 mb-2">
              <Sparkles size={16} className="text-fin-orange animate-pulse" />
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Review & Provision Settings</h3>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs bg-muted border border-border rounded-2xl p-5">
              <div>
                <span className="text-muted-foreground font-semibold block uppercase text-[10px]">Workspace Name</span>
                <span className="font-bold text-foreground mt-1 block">{name}</span>
              </div>
              <div>
                <span className="text-muted-foreground font-semibold block uppercase text-[10px]">Industry Scope Focus</span>
                <span className="font-bold text-foreground mt-1 block capitalize">{industry}</span>
              </div>

              <div>
                <span className="text-muted-foreground font-semibold block uppercase text-[10px]">Entitlement Plan</span>
                <span className="font-bold text-foreground mt-1 block">
                  {plans?.find(p => p.id === planId)?.name || 'Custom'}
                </span>
              </div>
              <div className="col-span-2 border-t border-border/60 pt-3">
                <span className="text-muted-foreground font-semibold block uppercase text-[10px]">Configured URL Domain</span>
                <span className="font-bold text-foreground mt-1 block font-mono">
                  https://{slug}.meta-crm.local
                </span>
              </div>
              <div className="col-span-2 border-t border-border/60 pt-3">
                <span className="text-muted-foreground font-semibold block uppercase text-[10px]">Owner administrator profile</span>
                <span className="font-bold text-foreground mt-1 block">
                  {ownerName} ({ownerEmail})
                </span>
              </div>
            </div>
            
            <div className="p-4 bg-fin-orange/10 border border-fin-orange/20 rounded-xl space-y-1.5">
              <p className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-fin-orange" />
                Verification Status: Clear
              </p>
              <p className="text-[11px] text-fin-orange/90 leading-relaxed font-semibold">
                Core structures confirm. Clicking "Provision Tenant" below begins instant system deployment: creating isolated Postgres workspaces, building metadata tables, and registering primary user privileges.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-850 rounded-lg text-xs font-semibold flex items-center gap-2">
            <AlertTriangle size={14} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Controls Footer */}
        <div className="pt-4 border-t border-border/50 flex justify-between items-center">
          {step > 1 ? (
            <button
              type="button"
              onClick={handleBackStep}
              className="px-4 py-2.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:bg-muted flex items-center gap-1 transition-all cursor-pointer"
            >
              <ArrowLeft size={13} />
              Back
            </button>
          ) : (
            <div />
          )}

          {step < 5 ? (
            <button
              type="button"
              onClick={handleNextStep}
              className="px-5 py-2.5 rounded-lg bg-fin-orange hover:bg-fin-orange/90 text-white text-xs font-bold flex items-center gap-1 transition-all shadow-sm cursor-pointer"
            >
              Next Step
              <ArrowRight size={13} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-lg bg-fin-orange hover:bg-fin-orange/90 text-white disabled:opacity-50 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Deploying systems...
                </>
              ) : (
                <>
                  <Sparkles size={13} />
                  Provision Tenant
                </>
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
