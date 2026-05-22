import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createTenant, CreateTenantResponse, listPlans } from '@/api/platform';
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
  Sparkles,
  Building
} from 'lucide-react';
import { toast } from 'sonner';

const INDUSTRIES = ['education', 'healthcare', 'real-estate', 'retail', 'finance', 'technology'];

export function CreateTenantForm() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [industry, setIndustry] = useState('');
  const [planId, setPlanId] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<CreateTenantResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: plans } = useQuery({
    queryKey: ['plans'],
    queryFn: listPlans,
  });

  const handleSlugChange = (val: string) => {
    // Auto-sanitize: lowercase, replace spaces/invalid chars with hyphens
    const sanitized = val
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-');
    setSlug(sanitized);
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
    setResult(null);
    setIsSubmitting(true);

    if (!slug) {
      setError('Workspace URL Slug is required');
      setIsSubmitting(false);
      return;
    }

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
      });
      setResult(response);
      toast.success('Workspace tenant provisioned successfully!');
    } catch (err: any) {
      setError(err.message ?? 'Failed to create tenant');
    } finally {
      setIsSubmitting(false);
    }
  };

  // SUCCESS SCREEN
  if (result) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm max-w-2xl mx-auto animate-in fade-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center text-center pb-6 border-b border-slate-100">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-3">
            <CheckCircle2 size={28} className="animate-bounce" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Tenant Created Successfully</h2>
          <p className="text-xs text-slate-400 mt-1">The workspace has been successfully provisioned and is ready for use.</p>
        </div>

        <div className="py-6 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-xs text-slate-400 font-medium block">Workspace Name</span>
              <span className="font-semibold text-slate-900 mt-0.5 block">{result.tenant.name}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-xs text-slate-400 font-medium block">Industry Scope</span>
              <span className="font-semibold text-slate-900 mt-0.5 block capitalize">{result.tenant.industry}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 col-span-2">
              <span className="text-xs text-slate-400 font-medium block">Domain / Access Link</span>
              <span className="font-semibold text-slate-900 mt-0.5 block flex items-center gap-1.5 font-mono">
                <Globe size={14} className="text-slate-400" />
                https://{result.tenant.slug}.meta-crm.local
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 col-span-2">
              <span className="text-xs text-slate-400 font-medium block">Owner Account</span>
              <span className="font-semibold text-slate-900 mt-0.5 block flex items-center gap-1.5">
                <Mail size={14} className="text-slate-400" />
                {result.owner.email}
              </span>
            </div>
          </div>

          {/* Premium Copy Widget for Temporary Password */}
          <div className="border border-amber-200 bg-amber-50/40 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-2 text-amber-800">
              <ShieldAlert size={16} className="mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold">Temporary Password (Shown Once)</p>
                <p className="text-[11px] text-amber-700/80 mt-0.5">Copy this password now. It is cryptographically salted and cannot be retrieved again.</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 bg-white border border-amber-200/60 rounded-lg p-2.5">
              <span className="font-mono text-lg font-bold text-amber-950 tracking-wider pl-1.5 select-all">
                {result.owner.temporary_password}
              </span>
              <button
                onClick={() => handleCopyPassword(result.owner.temporary_password)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  copied 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                    : 'bg-indigo-600 border-indigo-700 text-white hover:bg-indigo-700'
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

        {/* Dynamic Actions Grid */}
        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
          <button
            onClick={() => {
              setResult(null);
              setName('');
              setSlug('');
              setIndustry('');
              setPlanId('');
              setOwnerName('');
              setOwnerEmail('');
            }}
            className="w-full py-2.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all"
          >
            Create Another
          </button>
          
          <button
            onClick={() => navigate({ to: `/admin/tenants/${result.tenant.id}` })}
            className="w-full py-2.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all"
          >
            Manage Tenant
            <ArrowRight size={13} />
          </button>
        </div>
      </div>
    );
  }

  // DEFAULT FORM VIEW
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Provision Workspace Tenant</h2>
        <p className="text-xs text-slate-400 mt-0.5">Fill in the tenant profile and owner account details below to spin up a new isolated organization.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Column 1: Workspace Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <div className="w-6 h-6 rounded-md bg-slate-50 flex items-center justify-center text-slate-500">
                <Building size={14} />
              </div>
              <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Workspace Parameters</h3>
            </div>

            {/* Tenant Name */}
            <div>
              <label htmlFor="name" className="mb-1 block text-xs font-semibold text-slate-600">
                Tenant Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Acme Corporation"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 transition-all"
                required
              />
            </div>

            {/* URL Slug with Dynamic preview */}
            <div>
              <label htmlFor="slug" className="mb-1 block text-xs font-semibold text-slate-600">
                Workspace URL Slug
              </label>
              <input
                id="slug"
                type="text"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="e.g. acme-corp"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 transition-all"
                required
              />
              <p className="mt-1.5 text-xs text-slate-400 flex items-center gap-1.5 font-mono bg-slate-50 p-2 rounded border border-slate-100 select-all">
                <Globe size={13} className="text-slate-400 flex-shrink-0" />
                https://{slug || 'workspace'}.meta-crm.local
              </p>
            </div>

            {/* Industry Selection */}
            <div>
              <label htmlFor="industry" className="mb-1 block text-xs font-semibold text-slate-600">
                Industry Scope
              </label>
              <select
                id="industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 transition-all cursor-pointer"
                required
              >
                <option value="">Select industry scope...</option>
                {INDUSTRIES.map((ind) => (
                  <option key={ind} value={ind}>
                    {ind.charAt(0).toUpperCase() + ind.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Plan Picker */}
            <div>
              <label htmlFor="plan" className="mb-1 block text-xs font-semibold text-slate-600">
                Subscription Plan
              </label>
              <select
                id="plan"
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 transition-all cursor-pointer"
                required
              >
                <option value="">Select plan entitlement...</option>
                {plans?.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} — Max {plan.max_branches} branches, {plan.max_users} users
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Column 2: Owner Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <div className="w-6 h-6 rounded-md bg-slate-50 flex items-center justify-center text-slate-500">
                <User size={14} />
              </div>
              <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Owner Profile</h3>
            </div>

            {/* Owner Name */}
            <div>
              <label htmlFor="ownerName" className="mb-1 block text-xs font-semibold text-slate-600">
                Full Name
              </label>
              <input
                id="ownerName"
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="e.g. John Doe"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 transition-all"
                required
              />
            </div>

            {/* Owner Email */}
            <div>
              <label htmlFor="ownerEmail" className="mb-1 block text-xs font-semibold text-slate-600">
                Administrative Email
              </label>
              <input
                id="ownerEmail"
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="e.g. owner@acme-corp.com"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 transition-all"
                required
              />
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-500 space-y-2 mt-6">
              <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                <AlertTriangle size={13} className="text-amber-600" />
                Administrative Privilege
              </p>
              <p className="leading-relaxed">
                This email will serve as the primary administrator login credential for the new workspace. Upon creation, a strong temporary password will be dynamically generated.
              </p>
            </div>
          </div>

        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-medium flex items-center gap-2">
            <AlertTriangle size={14} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
          >
            {isSubmitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Provisioning...
              </>
            ) : (
              <>
                <Sparkles size={14} />
                Provision Tenant
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
