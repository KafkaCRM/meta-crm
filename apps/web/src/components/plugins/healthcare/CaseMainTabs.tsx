import { useState } from 'react';
import { CheckSquare, Square, ClipboardList, ShieldAlert, HeartPulse, User } from 'lucide-react';
import type { SlotContextData } from '@meta-crm/types';

interface PatientTask {
  id: string;
  label: string;
  category: 'Admissions' | 'Clinical' | 'Discharge';
  checked: boolean;
}

export default function CaseMainTabs({ caseData }: SlotContextData) {
  const [tasks, setTasks] = useState<PatientTask[]>([
    { id: '1', label: 'Verify patient identity and registration papers', category: 'Admissions', checked: true },
    { id: '2', label: 'Obtain informed consent forms and signature', category: 'Admissions', checked: true },
    { id: '3', label: 'Conduct primary allergy screen and record', category: 'Clinical', checked: false },
    { id: '4', label: 'Initiate baseline ECG and monitor vitals', category: 'Clinical', checked: false },
    { id: '5', label: 'Administer pre-op medication directives', category: 'Clinical', checked: false },
    { id: '6', label: 'Review post-discharge recovery guidelines', category: 'Discharge', checked: false },
  ]);

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, checked: !t.checked } : t))
    );
  };

  const completedCount = tasks.filter((t) => t.checked).length;
  const progressPercent = Math.round((completedCount / tasks.length) * 100);

  return (
    <div className="bg-surface-1 border border-hairline rounded-lg p-6 space-y-6 h-full overflow-y-auto">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-hairline pb-4">
        <div>
          <h2 className="text-lg font-semibold text-ink flex items-center gap-2">
            <HeartPulse className="h-5 w-5 text-fin-orange" />
            Clinical Admission Worksheet
          </h2>
          <p className="text-sm text-ink-muted">
            Track evaluation benchmarks and clinical checklist protocols.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-xs text-ink-muted block font-medium">Worksheet Progress</span>
            <span className="text-sm font-semibold text-ink">{progressPercent}% complete</span>
          </div>
          <div className="w-24 bg-canvas h-2.5 rounded-full overflow-hidden border border-hairline">
            <div
              className="bg-fin-orange h-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Patient Information Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-canvas border border-hairline rounded-lg p-4">
        <div className="space-y-1">
          <span className="text-xs text-ink-muted block uppercase tracking-wider font-semibold">Patient Name</span>
          <div className="flex items-center gap-1.5 font-medium text-sm text-ink">
            <User className="h-4 w-4 text-ink-muted" />
            <span>{caseData?.metadata?.patientName ?? 'Jane Doe'}</span>
          </div>
        </div>
        <div className="space-y-1">
          <span className="text-xs text-ink-muted block uppercase tracking-wider font-semibold">Record ID (MRN)</span>
          <span className="font-mono text-sm text-ink font-medium">
            {caseData?.metadata?.mrn ?? 'MRN-482937-X'}
          </span>
        </div>
        <div className="space-y-1">
          <span className="text-xs text-ink-muted block uppercase tracking-wider font-semibold">Admitting Physician</span>
          <span className="text-sm text-ink font-medium">
            Dr. Elizabeth Blackwell, MD
          </span>
        </div>
      </div>

      {/* Checklist Sections */}
      <div className="space-y-4">
        <h3 className="font-semibold text-sm text-ink flex items-center gap-1.5 border-b border-hairline pb-2">
          <ClipboardList className="h-4 w-4 text-ink-subtle" />
          Clinical Execution Checklist
        </h3>

        <div className="divide-y divide-hairline">
          {tasks.map((task) => (
            <button
              key={task.id}
              onClick={() => toggleTask(task.id)}
              className="w-full flex items-start gap-3 py-3 text-left hover:bg-canvas/50 px-2 rounded-md transition-colors"
            >
              {task.checked ? (
                <CheckSquare className="h-5 w-5 text-fin-orange flex-shrink-0 mt-0.5" />
              ) : (
                <Square className="h-5 w-5 text-hairline flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <span
                  className={`text-sm block transition-all ${
                    task.checked ? 'line-through text-ink-muted' : 'text-ink font-medium'
                  }`}
                >
                  {task.label}
                </span>
                <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold tracking-wider bg-surface-2 text-ink-subtle">
                  {task.category}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Safety Alert Banner */}
      <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-3.5 text-xs text-red-800">
        <ShieldAlert className="h-5 w-5 text-red-600 flex-shrink-0" />
        <div className="space-y-1">
          <span className="font-bold block">Patient Safety Directive</span>
          <p className="text-red-700 leading-normal">
            Prior to discharge, a nurse supervisor must sign off on the clinical record. Vitals must be checked and stable for a minimum of 4 consecutive hours.
          </p>
        </div>
      </div>
    </div>
  );
}
