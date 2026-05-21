import { useState, useCallback, useEffect, useRef } from 'react';
import { useForm, useWatch, useFormState } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useLocation } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PartySource, PartyType, evaluateVisibilityRules } from '@meta-crm/types';
import type { PartyResponse, CheckDuplicateResponse, FieldDefinitionResponse } from '@meta-crm/types';
import { usePermissions } from '@/hooks/usePermissions';
import { useLabels } from '@/hooks/useLabels';
import { partiesApi } from '@/api/parties';
import { settingsApi } from '@/api/settings';
import { queryClient } from '@/lib/query-client';

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

interface PartyFormProps {
  party?: PartyResponse;
  fieldDefinitions?: FieldDefinitionResponse[];
}

export function PartyForm({ party, fieldDefinitions }: PartyFormProps) {
  const { can } = usePermissions();
  const { t } = useLabels();
  const navigate = useNavigate();
  const location = useLocation();
  const search = (location.search && typeof location.search === 'object'
    ? location.search
    : {}) as Record<string, string> | undefined;

  const isEdit = !!party;
  const [duplicateInfo, setDuplicateInfo] = useState<CheckDuplicateResponse | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [useExistingMode, setUseExistingMode] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prefillSource = search?.source;
  const prefillLeadId = search?.lead_id;
  const [prefillData, setPrefillData] = useState<Record<string, unknown> | null>(null);
  const [prefillLoading, setPrefillLoading] = useState(false);

  const { data: fetchedFieldDefinitions } = useQuery({
    queryKey: ['settings', 'fields', 'Party'],
    queryFn: () => settingsApi.fieldDefinitions.list('Party'),
    enabled: !fieldDefinitions,
    staleTime: 60_000,
  });
  const customFields = (fieldDefinitions ?? fetchedFieldDefinitions ?? []) as FieldDefinitionResponse[];

  const form = useForm<PartyFormValues>({
    resolver: (zodResolver as any)(PartyFormSchema),
    defaultValues: party
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
        },
    mode: 'onChange',
  });

  const { isDirty, isSubmitting } = useFormState(form);
  const watchedValues = useWatch({ control: form.control }) as Record<string, unknown>;

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && !isSubmitting) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, isSubmitting]);

  useEffect(() => {
    if (prefillSource && prefillLeadId && !isEdit) {
      setPrefillLoading(true);
      partiesApi
        .get(prefillLeadId)
        .then((lead) => {
          const prefill: Record<string, unknown> = {};
          if (lead.name) {
            form.setValue('name', lead.name);
            prefill.name = true;
          }
          if (lead.phone_raw) {
            form.setValue('phone', lead.phone_raw);
            prefill.phone = true;
          }
          if (lead.email) {
            form.setValue('email', lead.email);
            prefill.email = true;
          }
          if (lead.source) {
            form.setValue('source', lead.source);
            prefill.source = true;
          }
          setPrefillData(prefill);
        })
        .catch(() => {})
        .finally(() => setPrefillLoading(false));
    }
  }, [prefillSource, prefillLeadId, isEdit, form]);

  const handlePhoneBlur = useCallback(
    (phone: string) => {
      if (!phone) {
        setDuplicateInfo(null);
        setShowDuplicateWarning(false);
        return;
      }

      if (debounceRef.current) clearTimeout(debounceRef.current);

      setCheckingDuplicate(true);
      debounceRef.current = setTimeout(() => {
        partiesApi
          .checkDuplicate(phone)
          .then((result) => {
            setDuplicateInfo(result);
            if (result.found && result.confidence > 0.5) {
              setShowDuplicateWarning(true);
            } else {
              setShowDuplicateWarning(false);
            }
          })
          .catch(() => {
            setDuplicateInfo(null);
            setShowDuplicateWarning(false);
          })
          .finally(() => setCheckingDuplicate(false));
      }, 400);
    },
    [],
  );

  const handleUseExisting = useCallback(() => {
    if (duplicateInfo?.match?.id) {
      setUseExistingMode(true);
      navigate({ to: '/parties/$id', params: { id: duplicateInfo.match.id } });
    }
  }, [duplicateInfo, navigate]);

  const handleCreateAnyway = useCallback(() => {
    setShowDuplicateWarning(false);
    form.handleSubmit(onSubmit)();
  }, [form]);

  const onSubmit = useCallback(
    async (data: PartyFormValues) => {
      try {
        let createdParty: PartyResponse;
        if (isEdit && party) {
          createdParty = await partiesApi.update(party.id, data as any);
          toast.success(t('party.updated') ?? 'Party updated');
          navigate({ to: '/parties/$id', params: { id: party.id } });
        } else {
          createdParty = await partiesApi.create(data as any);
          const toastId = toast.success(t('party.created') ?? 'Party created', {
            description: `${createdParty.name}`,
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

  const canUpdate = can('update', 'Party');
  const canRead = can('read', 'Party');

  if (!canRead) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">You do not have permission to view this party.</p>
      </div>
    );
  }

  const prefillSet = prefillData ? new Set(Object.keys(prefillData)) : new Set<string>();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {isEdit ? t('party.edit') ?? 'Edit Party' : t('party.new') ?? 'New Party'}
        </h1>
        {prefillLoading && (
          <p className="text-sm text-muted-foreground">Loading lead data...</p>
        )}
        {prefillSource && (
          <p className="text-sm text-muted-foreground">
            Pre-filled from {prefillSource} lead
          </p>
        )}
      </div>

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
        noValidate
      >
        <FormField
          label={t('party.type') ?? 'Type'}
          name="type"
          form={form}
          canUpdate={canUpdate}
          isPrefilled={prefillSet.has('type')}
          type="select"
          options={[PartyType.Individual, PartyType.Organization]}
        />

        <FormField
          label={t('party.name') ?? 'Name'}
          name="name"
          form={form}
          canUpdate={canUpdate}
          isPrefilled={prefillSet.has('name')}
          type="text"
        />

        <div className="space-y-1">
          <label className="block text-sm font-medium">
            {t('party.phone') ?? 'Phone'}
          </label>
          <div className="relative">
            {canUpdate ? (
              <input
                {...form.register('phone')}
                type="tel"
                className={`w-full rounded-md border px-3 py-2 text-sm ${
                  form.formState.errors.phone
                    ? 'border-destructive'
                    : 'border-input'
                } ${prefillSet.has('phone') ? 'border-l-4 border-l-blue-500' : ''}`}
                onBlur={(e) => {
                  form.register('phone').onBlur?.(e);
                  handlePhoneBlur(form.watch('phone'));
                }}
              />
            ) : (
              <span className="block rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
                {form.watch('phone') || '—'}
              </span>
            )}
            {checkingDuplicate && (
              <span className="absolute right-2 top-2 text-xs text-muted-foreground">
                Checking...
              </span>
            )}
          </div>
          {form.formState.errors.phone && (
            <p className="text-xs text-destructive">
              {(form.formState.errors.phone as { message?: string })?.message}
            </p>
          )}
          {showDuplicateWarning && duplicateInfo?.match && (
            <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 space-y-2">
              <p className="text-sm font-medium text-amber-800">
                Possible duplicate found
              </p>
              <p className="text-sm text-amber-700">
                {duplicateInfo.match.name} — {duplicateInfo.match.phone_normalized}
              </p>
              <p className="text-xs text-amber-600">
                Source: {duplicateInfo.match.source} · Confidence: {Math.round(duplicateInfo.confidence * 100)}%
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700"
                  onClick={handleUseExisting}
                >
                  Use Existing
                </button>
                <button
                  type="button"
                  className="rounded-md border border-amber-300 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
                  onClick={handleCreateAnyway}
                >
                  Create Anyway
                </button>
              </div>
            </div>
          )}
        </div>

        <FormField
          label={t('party.email') ?? 'Email'}
          name="email"
          form={form}
          canUpdate={canUpdate}
          isPrefilled={prefillSet.has('email')}
          type="email"
        />

        <FormField
          label={t('party.source') ?? 'Source'}
          name="source"
          form={form}
          canUpdate={canUpdate}
          isPrefilled={prefillSet.has('source')}
          type="select"
          options={[
            PartySource.Manual,
            PartySource.WhatsApp,
            PartySource.JustDial,
            PartySource.Facebook,
            PartySource.WebForm,
            PartySource.Api,
          ]}
        />

        <FormField
          label={t('party.branch') ?? 'Branch'}
          name="branch_brand_assignment_id"
          form={form}
          canUpdate={canUpdate}
          isPrefilled={prefillSet.has('branch_brand_assignment_id')}
          type="text"
        />

        {customFields.map((field) => {
          const values = {
            ...watchedValues,
            ...((watchedValues.attributes as Record<string, unknown> | undefined) ?? {}),
          };
          const isVisible = field.visibility_rules
            ? evaluateVisibilityRules(field.visibility_rules as any, values)
            : true;
          if (!isVisible) return null;

          return (
            <CustomAttributeField
              key={field.id}
              field={field}
              form={form}
              canUpdate={canUpdate}
            />
          );
        })}

        <div className="flex gap-2 pt-4">
          <button
            type="submit"
            disabled={isSubmitting || useExistingMode}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting
              ? 'Saving...'
              : isEdit
                ? t('party.save') ?? 'Save Changes'
                : t('party.create') ?? 'Create Party'}
          </button>
          <button
            type="button"
            onClick={() =>
              party
                ? navigate({ to: '/parties/$id', params: { id: party.id } })
                : navigate({ to: '/parties' })
            }
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

interface CustomAttributeFieldProps {
  field: FieldDefinitionResponse;
  form: ReturnType<typeof useForm<PartyFormValues>>;
  canUpdate: boolean;
}

function CustomAttributeField({ field, form, canUpdate }: CustomAttributeFieldProps) {
  const name = `attributes.${field.name}` as const;
  const value = form.watch(name as any);
  const error = (form.formState.errors.attributes as Record<string, { message?: string }> | undefined)?.[field.name];
  const baseInputClass = `w-full rounded-md border px-3 py-2 text-sm ${error ? 'border-destructive' : 'border-input'}`;

  if (!canUpdate) {
    return (
      <div className="space-y-1">
        <label className="block text-sm font-medium">{field.label}</label>
        <span className="block rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
          {value !== undefined && value !== null && value !== '' ? String(value) : '—'}
        </span>
      </div>
    );
  }

  let input: React.ReactNode;
  const inputProps = form.register(name as any, {
    required: field.required ? `${field.label} is required` : false,
  });

  if (field.field_type === 'select' && Array.isArray(field.options)) {
    input = (
      <select {...inputProps} className={baseInputClass}>
        <option value="">Select...</option>
        {field.options.map((opt: string) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  } else if (field.field_type === 'multi_select' && Array.isArray(field.options)) {
    const selected = Array.isArray(value) ? value as string[] : [];
    input = (
      <select
        multiple
        value={selected}
        onChange={(e) => {
          const next = Array.from(e.currentTarget.selectedOptions).map((opt) => opt.value);
          form.setValue(name as any, next, { shouldDirty: true, shouldValidate: true });
        }}
        className={baseInputClass}
      >
        {field.options.map((opt: string) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  } else if (field.field_type === 'boolean') {
    input = (
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => form.setValue(name as any, e.currentTarget.checked, { shouldDirty: true, shouldValidate: true })}
        />
        Yes
      </label>
    );
  } else {
    const type = field.field_type === 'number'
      ? 'number'
      : field.field_type === 'date'
        ? 'date'
        : field.field_type === 'email'
          ? 'email'
          : field.field_type === 'phone'
            ? 'tel'
            : 'text';
    input = <input {...inputProps} type={type} className={baseInputClass} />;
  }

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium">
        {field.label}{field.required ? ' *' : ''}
      </label>
      {input}
      {error && <p className="text-xs text-destructive">{error.message}</p>}
    </div>
  );
}

interface FormFieldProps {
  label: string;
  name: keyof PartyFormValues;
  form: ReturnType<typeof useForm<PartyFormValues>>;
  canUpdate: boolean;
  isPrefilled: boolean;
  type: 'text' | 'email' | 'select';
  options?: string[];
}

function FormField({
  label,
  name,
  form,
  canUpdate,
  isPrefilled,
  type,
  options,
}: FormFieldProps) {
  const error = form.formState.errors[name];
  const currentValue = form.watch(name);

  const baseInputClass = `w-full rounded-md border px-3 py-2 text-sm ${
    error ? 'border-destructive' : 'border-input'
  } ${isPrefilled ? 'border-l-4 border-l-blue-500' : ''}`;

  if (!canUpdate) {
    return (
      <div className="space-y-1">
        <label className="block text-sm font-medium">{label}</label>
        <span className="block rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
          {(currentValue as string) ?? '—'}
        </span>
      </div>
    );
  }

  const inputProps = form.register(name);

  let input: React.ReactNode;

  if (type === 'select' && options) {
    input = (
      <select {...inputProps} className={baseInputClass}>
        <option value="">Select...</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  } else {
    input = (
      <input {...inputProps} type={type === 'email' ? 'email' : 'text'} className={baseInputClass} />
    );
  }

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium">{label}</label>
      {input}
      {error && (
        <p className="text-xs text-destructive">
          {(error as { message?: string })?.message}
        </p>
      )}
    </div>
  );
}
