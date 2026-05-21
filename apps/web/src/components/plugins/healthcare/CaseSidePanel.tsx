import { Heart, Activity, Phone, ShieldAlert } from 'lucide-react';
import type { SlotContextData } from '@meta-crm/types';

export default function CaseSidePanel({ caseData }: SlotContextData) {
  // Extract or mock vitals based on caseData context
  const vitals = caseData?.metadata?.vitals ?? {
    heartRate: '72 bpm',
    bloodPressure: '120/80 mmHg',
    temperature: '98.6 °F',
    status: 'Stable',
  };

  const emergencyContact = caseData?.metadata?.emergencyContact ?? {
    name: 'Jane Doe',
    relation: 'Spouse',
    phone: '+1 (555) 019-2834',
  };

  return (
    <div className="bg-surface-1 border border-hairline rounded-lg p-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-hairline pb-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-fin-orange" />
          <h3 className="font-semibold text-sm text-ink">Clinical Vitals</h3>
        </div>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
          {vitals.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="space-y-1">
          <span className="text-ink-muted block">Heart Rate</span>
          <div className="flex items-center gap-1 font-medium text-ink">
            <Heart className="h-3.5 w-3.5 text-red-500 fill-red-500" />
            <span>{vitals.heartRate}</span>
          </div>
        </div>
        <div className="space-y-1">
          <span className="text-ink-muted block">Blood Pressure</span>
          <span className="font-medium text-ink">{vitals.bloodPressure}</span>
        </div>
        <div className="space-y-1 col-span-2">
          <span className="text-ink-muted block">Temperature</span>
          <span className="font-medium text-ink">{vitals.temperature}</span>
        </div>
      </div>

      <div className="border-t border-hairline pt-3 space-y-2">
        <div className="flex items-center gap-1.5 text-ink-muted text-xs font-medium">
          <Phone className="h-3.5 w-3.5" />
          <span>Emergency Contact</span>
        </div>
        <div className="bg-canvas border border-hairline rounded p-2 text-xs space-y-1">
          <div className="flex justify-between font-medium text-ink">
            <span>{emergencyContact.name}</span>
            <span className="text-ink-muted font-normal">({emergencyContact.relation})</span>
          </div>
          <a
            href={`tel:${emergencyContact.phone}`}
            className="text-fin-orange hover:underline block font-mono"
          >
            {emergencyContact.phone}
          </a>
        </div>
      </div>

      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded p-2.5 text-xs text-amber-800">
        <ShieldAlert className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-600" />
        <div>
          <span className="font-semibold block">Care Directive Active</span>
          <span className="text-amber-700/95">Full code status verified. Allergy profile current.</span>
        </div>
      </div>
    </div>
  );
}
