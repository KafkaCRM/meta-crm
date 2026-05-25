export interface CatalogueEntry {
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

export const PLUGIN_CATALOGUE: CatalogueEntry[] = [
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
      compatible_industries: ['real-estate', 'real_estate'],
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
      compatible_industries: ['real-estate', 'real_estate'],
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
