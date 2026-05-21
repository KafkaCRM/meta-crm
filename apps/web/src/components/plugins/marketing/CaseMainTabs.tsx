import { useState } from 'react';
import { Target, BarChart2, Calendar, MousePointer, ShieldAlert, Award } from 'lucide-react';
import type { SlotContextData } from '@meta-crm/types';

interface Touchpoint {
  id: string;
  date: string;
  source: string;
  medium: string;
  campaign: string;
  event: string;
  details: string;
}

export default function CaseMainTabs({ caseData }: SlotContextData) {
  const [touchpoints] = useState<Touchpoint[]>([
    {
      id: '1',
      date: '2026-05-20 09:32',
      source: 'google',
      medium: 'cpc',
      campaign: 'higher_ed_winter_2026',
      event: 'Ad Click',
      details: 'Searched "best executive MBA programs near me". Landed on main brochure page.',
    },
    {
      id: '2',
      date: '2026-05-20 09:35',
      source: 'google',
      medium: 'cpc',
      campaign: 'higher_ed_winter_2026',
      event: 'Form Submission',
      details: 'Filled out brochure download form (email verification passed).',
    },
    {
      id: '3',
      date: '2026-05-21 14:15',
      source: 'email',
      medium: 'nurture',
      campaign: 'welcome_sequence_v1',
      event: 'Email Open & Click',
      details: 'Opened welcome email and clicked CTA to speak with an admissions officer.',
    },
  ]);

  const funnelStages = [
    { name: 'Ad Impression', count: '12,500', rate: '100%', active: false },
    { name: 'Click Through', count: '625', rate: '5.0%', active: false },
    { name: 'Brochure Download', count: '125', rate: '20.0%', active: false },
    { name: 'CRM Case Created', count: '1', rate: '0.8%', active: true },
  ];

  return (
    <div className="bg-surface-1 border border-hairline rounded-lg p-6 space-y-6 h-full overflow-y-auto">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-hairline pb-4">
        <div>
          <h2 className="text-lg font-semibold text-ink flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-fin-orange" />
            Marketing Attribution Dashboard
          </h2>
          <p className="text-sm text-ink-muted">
            Track user journey touchpoints, campaigns, and referral history.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-canvas border border-hairline rounded px-3 py-1.5 text-xs font-semibold text-ink">
          <Award className="h-4 w-4 text-fin-orange" />
          <span>Attribution Mode: First Touch</span>
        </div>
      </div>

      {/* Funnel chart */}
      <div className="space-y-3">
        <h3 className="font-semibold text-xs text-ink-muted uppercase tracking-wider">
          Acquisition Funnel (This Lead Segment)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          {funnelStages.map((stage, idx) => (
            <div
              key={idx}
              className={`border rounded p-3 relative overflow-hidden transition-all ${
                stage.active
                  ? 'bg-fin-orange/5 border-fin-orange shadow-sm'
                  : 'bg-surface-1 border-hairline'
              }`}
            >
              <span className="text-[10px] text-ink-muted block uppercase tracking-wider font-semibold">
                Stage {idx + 1}
              </span>
              <span className="font-semibold text-sm text-ink block mt-0.5">{stage.name}</span>
              <div className="flex justify-between items-baseline mt-2">
                <span className="text-lg font-bold text-ink">{stage.count}</span>
                <span className="text-xs text-ink-subtle">Rate: {stage.rate}</span>
              </div>
              {stage.active && (
                <div className="absolute right-0 top-0 bg-fin-orange text-white text-[9px] font-bold px-2 py-0.5 rounded-bl">
                  Active
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Touchpoint Timeline */}
      <div className="space-y-4 pt-2">
        <h3 className="font-semibold text-sm text-ink flex items-center gap-1.5 border-b border-hairline pb-2">
          <MousePointer className="h-4 w-4 text-ink-subtle" />
          Journey Touchpoint History
        </h3>

        <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-hairline">
          {touchpoints.map((tp) => (
            <div key={tp.id} className="relative pl-8 flex flex-col md:flex-row md:items-start gap-2 md:gap-6">
              {/* Timeline marker */}
              <div className="absolute left-1.5 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-fin-orange bg-surface-1" />
              
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-ink">{tp.event}</span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-canvas text-ink-muted border border-hairline font-mono">
                    {tp.source} / {tp.medium}
                  </span>
                </div>
                <p className="text-xs text-ink-muted leading-relaxed">{tp.details}</p>
                <div className="text-[10px] text-ink-subtle flex items-center gap-1 font-medium font-mono pt-0.5">
                  <span>Campaign:</span>
                  <span className="underline">{tp.campaign}</span>
                </div>
              </div>

              <div className="flex-shrink-0 text-right md:w-32 flex items-center gap-1 text-[10px] text-ink-subtle font-semibold font-mono">
                <Calendar className="h-3 w-3" />
                <span>{tp.date}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Data Compliance Alert */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3.5 text-xs text-blue-800">
        <ShieldAlert className="h-5 w-5 text-blue-600 flex-shrink-0" />
        <div className="space-y-1">
          <span className="font-bold block">Attribution & Privacy Check</span>
          <p className="text-blue-700 leading-normal">
            Lead source was verified against active cookie consent guidelines. Third-party campaign cookies were safely stored and synced under GDPR/CCPA guidelines.
          </p>
        </div>
      </div>
    </div>
  );
}
