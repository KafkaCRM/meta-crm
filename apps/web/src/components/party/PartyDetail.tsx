import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { PartySource, MergeStatus } from '@meta-crm/types';
import type { PartyResponse, CaseResponse } from '@meta-crm/types';
import { usePermissions } from '@/hooks/usePermissions';
import { useLabels } from '@/hooks/useLabels';
import { partiesApi } from '@/api/parties';
import { queryClient } from '@/lib/query-client';
import { MergeWizard } from './MergeWizard';

const SOURCE_COLORS: Record<string, string> = {
  [PartySource.WhatsApp]: 'bg-green-100 text-green-800',
  [PartySource.JustDial]: 'bg-blue-100 text-blue-800',
  [PartySource.Facebook]: 'bg-indigo-100 text-indigo-800',
  [PartySource.Manual]: 'bg-gray-100 text-gray-800',
  [PartySource.WebForm]: 'bg-purple-100 text-purple-800',
  [PartySource.Api]: 'bg-orange-100 text-orange-800',
};

interface PartyDetailProps {
  partyId: string;
}

export function PartyDetail({ partyId }: PartyDetailProps) {
  const { can } = usePermissions();
  const { t } = useLabels();
  const navigate = useNavigate();
  const [showMergeWizard, setShowMergeWizard] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const { data: party, isLoading } = useQuery<PartyResponse>({
    queryKey: ['parties', partyId],
    queryFn: () => partiesApi.get(partyId),
    staleTime: 30_000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      partiesApi.update(id, data as any),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['parties', id] });
      const previous = queryClient.getQueryData<PartyResponse>(['parties', id]);
      queryClient.setQueryData<PartyResponse>(['parties', id], (old) =>
        old ? { ...old, ...data } : old,
      );
      return { previous };
    },
    onError: (err, { id }, context) => {
      queryClient.setQueryData(['parties', id], context?.previous);
      toast.error('Failed to update party');
    },
    onSettled: (_, __, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['parties', id] });
    },
  });

  const handleEditField = useCallback(
    (field: string, currentValue: string) => {
      setEditingField(field);
      setEditValue(currentValue);
    },
    [],
  );

  const handleSaveField = useCallback(
    (field: string) => {
      if (!party || !editValue.trim()) {
        setEditingField(null);
        return;
      }
      updateMutation.mutate({
        id: party.id,
        data: { [field]: editValue.trim() },
      });
      setEditingField(null);
    },
    [party, editValue, updateMutation],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!party) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Party not found</p>
      </div>
    );
  }

  const cases = (party as any).cases ?? [];
  const caseEvents = cases.flatMap((c: CaseResponse) =>
    (c as any).caseEvents?.map((e: any) => ({ ...e, caseTitle: c.title, caseId: c.id })) ?? [],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{party.name}</h1>
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                SOURCE_COLORS[party.source] ?? 'bg-gray-100 text-gray-800'
              }`}
            >
              {party.source}
            </span>
            {party.merge_status === MergeStatus.Merged && (
              <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                Merged
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {party.type} · Created {new Date(party.created_at).toLocaleDateString()}
          </p>
        </div>

        <div className="flex gap-2">
          {can('update', 'Party') && (
            <button
              className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
              onClick={() => navigate({ to: '/parties/$id/edit', params: { id: party.id } })}
            >
              Edit
            </button>
          )}
          {can('manage', 'Party') && (
            <button
              className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
              onClick={() => setShowMergeWizard(true)}
            >
              Merge
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-lg border bg-card p-4">
            <h2 className="mb-4 text-lg font-semibold">{t('party.details') ?? 'Details'}</h2>
            <div className="space-y-3">
              <DetailField
                label="Name"
                value={party.name}
                field="name"
                editing={editingField === 'name'}
                editValue={editValue}
                onEdit={() => handleEditField('name', party.name)}
                onSave={() => handleSaveField('name')}
                onCancel={() => setEditingField(null)}
                onEditValueChange={setEditValue}
                canUpdate={can('update', 'Party')}
              />
              <DetailField
                label="Phone"
                value={party.phone_raw}
                field="phone"
                editing={editingField === 'phone'}
                editValue={editValue}
                onEdit={() => handleEditField('phone', party.phone_raw)}
                onSave={() => handleSaveField('phone')}
                onCancel={() => setEditingField(null)}
                onEditValueChange={setEditValue}
                canUpdate={can('update', 'Party')}
              />
              <DetailField
                label="Email"
                value={party.email ?? '—'}
                field="email"
                editing={editingField === 'email'}
                editValue={editValue}
                onEdit={() => handleEditField('email', party.email ?? '')}
                onSave={() => handleSaveField('email')}
                onCancel={() => setEditingField(null)}
                onEditValueChange={setEditValue}
                canUpdate={can('update', 'Party')}
              />
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <h2 className="mb-4 text-lg font-semibold">
              {t('case.plural') ?? 'Cases'} ({cases.length})
            </h2>
            {cases.length === 0 ? (
              <p className="text-sm text-muted-foreground">No cases linked to this party</p>
            ) : (
              <div className="space-y-2">
                {cases.map((c: CaseResponse) => (
                  <button
                    key={c.id}
                    className="flex w-full items-center justify-between rounded-md border p-3 text-left hover:bg-muted"
                    onClick={() => navigate({ to: '/cases/$id', params: { id: c.id } })}
                  >
                    <div>
                      <p className="font-medium">{c.title}</p>
                      <p className="text-sm text-muted-foreground">
                        Stage: {(c as any).stage}
                      </p>
                    </div>
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                      {(c as any).stage}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border bg-card p-4">
            <h2 className="mb-4 text-lg font-semibold">Activity Log</h2>
            {caseEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet</p>
            ) : (
              <div className="space-y-3">
                {caseEvents.slice(0, 10).map((event: any) => (
                  <div key={event.id} className="border-l-2 border-muted pl-3 py-1">
                    <p className="text-sm font-medium">{event.event_type}</p>
                    <p className="text-xs text-muted-foreground">
                      {event.caseTitle} · {new Date(event.occurred_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showMergeWizard && (
        <MergeWizard
          party={party}
          onClose={() => setShowMergeWizard(false)}
          onMergeComplete={() => {
            setShowMergeWizard(false);
            queryClient.invalidateQueries({ queryKey: ['parties', partyId] });
            toast.success('Parties merged successfully');
          }}
        />
      )}
    </div>
  );
}

interface DetailFieldProps {
  label: string;
  value: string;
  field: string;
  editing: boolean;
  editValue: string;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onEditValueChange: (value: string) => void;
  canUpdate: boolean;
}

function DetailField({
  label,
  value,
  field,
  editing,
  editValue,
  onEdit,
  onSave,
  onCancel,
  onEditValueChange,
  canUpdate,
}: DetailFieldProps) {
  if (editing && canUpdate) {
    return (
      <div className="flex items-center gap-2">
        <span className="w-24 text-sm font-medium">{label}</span>
        <input
          type="text"
          value={editValue}
          onChange={(e) => onEditValueChange(e.target.value)}
          className="flex-1 rounded-md border border-input px-3 py-1 text-sm"
          autoFocus
          onBlur={onSave}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSave();
            if (e.key === 'Escape') onCancel();
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="w-24 text-sm font-medium">{label}</span>
      <span className="flex-1 text-sm">
        {canUpdate ? (
          <button
            className="rounded px-1 py-0.5 hover:bg-muted"
            onClick={onEdit}
          >
            {value}
          </button>
        ) : (
          <span className="text-muted-foreground">{value}</span>
        )}
      </span>
    </div>
  );
}
