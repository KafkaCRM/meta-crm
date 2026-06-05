import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PartySource } from '@meta-crm/types';
import type { PartyResponse } from '@meta-crm/types';
import { partiesApi } from '@/api/parties';
import { queryClient } from '@/lib/query-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, X, ChevronRight, ArrowLeft, GitMerge, CheckCircle2 } from 'lucide-react';

interface MergeWizardProps {
  party: PartyResponse;
  onClose: () => void;
  onMergeComplete: () => void;
}

type WizardStep = 'select-candidate' | 'review-diff' | 'confirm';

const SOURCE_COLORS: Record<string, string> = {
  [PartySource.WhatsApp]: 'bg-[#0bdf50]/10 text-[#0a7f2e] border-[#0bdf50]/20',
  [PartySource.JustDial]: 'bg-[#ff8c00]/10 text-[#cc7000] border-[#ff8c00]/20',
  [PartySource.Facebook]: 'bg-[#1877f2]/10 text-[#1565c0] border-[#1877f2]/20',
  [PartySource.Manual]: 'bg-[#94a3b8]/10 text-muted-foreground border-[#94a3b8]/20',
  [PartySource.WebForm]: 'bg-[#8b5cf6]/10 text-[#7c3aed] border-[#8b5cf6]/20',
  [PartySource.Api]: 'bg-[#ff5600]/10 text-[#cc4400] border-[#ff5600]/20',
};

function SourceBadge({ source }: { source: string }) {
  const cls = SOURCE_COLORS[source] ?? 'bg-[#94a3b8]/10 text-muted-foreground border-[#94a3b8]/20';
  const label = source === PartySource.WhatsApp ? 'WhatsApp' : source === PartySource.JustDial ? 'JustDial' : source === PartySource.Facebook ? 'Facebook' : source === PartySource.WebForm ? 'Web Form' : source === PartySource.Manual ? 'Manual' : source;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${cls}`}>
      {label}
    </span>
  );
}

const DIFF_FIELDS = [
  { key: 'name', label: 'Name' },
  { key: 'phone_raw', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'source', label: 'Source' },
  { key: 'type', label: 'Type' },
];

export function MergeWizard({ party, onClose, onMergeComplete }: MergeWizardProps) {
  const [step, setStep] = useState<WizardStep>('select-candidate');
  const [selectedCandidate, setSelectedCandidate] = useState<PartyResponse | null>(null);
  const [canonicalId, setCanonicalId] = useState<string>(party.id);
  const [fieldKeep, setFieldKeep] = useState<Record<string, 'left' | 'right'>>({});

  const { data: candidates, isLoading: candidatesLoading } = useQuery({
    queryKey: ['parties', 'candidates', party.phone_normalized],
    queryFn: () => partiesApi.listCandidates(party.phone_normalized),
    staleTime: 30_000,
  });

  const filteredCandidates = useMemo(
    () => candidates?.data.filter((c) => c.id !== party.id && c.merge_status !== 'merged').slice(0, 5) ?? [],
    [candidates, party.id],
  );

  const canonicalParty = canonicalId === party.id ? party : selectedCandidate!;
  const duplicateParty = canonicalId === party.id ? selectedCandidate! : party;
  const mergedParty = duplicateParty;

  const fieldOverrides = useMemo(() => {
    const overrides: Record<string, any> = {};
    if (!selectedCandidate) return overrides;

    DIFF_FIELDS.forEach(({ key }) => {
      const keep = fieldKeep[key];
      if (!keep) return;

      const keepLeft = keep === 'left';
      const canonicalIsLeft = canonicalId === party.id;

      if (keepLeft !== canonicalIsLeft) {
        const valueToKeep = (duplicateParty as any)[key];
        if (valueToKeep !== undefined && valueToKeep !== null && valueToKeep !== '—') {
          overrides[key] = valueToKeep;
          if (key === 'phone_raw') {
            overrides['phone_normalized'] = duplicateParty.phone_normalized;
          }
        }
      }
    });

    return overrides;
  }, [fieldKeep, canonicalId, party, selectedCandidate, duplicateParty]);

  const mergeMutation = useMutation({
    mutationFn: () =>
      partiesApi.merge({
        canonical_id: canonicalId,
        duplicate_id: canonicalId === party.id ? selectedCandidate!.id : party.id,
        field_overrides: fieldOverrides,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      queryClient.invalidateQueries({ queryKey: ['parties', canonicalId] });
      toast.success('Parties merged successfully');
      onMergeComplete();
    },
    onError: () => {
      toast.error('Failed to merge parties');
    },
  });

  const handleSelectCandidate = useCallback((candidate: PartyResponse) => {
    setSelectedCandidate(candidate);
    setCanonicalId(party.id);
    setFieldKeep({});
    setStep('review-diff');
  }, [party.id]);

  const getFieldValue = (p: PartyResponse, key: string): string => {
    const val = (p as any)[key];
    if (val === null || val === undefined) return '—';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="mx-auto max-w-4xl w-full rounded-xl bg-card shadow-2xl max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <GitMerge size={18} className="text-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Merge Parties</h2>
          </div>
          <button
            className="rounded-md p-1.5 hover:bg-background transition-colors text-muted-foreground"
            onClick={onClose}
            disabled={mergeMutation.isPending}
          >
            <X size={16} />
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-0 px-6 py-3 bg-[#faf9f7] border-b border-border">
          {(['select-candidate', 'review-diff', 'confirm'] as WizardStep[]).map((s, i) => {
            const stepLabels = ['Select Candidate', 'Review Differences', 'Confirm'];
            const isActive = step === s;
            const isPast = (step === 'review-diff' && i === 0) || step === 'confirm';
            return (
              <div key={s} className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 text-sm ${
                  isActive ? 'text-foreground font-medium' : isPast ? 'text-[#0bdf50]' : 'text-muted-foreground'
                }`}>
                  {isPast ? (
                    <CheckCircle2 size={14} />
                  ) : (
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                      isActive ? 'bg-primary text-white' : 'bg-[#e2e8f0] text-muted-foreground'
                    }`}>
                      {i + 1}
                    </span>
                  )}
                  <span className="hidden sm:inline">{stepLabels[i]}</span>
                </div>
                {i < 2 && <ChevronRight size={14} className="text-[#e2e8f0]" />}
              </div>
            );
          })}
        </div>

        <div className="p-6">
          {/* Step 1: Candidate selection */}
          {step === 'select-candidate' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Select a party to merge with <strong className="text-foreground">{party.name}</strong>
              </p>

              {candidatesLoading ? (
                <div className="py-12 text-center">
                  <Loader2 size={20} className="animate-spin mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mt-2">Searching for candidates...</p>
                </div>
              ) : filteredCandidates.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm text-muted-foreground">No merge candidates found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredCandidates.map((candidate) => (
                    <button
                      key={candidate.id}
                      className="flex w-full items-center justify-between rounded-lg border border-border p-4 text-left hover:bg-background transition-colors"
                      onClick={() => handleSelectCandidate(candidate)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white font-medium text-sm">
                          {candidate.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{candidate.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {candidate.phone_raw} · <SourceBadge source={candidate.source} />
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          Created {new Date(candidate.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Diff view */}
          {step === 'review-diff' && selectedCandidate && (
            <div className="space-y-4">
              <div className="bg-muted/45 rounded-xl p-4 border border-border flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">Surviving Profile (Canonical)</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Select which profile should remain active. The other will be marked as merged.
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => {
                      setCanonicalId(party.id);
                      setFieldKeep({});
                    }}
                    className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      canonicalId === party.id
                        ? 'bg-primary text-white border-primary shadow-xs'
                        : 'bg-card text-muted-foreground border-border hover:bg-muted/50'
                    }`}
                  >
                    Keep {party.name} (Original)
                  </button>
                  <button
                    onClick={() => {
                      setCanonicalId(selectedCandidate.id);
                      setFieldKeep({});
                    }}
                    className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      canonicalId === selectedCandidate.id
                        ? 'bg-primary text-white border-primary shadow-xs'
                        : 'bg-card text-muted-foreground border-border hover:bg-muted/50'
                    }`}
                  >
                    Keep {selectedCandidate.name} (Duplicate)
                  </button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                Compare fields and choose which values to keep:
              </p>

              <div className="grid grid-cols-4 gap-3 text-xs font-bold text-muted-foreground uppercase tracking-wider pb-2 border-b border-border">
                <div>Field</div>
                <div>{party.name}</div>
                <div>{selectedCandidate.name}</div>
                <div>Keep Value</div>
              </div>

              {DIFF_FIELDS.map(({ key, label }) => {
                const valA = getFieldValue(party, key);
                const valB = getFieldValue(selectedCandidate, key);
                const differs = valA !== valB;
                const keep = fieldKeep[key] ?? (canonicalId === party.id ? 'left' : 'right');

                return (
                  <div
                    key={key}
                    className={`grid grid-cols-4 gap-3 rounded-xl p-2.5 text-xs items-center ${
                      differs ? 'bg-amber-500/5 border border-amber-500/20' : 'border border-transparent'
                    }`}
                  >
                    <div className="font-bold text-muted-foreground">{label}</div>
                    <button
                      className={`rounded-lg px-3 py-2 text-left transition-colors cursor-pointer border text-xs ${
                        keep === 'left'
                          ? 'bg-primary text-white border-primary font-bold shadow-xs'
                          : 'bg-card text-foreground border-border hover:bg-muted/50'
                      }`}
                      onClick={() => setFieldKeep((prev) => ({ ...prev, [key]: 'left' }))}
                    >
                      {valA}
                    </button>
                    <button
                      className={`rounded-lg px-3 py-2 text-left transition-colors cursor-pointer border text-xs ${
                        keep === 'right'
                          ? 'bg-primary text-white border-primary font-bold shadow-xs'
                          : 'bg-card text-foreground border-border hover:bg-muted/50'
                      }`}
                      onClick={() => setFieldKeep((prev) => ({ ...prev, [key]: 'right' }))}
                    >
                      {valB}
                    </button>
                    <div className="text-xs font-bold">
                      {differs ? (
                        <span className="text-amber-600 font-bold">Differs</span>
                      ) : (
                        <span className="text-emerald-600 font-bold">Same</span>
                      )}
                    </div>
                  </div>
                );
              })}

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const allLeft: Record<string, 'left' | 'right'> = {};
                    DIFF_FIELDS.forEach((f) => { allLeft[f.key] = 'left'; });
                    setFieldKeep(allLeft);
                  }}
                  className="h-8 text-xs border-border"
                >
                  Select All Original
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const allRight: Record<string, 'left' | 'right'> = {};
                    DIFF_FIELDS.forEach((f) => { allRight[f.key] = 'right'; });
                    setFieldKeep(allRight);
                  }}
                  className="h-8 text-xs border-border"
                >
                  Select All Duplicate
                </Button>
              </div>

              <div className="rounded-lg bg-[#3b82f6]/5 border border-[#3b82f6]/20 p-3 text-sm">
                <p className="font-medium text-foreground">
                  Canonical record: <span className="text-[#3b82f6]">{canonicalParty.name}</span>
                </p>
                <p className="text-muted-foreground mt-1">
                  {mergedParty.name} will be marked as merged. All cases and interactions will transfer.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => setStep('confirm')}
                  className="bg-primary hover:bg-[#1e293b] text-white rounded-lg h-9 text-sm font-medium"
                >
                  Continue
                  <ChevronRight size={14} className="ml-1" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setStep('select-candidate')}
                  disabled={mergeMutation.isPending}
                  className="h-9 text-sm border-border"
                >
                  <ArrowLeft size={14} className="mr-1" />
                  Back
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Confirmation */}
          {step === 'confirm' && selectedCandidate && (
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-4">
                <p className="font-semibold text-amber-800">Confirm Merge</p>
                <p className="text-sm text-amber-700 mt-1">
                  This will merge{' '}
                  <strong>{mergedParty.name}</strong>{' '}
                  into{' '}
                  <strong>{canonicalParty.name}</strong>.
                </p>
                <p className="text-xs text-amber-600 mt-2">
                  This action cannot be undone. All cases, interactions, and relationships from the merged party will be transferred to the canonical record.
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => mergeMutation.mutate()}
                  disabled={mergeMutation.isPending}
                  className="bg-[#c41c1c] hover:bg-[#a01818] text-white rounded-lg h-9 text-sm font-medium"
                >
                  {mergeMutation.isPending ? (
                    <Loader2 size={14} className="mr-1.5 animate-spin" />
                  ) : (
                    <GitMerge size={14} className="mr-1.5" />
                  )}
                  {mergeMutation.isPending ? 'Merging...' : 'Confirm Merge'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setStep('review-diff')}
                  disabled={mergeMutation.isPending}
                  className="h-9 text-sm border-border"
                >
                  Back
                </Button>
                <Button
                  variant="outline"
                  onClick={onClose}
                  disabled={mergeMutation.isPending}
                  className="h-9 text-sm border-border"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
