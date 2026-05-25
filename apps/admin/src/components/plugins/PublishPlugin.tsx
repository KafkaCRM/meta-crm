import { useState, useMemo } from 'react';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createPlugin, listPlugins } from '@/api/platform';
import { CheckCircle2, Zap, PlusCircle, Code2, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/* ------------------------------------------------------------------ */
/*  Plugin catalogue — curated list of first-party plugins            */
/* ------------------------------------------------------------------ */

interface CatalogueEntry {
  package_name: string;
  version: string;
  category: string;
  icon: string;
  manifest: {
    id: string;
    name: string;
    description: string;
    compatible_industries: string[];
    requires_plan?: string;
    hooks: string[];
    extends: string[];
  };
}

const PLUGIN_CATALOGUE: CatalogueEntry[] = [
  // ── Universal ──────────────────────────────────────────────────────
  {
    package_name: '@meta-crm/plugin-email-campaigns',
    version: '1.0.0',
    category: 'Communication',
    icon: '📧',
    manifest: {
      id: 'email-campaigns',
      name: 'Email Campaigns',
      description: 'Send bulk email campaigns to contacts, track opens and clicks, and manage unsubscribes.',
      compatible_industries: ['*'],
      hooks: ['contact:created', 'case:closed'],
      extends: ['Contact', 'Dashboard'],
    },
  },
  {
    package_name: '@meta-crm/plugin-sms-notifications',
    version: '1.0.0',
    category: 'Communication',
    icon: '💬',
    manifest: {
      id: 'sms-notifications',
      name: 'SMS Notifications',
      description: 'Send automated SMS alerts for case updates, appointment reminders, and custom triggers.',
      compatible_industries: ['*'],
      hooks: ['case:stage_changed', 'case:created', 'case:assigned'],
      extends: ['Case'],
    },
  },
  {
    package_name: '@meta-crm/plugin-whatsapp',
    version: '1.0.0',
    category: 'Communication',
    icon: '🟢',
    manifest: {
      id: 'whatsapp-integration',
      name: 'WhatsApp Integration',
      description: 'Two-way WhatsApp messaging from within cases. Auto-route inbound messages to open cases.',
      compatible_industries: ['*'],
      requires_plan: 'Growth',
      hooks: ['case:created', 'case:stage_changed', 'case:closed'],
      extends: ['Case', 'Contact'],
    },
  },
  {
    package_name: '@meta-crm/plugin-zapier',
    version: '1.0.0',
    category: 'Integrations',
    icon: '⚡',
    manifest: {
      id: 'zapier-integration',
      name: 'Zapier Integration',
      description: 'Connect Meta CRM events to 5000+ apps via Zapier triggers and actions.',
      compatible_industries: ['*'],
      requires_plan: 'Growth',
      hooks: ['case:created', 'case:closed', 'contact:created'],
      extends: ['Settings'],
    },
  },
  {
    package_name: '@meta-crm/plugin-analytics-dashboard',
    version: '1.0.0',
    category: 'Analytics',
    icon: '📊',
    manifest: {
      id: 'analytics-dashboard',
      name: 'Advanced Analytics',
      description: 'Rich charts and KPI dashboards for cases, contacts, SLA performance, and team productivity.',
      compatible_industries: ['*'],
      requires_plan: 'Growth',
      hooks: [],
      extends: ['Dashboard'],
    },
  },
  {
    package_name: '@meta-crm/plugin-knowledge-base',
    version: '1.0.0',
    category: 'Productivity',
    icon: '📚',
    manifest: {
      id: 'knowledge-base',
      name: 'Knowledge Base',
      description: 'Internal wiki for agents — articles, FAQs, and resolution playbooks linked to case categories.',
      compatible_industries: ['*'],
      hooks: ['case:created'],
      extends: ['Case', 'Dashboard'],
    },
  },
  // ── Healthcare ─────────────────────────────────────────────────────
  {
    package_name: '@meta-crm/plugin-appointment-scheduler',
    version: '1.0.0',
    category: 'Healthcare',
    icon: '🏥',
    manifest: {
      id: 'appointment-scheduler',
      name: 'Appointment Scheduler',
      description: 'Calendar-based appointment booking for patients. Sends reminders 24h before via SMS or WhatsApp.',
      compatible_industries: ['healthcare'],
      hooks: ['case:created', 'case:stage_changed'],
      extends: ['Case', 'Contact', 'Dashboard'],
    },
  },
  {
    package_name: '@meta-crm/plugin-prescription-tracker',
    version: '1.0.0',
    category: 'Healthcare',
    icon: '💊',
    manifest: {
      id: 'prescription-tracker',
      name: 'Prescription Tracker',
      description: 'Track medication prescriptions linked to patient cases with refill reminders.',
      compatible_industries: ['healthcare'],
      requires_plan: 'Growth',
      hooks: ['case:closed'],
      extends: ['Case'],
    },
  },
  // ── Retail ─────────────────────────────────────────────────────────
  {
    package_name: '@meta-crm/plugin-product-catalog',
    version: '1.0.0',
    category: 'Retail',
    icon: '🛍️',
    manifest: {
      id: 'product-catalog',
      name: 'Product Catalog',
      description: 'Link SKUs and products to cases. Agents can browse and attach products to support tickets.',
      compatible_industries: ['retail'],
      hooks: ['case:created'],
      extends: ['Case'],
    },
  },
  {
    package_name: '@meta-crm/plugin-returns-management',
    version: '1.0.0',
    category: 'Retail',
    icon: '📦',
    manifest: {
      id: 'returns-management',
      name: 'Returns Management',
      description: 'Structured return and refund workflow with approval stages and auto-notifications to customers.',
      compatible_industries: ['retail'],
      requires_plan: 'Growth',
      hooks: ['case:stage_changed', 'case:closed'],
      extends: ['Case'],
    },
  },
  // ── Finance ────────────────────────────────────────────────────────
  {
    package_name: '@meta-crm/plugin-invoice-generator',
    version: '1.0.0',
    category: 'Finance',
    icon: '🧾',
    manifest: {
      id: 'invoice-generator',
      name: 'Invoice Generator',
      description: 'Generate and send PDF invoices from cases. Track payment status and send reminders.',
      compatible_industries: ['finance'],
      requires_plan: 'Growth',
      hooks: ['case:closed'],
      extends: ['Case', 'Contact'],
    },
  },
  {
    package_name: '@meta-crm/plugin-compliance-audit',
    version: '1.0.0',
    category: 'Finance',
    icon: '🔒',
    manifest: {
      id: 'compliance-audit',
      name: 'Compliance Audit Log',
      description: 'Immutable audit trail for all case actions — required for financial regulatory compliance.',
      compatible_industries: ['finance'],
      requires_plan: 'Enterprise',
      hooks: ['case:created', 'case:stage_changed', 'case:closed', 'case:assigned'],
      extends: ['Case', 'Settings'],
    },
  },
  // ── Real Estate ────────────────────────────────────────────────────
  {
    package_name: '@meta-crm/plugin-property-listings',
    version: '1.0.0',
    category: 'Real Estate',
    icon: '🏠',
    manifest: {
      id: 'property-listings',
      name: 'Property Listings',
      description: 'Attach property listings to contacts and cases. Track viewing history and offers.',
      compatible_industries: ['real_estate'],
      hooks: ['case:created', 'contact:created'],
      extends: ['Case', 'Contact'],
    },
  },
  {
    package_name: '@meta-crm/plugin-document-signing',
    version: '1.0.0',
    category: 'Real Estate',
    icon: '✍️',
    manifest: {
      id: 'document-signing',
      name: 'Document E-Signing',
      description: 'Send lease agreements and contracts for e-signature directly from cases.',
      compatible_industries: ['real_estate'],
      requires_plan: 'Growth',
      hooks: ['case:stage_changed'],
      extends: ['Case'],
    },
  },
  // ── Education ──────────────────────────────────────────────────────
  {
    package_name: '@meta-crm/plugin-enrollment-manager',
    version: '1.0.0',
    category: 'Education',
    icon: '🎓',
    manifest: {
      id: 'enrollment-manager',
      name: 'Enrollment Manager',
      description: 'Track student enrollment inquiries, applications, and acceptance workflows as cases.',
      compatible_industries: ['education'],
      hooks: ['case:created', 'case:stage_changed', 'case:closed'],
      extends: ['Case', 'Contact', 'Dashboard'],
    },
  },
  {
    package_name: '@meta-crm/plugin-course-catalog',
    version: '1.0.0',
    category: 'Education',
    icon: '📖',
    manifest: {
      id: 'course-catalog',
      name: 'Course Catalog',
      description: 'Link courses and programmes to cases and contacts. Track interest and conversion.',
      compatible_industries: ['education'],
      hooks: ['contact:created'],
      extends: ['Case', 'Contact'],
    },
  },
  // ── Hospitality ────────────────────────────────────────────────────
  {
    package_name: '@meta-crm/plugin-reservation-manager',
    version: '1.0.0',
    category: 'Hospitality',
    icon: '🏨',
    manifest: {
      id: 'reservation-manager',
      name: 'Reservation Manager',
      description: 'Manage hotel or venue reservations linked to guest profiles. Handle modifications and cancellations.',
      compatible_industries: ['hospitality'],
      hooks: ['case:created', 'case:stage_changed', 'case:closed'],
      extends: ['Case', 'Contact'],
    },
  },
  {
    package_name: '@meta-crm/plugin-guest-feedback',
    version: '1.0.0',
    category: 'Hospitality',
    icon: '⭐',
    manifest: {
      id: 'guest-feedback',
      name: 'Guest Feedback & Reviews',
      description: 'Collect post-stay reviews, track NPS scores, and auto-escalate negative feedback as cases.',
      compatible_industries: ['hospitality'],
      hooks: ['case:closed'],
      extends: ['Case', 'Dashboard'],
    },
  },
];

const INDUSTRY_COLOURS: Record<string, string> = {
  Healthcare:   'bg-blue-50 text-blue-700 border-blue-200',
  Retail:       'bg-orange-50 text-orange-700 border-orange-200',
  Finance:      'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Real Estate':'bg-purple-50 text-purple-700 border-purple-200',
  Education:    'bg-yellow-50 text-yellow-700 border-yellow-200',
  Hospitality:  'bg-rose-50 text-rose-700 border-rose-200',
  Communication:'bg-sky-50 text-sky-700 border-sky-200',
  Integrations: 'bg-violet-50 text-violet-700 border-violet-200',
  Analytics:    'bg-teal-50 text-teal-700 border-teal-200',
  Productivity: 'bg-lime-50 text-lime-700 border-lime-200',
};

/* ------------------------------------------------------------------ */
/*  Manifest schema for custom tab                                      */
/* ------------------------------------------------------------------ */

const PluginManifestSchema = z.object({
  id: z.string().min(1, 'Manifest id is required'),
  name: z.string().min(1, 'Manifest name is required'),
  description: z.string().min(1, 'Manifest description is required'),
  compatible_industries: z.array(z.string()).min(1, 'At least one compatible industry required'),
  hooks: z.array(z.string()).optional().default([]),
  extends: z.array(z.string()).optional().default([]),
  category: z.string().optional(),
  icon: z.string().optional(),
  requires_plan: z.string().optional(),
});

const defaultManifest = `{
  "id": "my-custom-plugin",
  "name": "My Custom Plugin",
  "description": "Describe what this plugin does",
  "compatible_industries": ["*"],
  "hooks": ["case:stage_changed"],
  "extends": ["Case"]
}`;

/* ------------------------------------------------------------------ */
/*  Main component                                                      */
/* ------------------------------------------------------------------ */

export function PublishPlugin() {
  const [tab, setTab] = useState<'discover' | 'custom'>('discover');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [justRegistered, setJustRegistered] = useState<Set<string>>(new Set());

  // Custom tab state
  const [packageName, setPackageName] = useState('');
  const [version, setVersion] = useState('');
  const [manifestJson, setManifestJson] = useState(defaultManifest);
  const [customError, setCustomError] = useState('');

  const queryClient = useQueryClient();

  // Fetch already-registered plugins to show "Already registered" state
  const { data: registeredPlugins = [] } = useQuery({
    queryKey: ['plugins'],
    queryFn: listPlugins,
  });

  const registeredIds = useMemo(
    () => new Set(registeredPlugins.map((p) => p.manifest?.id).filter(Boolean)),
    [registeredPlugins],
  );

  const categories = useMemo(() => {
    const cats = Array.from(new Set(PLUGIN_CATALOGUE.map((p) => p.category)));
    return ['All', ...cats];
  }, []);

  const filteredCatalogue = useMemo(() => {
    return PLUGIN_CATALOGUE.filter((p) => {
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      const matchesSearch =
        !search ||
        p.manifest.name.toLowerCase().includes(search.toLowerCase()) ||
        p.manifest.description.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [search, selectedCategory]);

  const registerMutation = useMutation({
    mutationFn: (entry: CatalogueEntry) =>
      createPlugin({
        package_name: entry.package_name,
        version: entry.version,
        manifest: {
          ...entry.manifest,
          category: entry.category,
          icon: entry.icon,
        } as Record<string, unknown>,
      }),
    onSuccess: (_, entry) => {
      queryClient.invalidateQueries({ queryKey: ['plugins'] });
      setJustRegistered((prev) => new Set(prev).add(entry.manifest.id));
      setRegisteringId(null);
    },
    onError: () => {
      setRegisteringId(null);
    },
  });

  const customValidation = useMemo(() => {
    try {
      const parsed = JSON.parse(manifestJson);
      const result = PluginManifestSchema.safeParse(parsed);
      if (!result.success) {
        return { valid: false, errors: result.error.flatten().fieldErrors, parseError: null };
      }
      return { valid: true, errors: {}, parseError: null };
    } catch (e: any) {
      return { valid: false, errors: {}, parseError: e.message };
    }
  }, [manifestJson]);

  const customMutation = useMutation({
    mutationFn: () =>
      createPlugin({
        package_name: packageName,
        version,
        manifest: JSON.parse(manifestJson),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plugins'] });
      setPackageName('');
      setVersion('');
      setManifestJson(defaultManifest);
      setCustomError('');
    },
    onError: (err: any) => {
      setCustomError(err.message ?? 'Failed to create plugin');
    },
  });

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customValidation.valid) return;
    customMutation.mutate();
  };

  const handleRegister = (entry: CatalogueEntry) => {
    setRegisteringId(entry.manifest.id);
    registerMutation.mutate(entry);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit border border-slate-200">
        <button
          onClick={() => setTab('discover')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            tab === 'discover'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Zap size={14} className={tab === 'discover' ? 'text-indigo-600' : 'text-slate-400'} />
          Discover Plugins
        </button>
        <button
          onClick={() => setTab('custom')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            tab === 'custom'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Code2 size={14} className={tab === 'custom' ? 'text-indigo-600' : 'text-slate-400'} />
          Custom Manifest
        </button>
      </div>

      {/* ── Discover tab ─────────────────────────────────────────── */}
      {tab === 'discover' && (
        <div className="space-y-5 animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Search + category filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search plugins…"
                className="pl-9 h-9 bg-white border-slate-200 text-slate-900 text-sm placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:border-indigo-500 transition-all"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 ${
                    selectedCategory === cat
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-100'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-500 hover:text-indigo-600'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Plugin cards */}
          {filteredCatalogue.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl bg-slate-50">
              No plugins match your search.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCatalogue.map((entry) => {
                const isRegistered = registeredIds.has(entry.manifest.id) || justRegistered.has(entry.manifest.id);
                const isRegistering = registeringId === entry.manifest.id;
                const catColour = INDUSTRY_COLOURS[entry.category] ?? 'bg-slate-50 text-slate-700 border-slate-200';

                return (
                  <div
                    key={entry.manifest.id}
                    className={`relative flex flex-col bg-white border rounded-xl p-4 transition-all duration-300 hover:scale-[1.01] ${
                      isRegistered
                        ? 'border-emerald-500/30 bg-emerald-50/[0.01] shadow-xs'
                        : 'border-slate-200 hover:border-indigo-500/20 hover:shadow-md'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="text-2xl leading-none mt-0.5 filter drop-shadow-sm">{entry.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-900 leading-tight">
                            {entry.manifest.name}
                          </span>
                          {isRegistered && (
                            <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${catColour}`}>
                            {entry.category}
                          </span>
                          {entry.manifest.requires_plan && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                              {entry.manifest.requires_plan}+
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-500 leading-relaxed flex-1 mb-3">
                      {entry.manifest.description}
                    </p>

                    {/* Hooks preview */}
                    {entry.manifest.hooks.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {entry.manifest.hooks.slice(0, 3).map((hook) => (
                          <span
                            key={hook}
                            className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200/50"
                          >
                            {hook}
                          </span>
                        ))}
                        {entry.manifest.hooks.length > 3 && (
                          <span className="text-[10px] text-slate-400">
                            +{entry.manifest.hooks.length - 3} more
                          </span>
                        )}
                      </div>
                    )}

                    {/* Industry compatibility */}
                    <div className="flex flex-wrap gap-1 mb-4 border-t border-slate-100 pt-3">
                      {entry.manifest.compatible_industries.map((ind) => (
                        <span
                          key={ind}
                          className="text-[10px] text-slate-400 bg-slate-50 border border-slate-200/60 px-1.5 py-0.5 rounded"
                        >
                          {ind === '*' ? 'All industries' : ind}
                        </span>
                      ))}
                    </div>

                    {/* Action */}
                    <Button
                      size="sm"
                      disabled={isRegistered || isRegistering}
                      onClick={() => handleRegister(entry)}
                      className={`w-full h-8 text-xs font-medium rounded-lg transition-all duration-200 ${
                        isRegistered
                          ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 hover:bg-emerald-500/10 cursor-default shadow-none'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-sm hover:shadow-indigo-100'
                      }`}
                    >
                      {isRegistered ? (
                        <>
                          <CheckCircle2 size={12} className="mr-1.5" />
                          Registered
                        </>
                      ) : isRegistering ? (
                        <>
                          <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin mr-1.5" />
                          Registering…
                        </>
                      ) : (
                        <>
                          <PlusCircle size={12} className="mr-1.5" />
                          Register
                        </>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Custom manifest tab ──────────────────────────────────── */}
      {tab === 'custom' && (
        <div className="max-w-2xl space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
          <p className="text-sm text-slate-500">
            Manually register a plugin by providing its npm package details and manifest JSON.
          </p>
          <form onSubmit={handleCustomSubmit} className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs">
              <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">Package Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="packageName" className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Package Name
                  </label>
                  <Input
                    id="packageName"
                    value={packageName}
                    onChange={(e) => setPackageName(e.target.value)}
                    placeholder="@meta-crm/plugin-example"
                    className="bg-slate-50 border-slate-200 h-9 text-sm text-slate-900 focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:border-indigo-500"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="version" className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Version
                  </label>
                  <Input
                    id="version"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    placeholder="1.0.0"
                    className="bg-slate-50 border-slate-200 h-9 text-sm text-slate-900 focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:border-indigo-500"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 shadow-xs">
              <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">Manifest JSON</h3>
              <textarea
                value={manifestJson}
                onChange={(e) => setManifestJson(e.target.value)}
                rows={14}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 resize-none transition-all duration-200"
              />
              {customValidation.parseError && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700 animate-in shake duration-200">
                  <p className="font-semibold mb-0.5">JSON Parse Error</p>
                  <p className="font-mono">{customValidation.parseError}</p>
                </div>
              )}
              {!customValidation.parseError && customValidation.valid && (
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-700 font-medium animate-in fade-in duration-200">
                  ✓ Manifest is valid
                </div>
              )}
              {!customValidation.parseError && !customValidation.valid && Object.keys(customValidation.errors).length > 0 && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700 animate-in shake duration-200">
                  <p className="font-semibold mb-1">Validation Errors</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {Object.entries(customValidation.errors).map(([field, messages]) => (
                      <li key={field}>
                        <span className="font-medium">{field}:</span>{' '}
                        {(messages as string[]).join(', ')}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {customError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200/50 p-3 rounded-lg">{customError}</p>
            )}

            <Button
              type="submit"
              disabled={!customValidation.valid || customMutation.isPending}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg h-10 transition-all duration-200 shadow-sm shadow-indigo-100"
            >
              {customMutation.isPending ? 'Registering…' : 'Register Plugin'}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
