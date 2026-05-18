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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Edit,
  GitMerge,
  Phone,
  Mail,
  Building2,
  Calendar,
  Activity,
  FileText,
  Pencil,
  Check,
  X,
} from 'lucide-react';

/* Source badge matching DESIGN.md report palette */
function SourceBadge({ source }: { source: string }) {
  const styles: Record<string, string> = {
    [PartySource.WhatsApp]: 'bg-[#0bdf50]/10 text-[#0a7f2e] border-[#0bdf50]/20',
    [PartySource.JustDial]: 'bg-[#65b5ff]/10 text-[#0050aa] border-[#65b5ff]/20',
    [PartySource.Facebook]: 'bg-[#0007cb]/10 text-[#0007cb] border-[#0007cb]/20',
    [PartySource.Manual]: 'bg-[#ebe7e1] text-[#626260] border-[#d3cec6]',
    [PartySource.WebForm]: 'bg-[#b3e01c]/10 text-[#5a6e00] border-[#b3e01c]/20',
    [PartySource.Api]: 'bg-[#ff5600]/10 text-[#cc4400] border-[#ff5600]/20',
  };
  const cls = styles[source] ?? 'bg-[#ebe7e1] text-[#626260] border-[#d3cec6]';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${cls}`}>
      {source}
    </span>
  );
}

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
      toast.error('Failed to update contact');
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
      <div className="space-y-5 max-w-[1280px]">
        <Skeleton className="h-8 w-64 bg-[#ebe7e1]" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-40 w-full bg-[#ebe7e1] rounded-xl" />
          </div>
          <Skeleton className="h-40 bg-[#ebe7e1] rounded-xl" />
        </div>
      </div>
    );
  }

  if (!party) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-[#9c9fa5]">Contact not found</p>
      </div>
    );
  }

  const cases = (party as any).cases ?? [];
  const caseEvents = cases.flatMap((c: CaseResponse) =>
    (c as any).caseEvents?.map((e: any) => ({ ...e, caseTitle: c.title, caseId: c.id })) ?? [],
  );

  return (
    <div className="space-y-5 max-w-[1280px]">
      {/* Back + page header */}
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => navigate({ to: '/parties' })}
            className="flex items-center gap-1.5 text-sm text-[#9c9fa5] hover:text-[#111111] transition-colors mb-2"
          >
            <ArrowLeft size={14} />
            All contacts
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#111111] flex items-center justify-center text-white font-medium text-sm">
              {party.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-medium text-[#111111] tracking-tight">{party.name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm text-[#9c9fa5] capitalize">{party.type}</span>
                <span className="text-[#d3cec6]">·</span>
                <SourceBadge source={party.source} />
                {party.merge_status === MergeStatus.Merged && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[#c41c1c]/10 text-[#c41c1c] border border-[#c41c1c]/20">
                    Merged
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {can('manage', 'Party') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMergeWizard(true)}
              className="border-[#d3cec6] text-[#626260] hover:bg-[#ebe7e1] hover:text-[#111111] rounded-lg h-8"
            >
              <GitMerge size={14} className="mr-1.5" />
              Merge
            </Button>
          )}
          {can('update', 'Party') && (
            <Button
              size="sm"
              onClick={() => navigate({ to: '/parties/$id/edit', params: { id: party.id } })}
              className="bg-[#111111] hover:bg-black text-white rounded-lg h-8"
            >
              <Edit size={14} className="mr-1.5" />
              Edit
            </Button>
          )}
        </div>
      </div>

      {/* Content grid */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left: contact info + tabs */}
        <div className="lg:col-span-2 space-y-4">
          {/* Contact details card */}
          <Card className="bg-white border-[#d3cec6] rounded-xl shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-[#111111]">
                {t('party.details') ?? 'Contact Information'}
              </CardTitle>
            </CardHeader>
            <Separator className="bg-[#ebe7e1]" />
            <CardContent className="pt-4 space-y-3">
              <EditableDetailField
                label="Full Name"
                value={party.name}
                field="name"
                editing={editingField === 'name'}
                editValue={editValue}
                onEdit={() => handleEditField('name', party.name)}
                onSave={() => handleSaveField('name')}
                onCancel={() => setEditingField(null)}
                onEditValueChange={setEditValue}
                canUpdate={can('update', 'Party')}
                icon={<Building2 size={13} className="text-[#9c9fa5]" />}
              />
              <EditableDetailField
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
                icon={<Phone size={13} className="text-[#9c9fa5]" />}
              />
              <EditableDetailField
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
                icon={<Mail size={13} className="text-[#9c9fa5]" />}
              />
            </CardContent>
          </Card>

          {/* Tabs: Cases + Activity */}
          <Tabs defaultValue="cases">
            <TabsList className="bg-[#ebe7e1] rounded-lg p-0.5 h-auto">
              <TabsTrigger
                value="cases"
                className="text-sm data-[state=active]:bg-white data-[state=active]:text-[#111111] data-[state=active]:shadow-sm text-[#626260] rounded-md px-3 py-1.5"
              >
                <FileText size={13} className="mr-1.5" />
                {t('case.plural') ?? 'Cases'} ({cases.length})
              </TabsTrigger>
              <TabsTrigger
                value="activity"
                className="text-sm data-[state=active]:bg-white data-[state=active]:text-[#111111] data-[state=active]:shadow-sm text-[#626260] rounded-md px-3 py-1.5"
              >
                <Activity size={13} className="mr-1.5" />
                Activity
              </TabsTrigger>
            </TabsList>

            <TabsContent value="cases" className="mt-3">
              <Card className="bg-white border-[#d3cec6] rounded-xl shadow-none">
                <CardContent className="pt-4">
                  {cases.length === 0 ? (
                    <div className="flex flex-col items-center py-8 text-center">
                      <FileText size={20} className="text-[#9c9fa5] mb-2" />
                      <p className="text-sm text-[#9c9fa5]">No cases linked to this contact</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {cases.map((c: CaseResponse) => (
                        <button
                          key={c.id}
                          className="flex w-full items-center justify-between rounded-lg border border-[#ebe7e1] p-3 text-left hover:bg-[#f5f1ec] transition-colors"
                          onClick={() => (window.location.href = `/cases/${c.id}`)}
                        >
                          <div>
                            <p className="text-sm font-medium text-[#111111]">{c.title}</p>
                            <p className="text-xs text-[#9c9fa5] mt-0.5">Stage: {(c as any).stage}</p>
                          </div>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[#65b5ff]/10 text-[#0050aa] border border-[#65b5ff]/20">
                            {(c as any).stage}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activity" className="mt-3">
              <Card className="bg-white border-[#d3cec6] rounded-xl shadow-none">
                <CardContent className="pt-4">
                  {caseEvents.length === 0 ? (
                    <div className="flex flex-col items-center py-8 text-center">
                      <Activity size={20} className="text-[#9c9fa5] mb-2" />
                      <p className="text-sm text-[#9c9fa5]">No activity yet</p>
                    </div>
                  ) : (
                    <div className="space-y-0">
                      {caseEvents.slice(0, 10).map((event: any, i: number) => (
                        <div key={event.id} className="flex gap-3 py-3 border-b border-[#ebe7e1] last:border-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#65b5ff] mt-2 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-[#111111]">{event.event_type}</p>
                            <p className="text-xs text-[#9c9fa5] mt-0.5">
                              {event.caseTitle} · {new Date(event.occurred_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right: metadata card */}
        <div>
          <Card className="bg-white border-[#d3cec6] rounded-xl shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-[#111111]">Details</CardTitle>
            </CardHeader>
            <Separator className="bg-[#ebe7e1]" />
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-start gap-2">
                <Calendar size={13} className="text-[#9c9fa5] mt-0.5" />
                <div>
                  <p className="text-xs text-[#9c9fa5]">Created</p>
                  <p className="text-sm text-[#111111]">
                    {new Date(party.created_at).toLocaleDateString('en-US', {
                      year: 'numeric', month: 'long', day: 'numeric'
                    })}
                  </p>
                </div>
              </div>
              <Separator className="bg-[#ebe7e1]" />
              <div className="flex items-start gap-2">
                <Building2 size={13} className="text-[#9c9fa5] mt-0.5" />
                <div>
                  <p className="text-xs text-[#9c9fa5]">Type</p>
                  <p className="text-sm text-[#111111] capitalize">{party.type}</p>
                </div>
              </div>
              <Separator className="bg-[#ebe7e1]" />
              <div>
                <p className="text-xs text-[#9c9fa5] mb-1">Source</p>
                <SourceBadge source={party.source} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {showMergeWizard && (
        <MergeWizard
          party={party}
          onClose={() => setShowMergeWizard(false)}
          onMergeComplete={() => {
            setShowMergeWizard(false);
            queryClient.invalidateQueries({ queryKey: ['parties', partyId] });
            toast.success('Contacts merged successfully');
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Editable field component                                           */
/* ------------------------------------------------------------------ */

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
  icon?: React.ReactNode;
}

function EditableDetailField({
  label, value, field, editing, editValue,
  onEdit, onSave, onCancel, onEditValueChange, canUpdate, icon,
}: DetailFieldProps) {
  if (editing && canUpdate) {
    return (
      <div className="flex items-center gap-3">
        {icon && <span className="flex-shrink-0">{icon}</span>}
        <div className="flex items-center gap-2 flex-1">
          <Input
            type="text"
            value={editValue}
            onChange={(e) => onEditValueChange(e.target.value)}
            className="h-8 text-sm bg-[#f5f1ec] border-[#d3cec6] focus-visible:ring-[#111111]/30"
            autoFocus
            onBlur={onSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSave();
              if (e.key === 'Escape') onCancel();
            }}
          />
          <button onClick={onSave} className="text-[#0bdf50] hover:opacity-70">
            <Check size={14} />
          </button>
          <button onClick={onCancel} className="text-[#9c9fa5] hover:opacity-70">
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 group">
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[#9c9fa5]">{label}</p>
        <div className="flex items-center gap-1.5">
          <p className="text-sm text-[#111111]">{value}</p>
          {canUpdate && (
            <button
              onClick={onEdit}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-[#9c9fa5] hover:text-[#111111]"
            >
              <Pencil size={11} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
