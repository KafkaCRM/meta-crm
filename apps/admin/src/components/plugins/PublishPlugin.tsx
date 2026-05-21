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
        manifest: entry.manifest as Record<string, unknown>,
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
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex gap-1 bg-[#f5f1ec] p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab('discover')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'discover'
              ? 'bg-white text-[#111111] shadow-sm'
              : 'text-[#9c9fa5] hover:text-[#111111]'
          }`}
        >
          <Zap size={14} />
          Discover Plugins
        </button>
        <button
          onClick={() => setTab('custom')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'custom'
              ? 'bg-white text-[#111111] shadow-sm'
              : 'text-[#9c9fa5] hover:text-[#111111]'
          }`}
        >
          <Code2 size={14} />
          Custom Manifest
        </button>
      </div>

      {/* ── Discover tab ─────────────────────────────────────────── */}
      {tab === 'discover' && (
        <div className="space-y-4">
          {/* Search + category filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9c9fa5]" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search plugins…"
                className="pl-9 h-9 bg-white border-[#d3cec6] text-sm placeholder:text-[#9c9fa5]"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    selectedCategory === cat
                      ? 'bg-[#111111] text-white border-[#111111]'
                      : 'bg-white text-[#626260] border-[#d3cec6] hover:border-[#111111] hover:text-[#111111]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Plugin cards */}
          {filteredCatalogue.length === 0 ? (
            <div className="text-center py-12 text-[#9c9fa5] text-sm">
              No plugins match your search.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCatalogue.map((entry) => {
                const isRegistered = registeredIds.has(entry.manifest.id) || justRegistered.has(entry.manifest.id);
                const isRegistering = registeringId === entry.manifest.id;
                const catColour = INDUSTRY_COLOURS[entry.category] ?? 'bg-gray-50 text-gray-700 border-gray-200';

                return (
                  <div
                    key={entry.manifest.id}
                    className={`relative flex flex-col bg-white border rounded-xl p-4 transition-all ${
                      isRegistered
                        ? 'border-[#0bdf50]/30 bg-[#0bdf50]/[0.02]'
                        : 'border-[#d3cec6] hover:border-[#111111]/20 hover:shadow-sm'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="text-2xl leading-none mt-0.5">{entry.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-[#111111] leading-tight">
                            {entry.manifest.name}
                          </span>
                          {isRegistered && (
                            <CheckCircle2 size={14} className="text-[#0bdf50] flex-shrink-0" />
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
                    <p className="text-xs text-[#626260] leading-relaxed flex-1 mb-3">
                      {entry.manifest.description}
                    </p>

                    {/* Hooks preview */}
                    {entry.manifest.hooks.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {entry.manifest.hooks.slice(0, 3).map((hook) => (
                          <span
                            key={hook}
                            className="text-[10px] font-mono bg-[#f5f1ec] text-[#626260] px-1.5 py-0.5 rounded"
                          >
                            {hook}
                          </span>
                        ))}
                        {entry.manifest.hooks.length > 3 && (
                          <span className="text-[10px] text-[#9c9fa5]">
                            +{entry.manifest.hooks.length - 3} more
                          </span>
                        )}
                      </div>
                    )}

                    {/* Industry compatibility */}
                    <div className="flex flex-wrap gap-1 mb-4">
                      {entry.manifest.compatible_industries.map((ind) => (
                        <span
                          key={ind}
                          className="text-[10px] text-[#9c9fa5] bg-[#f5f1ec] px-1.5 py-0.5 rounded"
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
                      className={`w-full h-8 text-xs font-medium rounded-lg transition-all ${
                        isRegistered
                          ? 'bg-[#0bdf50]/10 text-[#0a7f2e] border border-[#0bdf50]/30 hover:bg-[#0bdf50]/10 cursor-default'
                          : 'bg-[#111111] hover:bg-black text-white'
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
        <div className="max-w-2xl space-y-4">
          <p className="text-sm text-[#9c9fa5]">
            Manually register a plugin by providing its npm package details and manifest JSON.
          </p>
          <form onSubmit={handleCustomSubmit} className="space-y-4">
            <div className="bg-white border border-[#d3cec6] rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-[#111111]">Package Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="packageName" className="text-sm font-medium text-[#111111]">
                    Package Name
                  </label>
                  <Input
                    id="packageName"
                    value={packageName}
                    onChange={(e) => setPackageName(e.target.value)}
                    placeholder="@meta-crm/plugin-example"
                    className="bg-[#f5f1ec] border-[#d3cec6] h-9 text-sm"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="version" className="text-sm font-medium text-[#111111]">
                    Version
                  </label>
                  <Input
                    id="version"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    placeholder="1.0.0"
                    className="bg-[#f5f1ec] border-[#d3cec6] h-9 text-sm"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="bg-white border border-[#d3cec6] rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-[#111111]">Manifest JSON</h3>
              <textarea
                value={manifestJson}
                onChange={(e) => setManifestJson(e.target.value)}
                rows={14}
                className="w-full rounded-lg border border-[#d3cec6] bg-[#f5f1ec] px-3 py-2.5 font-mono text-xs text-[#111111] focus:outline-none focus:border-[#111111] resize-none"
              />
              {customValidation.parseError && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
                  <p className="font-semibold mb-0.5">JSON Parse Error</p>
                  <p className="font-mono">{customValidation.parseError}</p>
                </div>
              )}
              {!customValidation.parseError && customValidation.valid && (
                <div className="rounded-lg bg-[#0bdf50]/10 border border-[#0bdf50]/20 p-3 text-xs text-[#0a7f2e] font-medium">
                  ✓ Manifest is valid
                </div>
              )}
              {!customValidation.parseError && !customValidation.valid && Object.keys(customValidation.errors).length > 0 && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
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
              <p className="text-sm text-red-600">{customError}</p>
            )}

            <Button
              type="submit"
              disabled={!customValidation.valid || customMutation.isPending}
              className="w-full bg-[#111111] hover:bg-black text-white font-medium rounded-lg h-10"
            >
              {customMutation.isPending ? 'Registering…' : 'Register Plugin'}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
