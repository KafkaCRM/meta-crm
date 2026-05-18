import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { PartyResponse } from '@meta-crm/types';
import { partiesApi } from '@/api/parties';
import { queryClient } from '@/lib/query-client';

interface MergeWizardProps {
  party: PartyResponse;
  onClose: () => void;
  onMergeComplete: () => void;
}

type WizardStep = 'select-candidate' | 'review-diff' | 'confirm';

export function MergeWizard({ party, onClose, onMergeComplete }: MergeWizardProps) {
  const [step, setStep] = useState<WizardStep>('select-candidate');
  const [selectedCandidate, setSelectedCandidate] = useState<PartyResponse | null>(null);
  const [canonicalId, setCanonicalId] = useState<string>(party.id);

  const { data: candidates, isLoading: candidatesLoading } = useQuery({
    queryKey: ['parties', 'candidates', party.phone_normalized, party.name],
    queryFn: () =>
      partiesApi.listCandidates(party.phone_normalized, party.name),
    staleTime: 30_000,
  });

  const filteredCandidates =
    candidates?.data.filter((c) => c.id !== party.id && c.merge_status !== 'merged') ?? [];

  const mergeMutation = useMutation({
    mutationFn: () =>
      partiesApi.merge({
        canonical_id: canonicalId,
        duplicate_id: canonicalId === party.id ? selectedCandidate!.id : party.id,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      queryClient.invalidateQueries({ queryKey: ['parties', canonicalId] });
      onMergeComplete();
    },
    onError: () => {
      toast.error('Failed to merge parties');
    },
  });

  const handleSelectCandidate = useCallback((candidate: PartyResponse) => {
    setSelectedCandidate(candidate);
    setStep('review-diff');
  }, []);

  const handleConfirmMerge = useCallback(() => {
    mergeMutation.mutate();
  }, [mergeMutation]);

  const diffFields = [
    { key: 'name', label: 'Name' },
    { key: 'phone_raw', label: 'Phone' },
    { key: 'email', label: 'Email' },
    { key: 'source', label: 'Source' },
    { key: 'type', label: 'Type' },
  ];

  const getFieldValue = (p: PartyResponse, key: string): string => {
    const val = (p as any)[key];
    if (val === null || val === undefined) return '—';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-auto max-w-3xl w-full rounded-lg bg-card p-6 shadow-lg max-h-[80vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Merge Parties</h2>
          <button
            className="rounded-md p-1 hover:bg-muted"
            onClick={onClose}
            disabled={mergeMutation.isPending}
          >
            ✕
          </button>
        </div>

        {step === 'select-candidate' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select a party to merge with <strong>{party.name}</strong>
            </p>

            {candidatesLoading ? (
              <div className="py-8 text-center text-muted-foreground">
                Searching for candidates...
              </div>
            ) : filteredCandidates.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No merge candidates found
              </div>
            ) : (
              <div className="space-y-2">
                {filteredCandidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    className="flex w-full items-center justify-between rounded-md border p-3 text-left hover:bg-muted"
                    onClick={() => handleSelectCandidate(candidate)}
                  >
                    <div>
                      <p className="font-medium">{candidate.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {candidate.phone_raw} · {candidate.source}
                      </p>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      Created {new Date(candidate.created_at).toLocaleDateString()}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 'review-diff' && selectedCandidate && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Compare attributes and select the canonical record
            </p>

            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="font-medium">Field</div>
              <div className="font-medium">{party.name} (Current)</div>
              <div className="font-medium">{selectedCandidate.name} (Candidate)</div>
            </div>

            {diffFields.map(({ key, label }) => {
              const valA = getFieldValue(party, key);
              const valB = getFieldValue(selectedCandidate, key);
              const differs = valA !== valB;

              return (
                <div
                  key={key}
                  className={`grid grid-cols-3 gap-4 rounded-md p-2 ${
                    differs ? 'bg-amber-50' : ''
                  }`}
                >
                  <div className="font-medium text-muted-foreground">{label}</div>
                  <div
                    className={`cursor-pointer rounded px-2 py-1 ${
                      canonicalId === party.id ? 'ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => setCanonicalId(party.id)}
                  >
                    {valA}
                  </div>
                  <div
                    className={`cursor-pointer rounded px-2 py-1 ${
                      canonicalId === selectedCandidate.id ? 'ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => setCanonicalId(selectedCandidate.id)}
                  >
                    {valB}
                  </div>
                </div>
              );
            })}

            <div className="mt-4 rounded-md bg-blue-50 p-3 text-sm text-blue-800">
              <p className="font-medium">Canonical record: {canonicalId === party.id ? party.name : selectedCandidate.name}</p>
              <p className="text-blue-600">
                The non-canonical party will be marked as merged. All cases and interactions will be transferred to the canonical record.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                onClick={() => setStep('confirm')}
              >
                Continue
              </button>
              <button
                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
                onClick={() => setStep('select-candidate')}
                disabled={mergeMutation.isPending}
              >
                Back
              </button>
            </div>
          </div>
        )}

        {step === 'confirm' && selectedCandidate && (
          <div className="space-y-4">
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
              <p className="font-medium text-amber-800">Confirm Merge</p>
              <p className="text-sm text-amber-700 mt-1">
                This will merge{' '}
                <strong>
                  {canonicalId === party.id ? selectedCandidate.name : party.name}
                </strong>{' '}
                into{' '}
                <strong>
                  {canonicalId === party.id ? party.name : selectedCandidate.name}
                </strong>
                . This action cannot be undone.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                onClick={handleConfirmMerge}
                disabled={mergeMutation.isPending}
              >
                {mergeMutation.isPending ? 'Merging...' : 'Confirm Merge'}
              </button>
              <button
                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
                onClick={() => setStep('review-diff')}
                disabled={mergeMutation.isPending}
              >
                Back
              </button>
              <button
                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
                onClick={onClose}
                disabled={mergeMutation.isPending}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
