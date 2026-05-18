import {
  useForm,
  useWatch,
  useFormState,
  type FieldValues,
  type UseFormReturn,
  type Path,
  type PathValue,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { type z } from 'zod';
import { useState, useEffect, useMemo, useCallback, type ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { evaluateVisibilityRules } from '@meta-crm/types';
import type { VisibilityRuleEntry, FieldType, FieldDefinitionResponse } from '@meta-crm/types';
import { usePermissions } from '@/hooks/usePermissions';
import { useLabels } from '@/hooks/useLabels';

export type { FieldDefinitionResponse as FieldDefinition } from '@meta-crm/types';

export interface DuplicateCheckResult {
  found: boolean;
  party_name?: string;
  phone?: string;
  source?: string;
  confidence: number;
}

interface DynamicFormProps<T extends FieldValues> {
  fields: FieldDefinitionResponse[];
  schema: z.ZodType<T>;
  defaultValues?: Partial<T>;
  prefillData?: Record<string, unknown>;
  resource: string;
  onSubmit: (data: T) => Promise<void>;
  submitLabel?: string;
  onPhoneBlur?: (phone: string) => Promise<DuplicateCheckResult>;
  children?: ReactNode;
}

export function DynamicForm<T extends FieldValues>({
  fields,
  schema,
  defaultValues,
  prefillData,
  resource,
  onSubmit,
  submitLabel = 'Save',
  onPhoneBlur,
  children,
}: DynamicFormProps<T>) {
  const { can } = usePermissions();
  const { t } = useLabels();
  const navigate = useNavigate();

  const canRead = can('read', resource as any);
  const canUpdate = can('update', resource as any);

  const form = useForm<T>({
    resolver: zodResolver(schema as any) as any,
    defaultValues: defaultValues as any,
    mode: 'onChange',
  });

  const { isDirty, isSubmitting } = useFormState(form);
  const watchedValues = useWatch({ control: form.control }) as Record<string, unknown>;

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const prefillSet = useMemo(() => new Set(Object.keys(prefillData ?? {})), [prefillData]);

  const sortedFields = useMemo(
    () => [...fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [fields],
  );

  const handleSubmit = form.handleSubmit(async (data) => {
    await onSubmit(data as T);
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {sortedFields.map((field) => {
        const isVisible = field.visibility_rules
          ? evaluateVisibilityRules(field.visibility_rules as any, watchedValues)
          : true;

        if (!isVisible) return null;

        if (!canRead) return null;

        return (
          <FormField
            key={field.id}
            field={field}
            form={form}
            canUpdate={canUpdate}
            isPrefilled={prefillSet.has(field.name)}
            onPhoneBlur={onPhoneBlur}
            t={t}
          />
        );
      })}

      {children}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {isSubmitting ? 'Saving...' : submitLabel}
      </button>
    </form>
  );
}

interface FormFieldProps<T extends FieldValues> {
  field: FieldDefinitionResponse;
  form: UseFormReturn<T>;
  canUpdate: boolean;
  isPrefilled: boolean;
  onPhoneBlur: ((phone: string) => Promise<DuplicateCheckResult>) | undefined;
  t: (key: string) => string;
}

function FormField<T extends FieldValues>({
  field,
  form,
  canUpdate,
  isPrefilled,
  onPhoneBlur,
  t,
}: FormFieldProps<T>) {
  const { register, formState, watch, setValue } = form;
  const fieldName = field.name as Path<T>;
  const error = formState.errors[fieldName];
  const currentValue = watch(fieldName);
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateCheckResult | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);

  const label = t(`field.${field.name}`) ?? field.label;

  const baseInputClass = `w-full rounded-md border px-3 py-2 text-sm ${
    error ? 'border-destructive' : 'border-input'
  } ${isPrefilled ? 'border-l-4 border-l-blue-500' : ''}`;

  const handlePhoneBlur = async () => {
    if (!onPhoneBlur || field.field_type !== 'phone') return;
    const phone = currentValue as string;
    if (!phone) return;
    setCheckingDuplicate(true);
    try {
      const result = await onPhoneBlur(phone);
      if (result) {
        setDuplicateWarning(result);
      }
    } catch {
      setDuplicateWarning(null);
    } finally {
      setCheckingDuplicate(false);
    }
  };

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

  const inputProps = register(fieldName, {
    required: field.required ? `${label} is required` : false,
  });

  let input: ReactNode;

  switch (field.field_type) {
    case 'text':
    case 'email':
      input = (
        <input
          {...inputProps}
          type={field.field_type}
          className={baseInputClass}
          onBlur={(e) => {
            inputProps.onBlur?.(e);
            handlePhoneBlur();
          }}
        />
      );
      break;

    case 'phone':
      input = (
        <div className="relative">
          <input
            {...inputProps}
            type="tel"
            className={baseInputClass}
            onBlur={(e) => {
              inputProps.onBlur?.(e);
              handlePhoneBlur();
            }}
          />
          {checkingDuplicate && (
            <span className="absolute right-2 top-2 text-xs text-muted-foreground">Checking...</span>
          )}
          {duplicateWarning?.found && (
            <div className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">
              Possible duplicate: {duplicateWarning.party_name} ({duplicateWarning.source})
            </div>
          )}
        </div>
      );
      break;

    case 'number':
      input = <input {...inputProps} type="number" className={baseInputClass} />;
      break;

    case 'date':
      input = <input {...inputProps} type="date" className={baseInputClass} />;
      break;

    case 'boolean':
      input = (
        <input
          type="checkbox"
          className="h-4 w-4 rounded border"
          checked={!!currentValue}
          onChange={(e) => setValue(fieldName, e.target.checked as PathValue<T, typeof fieldName>)}
        />
      );
      break;

    case 'select':
      input = (
        <select {...inputProps} className={baseInputClass}>
          <option value="">Select...</option>
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
      break;

    case 'multi_select':
      input = (
        <div className="space-y-1">
          {field.options?.map((opt) => {
            const selected = ((currentValue as string[]) ?? []).includes(opt);
            return (
              <label key={opt} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={(e) => {
                    const current = (currentValue as string[]) ?? [];
                    const next = e.target.checked
                      ? [...current, opt]
                      : current.filter((v) => v !== opt);
                    setValue(fieldName, next as PathValue<T, typeof fieldName>);
                  }}
                />
                {opt}
              </label>
            );
          })}
        </div>
      );
      break;

    default:
      input = <input {...inputProps} type="text" className={baseInputClass} />;
  }

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium">{label}</label>
      {input}
      {error && (
        <p className="text-xs text-destructive">{(error as { message?: string })?.message}</p>
      )}
    </div>
  );
}
