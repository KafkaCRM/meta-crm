import { Share2, Globe, Tag, Target } from 'lucide-react';
import type { SlotContextData } from '@meta-crm/types';

export default function CaseSidePanel({ caseData }: SlotContextData) {
  // Extract or mock UTM parameters based on caseData
  const utm = caseData?.metadata?.utm ?? {
    source: 'google',
    medium: 'cpc',
    campaign: 'higher_ed_winter_2026',
    term: 'mba degree programs',
    content: 'text_ad_v2',
  };

  const channel = caseData?.metadata?.acquisitionChannel ?? 'Paid Search';

  return (
    <div className="bg-surface-1 border border-hairline rounded-lg p-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-hairline pb-2">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-fin-orange" />
          <h3 className="font-semibold text-sm text-ink">Lead Attribution</h3>
        </div>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
          {channel}
        </span>
      </div>

      <div className="space-y-3 text-xs">
        <div className="space-y-1 bg-canvas border border-hairline rounded p-2">
          <div className="flex justify-between">
            <span className="text-ink-muted">UTM Source</span>
            <span className="font-mono font-semibold text-ink">{utm.source}</span>
          </div>
          <div className="flex justify-between mt-1 pt-1 border-t border-hairline/40">
            <span className="text-ink-muted">UTM Medium</span>
            <span className="font-mono font-semibold text-ink">{utm.medium}</span>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-ink-muted font-medium mb-1">
            <Tag className="h-3.5 w-3.5" />
            <span>Attributed Campaign</span>
          </div>
          <span className="block font-medium text-ink bg-surface-2 border border-hairline rounded px-2.5 py-1.5 truncate">
            {utm.campaign}
          </span>
        </div>

        <div className="space-y-2 border-t border-hairline pt-3">
          <div className="flex items-center gap-1.5 text-ink-muted font-medium">
            <Globe className="h-3.5 w-3.5" />
            <span>Contextual Keywords</span>
          </div>
          <div className="flex flex-wrap gap-1">
            <span className="px-2 py-0.5 bg-canvas border border-hairline rounded text-[10px] text-ink-muted font-mono">
              utm_term: {utm.term}
            </span>
            <span className="px-2 py-0.5 bg-canvas border border-hairline rounded text-[10px] text-ink-muted font-mono">
              utm_content: {utm.content}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2 bg-blue-50/60 border border-blue-150 rounded p-2.5 text-xs text-blue-800">
        <Share2 className="h-4 w-4 flex-shrink-0 mt-0.5 text-blue-600" />
        <div>
          <span className="font-semibold block">Social Referral Data</span>
          <span className="text-blue-700/90">Lead converted from high-intent Google Search ad group.</span>
        </div>
      </div>
    </div>
  );
}
