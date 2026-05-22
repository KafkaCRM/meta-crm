import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useLocation } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PartySource, PartyType } from '@meta-crm/types';
import type { PartyResponse, FieldDefinitionResponse } from '@meta-crm/types';
import { usePermissions } from '@/hooks/usePermissions';
import { useLabels } from '@/hooks/useLabels';
import { partiesApi } from '@/api/parties';
import { settingsApi } from '@/api/settings';
import { queryClient } from '@/lib/query-client';
import { DynamicForm, type DuplicateCheckResult } from '@/components/shared/DynamicForm';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const PartyFormSchema = z.object({
  type: z.nativeEnum(PartyType),
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().min(1, 'Phone is required'),
  source: z.nativeEnum(PartySource),
  branch_brand_assignment_id: z.string().min(1, 'Branch is required'),
  attributes: z.record(z.string(), z.unknown()).optional(),
});

type PartyFormValues = z.infer<typeof PartyFormSchema>;

const CORE_FIELD_DEFS: FieldDefinitionResponse[] = [
  { id: 'core-type', tenant_id: '', entity_type: 'Party', name: 'type', label: 'Type', field_type: 'select', options: [PartyType.Individual, PartyType.Organization], required: true, order: 0, created_at: '' },
  { id: 'core-name', tenant_id: '', entity_type: 'Party', name: 'name', label: 'Name', field_type: 'text', required: true, order: 1, created_at: '' },
  { id: 'core-phone', tenant_id: '', entity_type: 'Party', name: 'phone', label: 'Phone', field_type: 'phone', required: true, order: 2, created_at: '' },
  { id: 'core-email', tenant_id: '', entity_type: 'Party', name: 'email', label: 'Email', field_type: 'email', required: false, order: 3, created_at: '' },
  { id: 'core-source', tenant_id: '', entity_type: 'Party', name: 'source', label: 'Source', field_type: 'select', options: [PartySource.Manual, PartySource.WhatsApp, PartySource.JustDial, PartySource.Facebook, PartySource.WebForm, PartySource.Api], required: true, order: 4, created_at: '' },
  { id: 'core-branch', tenant_id: '', entity_type: 'Party', name: 'branch_brand_assignment_id', label: 'Branch', field_type: 'text', required: true, order: 5, created_at: '' },
];

interface PartyFormProps {
  party?: PartyResponse;
}

export function PartyForm({ party }: PartyFormProps) {
  const { can } = usePermissions();
  const { t } = useLabels();
  const navigate = useNavigate();
  const location = useLocation();

  const isEdit = !!party;

  const searchParams = useMemo(() => {
    const params: Record<string, string> = {};
    const search = location.search;
    if (typeof search === 'string') {
      const query = search.startsWith('?') ? search.slice(1) : search;
      if (query) {
        for (const pair of query.split('&')) {
          const [key, ...rest] = pair.split('=');
          if (key) params[decodeURIComponent(key)] = decodeURIComponent(rest.join('='));
        }
      }
    } else if (search && typeof search === 'object') {
      for (const [k, v] of Object.entries(search)) {
        if (v !== undefined && v !== null) params[k] = String(v);
      }
    }
    return params;
  }, [location.search]);

  const prefillSource = searchParams.source;
  const prefillLeadId = searchParams.lead_id;
  const [prefillData, setPrefillData] = useState<Record<string, unknown> | null>(null);

  const { data: fetchedFieldDefinitions } = useQuery({
    queryKey: ['settings', 'fields', 'Party'],
    queryFn: () => settingsApi.fieldDefinitions.list('Party'),
    staleTime: 60_000,
  });
  const fieldDefinitions = useMemo((): FieldDefinitionResponse[] => {
    const custom = (fetchedFieldDefinitions ?? []) as FieldDefinitionResponse[];
    return [...CORE_FIELD_DEFS, ...custom];
  }, [fetchedFieldDefinitions]);

  useEffect(() => {
    if (prefillSource && prefillLeadId && !isEdit) {
      partiesApi
        .get(prefillLeadId)
        .then((lead) => {
          const prefill: Record<string, unknown> = {};
          if (lead.name) { prefill.name = lead.name; }
          if (lead.phone_raw) { prefill.phone = lead.phone_raw; }
          if (lead.email) { prefill.email = lead.email; }
          if (lead.source) { prefill.source = lead.source; }
          setPrefillData(prefill);
        })
        .catch(() => {});
    }
  }, [prefillSource, prefillLeadId, isEdit]);

  const handlePhoneBlur = useCallback(
    async (phone: string): Promise<DuplicateCheckResult> => {
      if (!phone) return { found: false, confidence: 0 };
      try {
        const result = await partiesApi.checkDuplicate(phone);
        const match = result.match;
        const base: DuplicateCheckResult = {
          found: !!result.found,
          party_name: match?.name ?? '',
          phone: match?.phone_normalized ?? '',
          source: match?.source ?? '',
          confidence: result.confidence ?? 0,
        };
        if (match) {
          base.match = {
            id: match.id,
            name: match.name,
            phone_normalized: match.phone_normalized,
            source: match.source,
          };
        }
        return base;
      } catch {
        return { found: false, confidence: 0 };
      }
    },
    [],
  );

  const handleSubmit = useCallback(
    async (data: PartyFormValues) => {
      try {
        if (isEdit && party) {
          await partiesApi.update(party.id, data as any);
          toast.success(t('party.updated') ?? 'Changes saved');
          navigate({ to: '/parties/$id', params: { id: party.id } });
        } else {
          const createdParty = await partiesApi.create(data as any);
          toast.success(`${t('party.singular') ?? 'Contact'} created`, {
            description: createdParty.name,
            duration: 5000,
            action: {
              label: 'Undo',
              onClick: async () => {
                await partiesApi.remove(createdParty.id);
                queryClient.invalidateQueries({ queryKey: ['parties'] });
                toast.info('Party creation undone');
              },
            },
          });
          navigate({ to: '/parties/$id', params: { id: createdParty.id } });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save party';
        toast.error(message);
      }
    },
    [isEdit, party, navigate, t],
  );

  if (!can('read', 'Party')) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-[#94a3b8]">You do not have permission to view this page.</p>
      </div>
    );
  }

  const defaultValues: Partial<PartyFormValues> = party
    ? {
        type: party.type as PartyType,
        name: party.name,
        email: party.email ?? '',
        phone: party.phone_raw,
        source: party.source as PartySource,
        branch_brand_assignment_id: party.branch_brand_assignment_id,
        attributes: party.attributes ?? {},
      }
    : {
        type: PartyType.Individual,
        name: '',
        email: '',
        phone: '',
        source: PartySource.Manual,
        branch_brand_assignment_id: '',
        attributes: {},
      };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            party
              ? navigate({ to: '/parties/$id', params: { id: party.id } })
              : navigate({ to: '/parties' })
          }
          className="text-[#94a3b8] hover:text-[#0f172a] h-8"
        >
          <ArrowLeft size={14} className="mr-1" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-medium text-[#0f172a] tracking-tight">
            {isEdit ? t('party.edit') ?? 'Edit Party' : t('party.new') ?? 'New Party'}
          </h1>
          {prefillSource && (
            <p className="text-sm text-[#94a3b8] mt-0.5">
              Pre-filled from {prefillSource} lead
            </p>
          )}
        </div>
      </div>

      <DynamicForm<PartyFormValues>
        fields={fieldDefinitions}
        schema={PartyFormSchema}
        defaultValues={defaultValues}
        prefillData={prefillData ?? {}}
        resource="Party"
        onSubmit={handleSubmit}
        submitLabel={isEdit ? (t('party.save') ?? 'Save Changes') : (t('party.create') ?? 'Create Party')}
        onPhoneBlur={handlePhoneBlur}
        sectionGroups={[
          { label: 'Basic Info', fieldNames: ['type', 'name', 'phone', 'email', 'source'] },
          { label: 'Assignment', fieldNames: ['branch_brand_assignment_id'] },
        ]}
      />
    </div>
  );
}
