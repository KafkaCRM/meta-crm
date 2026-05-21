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
import { useState, useEffect, useMemo, useCallback, type ReactNode, useRef } from 'react';
import { useNavigate, useRouter, useLocation } from '@tanstack/react-router';
import { evaluateVisibilityRules } from '@meta-crm/types';
import type { FieldType, FieldDefinitionResponse } from '@meta-crm/types';
import { usePermissions } from '@/hooks/usePermissions';
import { useLabels } from '@/hooks/useLabels';
import { toast } from 'sonner';
import { Lock, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export type { FieldDefinitionResponse as FieldDefinition } from '@meta-crm/types';

export interface DuplicateCheckResult {
  found: boolean;
  party_name?: string;
  phone?: string;
  source?: string;
  confidence: number;
  match?: { id: string; name: string; phone_normalized: string; source: string };
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
  sectionGroups?: { label: string; fieldNames: string[] }[];
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
  sectionGroups,
}: DynamicFormProps<T>) {
  const { can } = usePermissions();
  const { t } = useLabels();
  const navigate = useNavigate();
  const router = useRouter();
  const location = useLocation();

  const canRead = can('read', resource as any);
  const canUpdate = can('update', resource as any);

  const form = useForm<T>({
    resolver: zodResolver(schema as any) as any,
    defaultValues: defaultValues as any,
    mode: 'onChange',
  });

  const { isDirty, isSubmitting, errors } = useFormState(form);
  const watchedValues = useWatch({ control: form.control }) as Record<string, unknown>;

  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const pendingNav = useRef<{ to: string; options?: Record<string, unknown> } | null>(null);

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

  const prefillSet = useMemo(
    () => new Set(Object.keys(prefillData ?? {})),
    [prefillData],
  );

  const sortedFields = useMemo(
    () => [...fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [fields],
  );

  const groupedFields = useMemo(() => {
    if (!sectionGroups || sectionGroups.length === 0) {
      return [{ label: '', fields: sortedFields }];
    }
    const ungrouped = sortedFields.filter(
      (f) => !sectionGroups.some((g) => g.fieldNames.includes(f.name)),
    );
    const result: { label: string; fields: FieldDefinitionResponse[] }[] = [];
    if (ungrouped.length > 0) {
      result.push({ label: '', fields: ungrouped });
    }
    for (const group of sectionGroups) {
      const groupFields = sortedFields.filter((f) => group.fieldNames.includes(f.name));
      if (groupFields.length > 0) {
        result.push({ label: group.label, fields: groupFields });
      }
    }
    return result;
  }, [sortedFields, sectionGroups]);

  const handleSubmit = form.handleSubmit(async (data) => {
    try {
      await onSubmit(data as T);
    } catch (err) {
      if (err instanceof Error && err.message.includes('field')) {
        const fieldError = err.message;
        toast.error(fieldError);
      } else {
        const message = err instanceof Error ? err.message : 'Failed to save';
        toast.error(message);
      }
    }
  });

  const handleNavAttempt = useCallback(
    (to: string, options?: Record<string, unknown>) => {
      if (isDirty && !isSubmitting) {
        pendingNav.current = { to, options: options ?? {} };
        setShowLeaveDialog(true);
        return false;
      }
      return true;
    },
    [isDirty, isSubmitting],
  );

  const confirmLeave = useCallback(async () => {
    setShowLeaveDialog(false);
    if (pendingNav.current) {
      const { to, options } = pendingNav.current;
      pendingNav.current = null;
      await router.navigate({ to, ...(options as any) });
    }
  }, [router]);

  if (!canRead) {
    return null;
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        {groupedFields.map((group, gi) => (
          <div key={gi} className="space-y-4">
            {group.label && (
              <>
                {gi > 0 && <Separator className="my-4" />}
                <h3 className="text-sm font-semibold text-[#111111] uppercase tracking-wider">
                  {group.label}
                </h3>
              </>
            )}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {group.fields.map((field) => {
                const isVisible = field.visibility_rules
                  ? evaluateVisibilityRules(field.visibility_rules as any, watchedValues)
                  : true;

                if (!isVisible) return null;

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
            </div>
          </div>
        ))}

        {children}

        <div className="flex gap-2 pt-4">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-[#111111] hover:bg-black text-white rounded-lg h-9 px-4 text-sm font-medium"
          >
            {isSubmitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {isSubmitting ? 'Saving...' : submitLabel}
          </Button>
        </div>
      </form>

      <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('form.unsaved.title') ?? 'Unsaved Changes'}</DialogTitle>
            <DialogDescription>
              {t('form.unsaved.message') ?? 'You have unsaved changes. Leave anyway?'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowLeaveDialog(false)}
              className="h-8"
            >
              {t('form.unsaved.stay') ?? 'Stay'}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmLeave}
              className="h-8"
            >
              {t('form.unsaved.leave') ?? 'Leave'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
  const { register, formState, watch, setValue, control } = form;
  const fieldName = field.name as Path<T>;
  const error = formState.errors[fieldName] as { message?: string } | undefined;
  const currentValue = watch(fieldName);
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateCheckResult | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);

  const label = t(`field.${field.name}`) ?? field.label;

  const inputBaseClass = `w-full rounded-lg border px-3 py-2 text-sm transition-colors ${
    error
      ? 'border-[#c41c1c] focus:border-[#c41c1c]'
      : 'border-[#d3cec6] focus:border-[#111111]'
  } ${isPrefilled ? 'border-l-[3px] border-l-[#3b82f6]' : ''} bg-white`;

  const handlePhoneBlur = async () => {
    if (!onPhoneBlur || field.field_type !== 'phone') return;
    const phone = currentValue as string;
    if (!phone) return;
    setCheckingDuplicate(true);
    try {
      const result = await onPhoneBlur(phone);
      setDuplicateWarning(result);
    } catch {
      setDuplicateWarning(null);
    } finally {
      setCheckingDuplicate(false);
    }
  };

  if (!canUpdate) {
    return (
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-[#626260]">
          {label}
          {field.required && <span className="text-[#c41c1c] ml-0.5">*</span>}
        </Label>
        <div className="flex items-center gap-2 rounded-lg border border-[#d3cec6] bg-[#f5f1ec] px-3 py-2">
          <Lock className="h-3.5 w-3.5 text-[#9c9fa5] shrink-0" />
          <span className="text-sm text-[#626260]">
            {(currentValue as string) ?? '—'}
          </span>
        </div>
      </div>
    );
  }

  let input: ReactNode;

  switch (field.field_type) {
    case 'text':
    case 'email':
      input = (
        <input
          {...register(fieldName)}
          type={field.field_type}
          className={inputBaseClass}
          onBlur={(e) => {
            register(fieldName).onBlur?.(e);
            handlePhoneBlur();
          }}
          placeholder={label}
        />
      );
      break;

    case 'phone':
      input = (
        <div className="space-y-1.5">
          <div className="relative">
            <input
              {...register(fieldName)}
              type="tel"
              className={inputBaseClass}
              onBlur={(e) => {
                register(fieldName).onBlur?.(e);
                handlePhoneBlur();
              }}
              placeholder={label}
            />
            {checkingDuplicate && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#9c9fa5]" />
              </span>
            )}
          </div>
          {duplicateWarning?.found && duplicateWarning.match && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2.5 space-y-2">
              <p className="text-sm font-medium text-amber-800">
                Possible duplicate found
              </p>
              <p className="text-sm text-amber-700">
                {duplicateWarning.match.name} — {duplicateWarning.match.phone_normalized}
              </p>
              <p className="text-xs text-amber-600">
                Source: {duplicateWarning.match.source} · Confidence: {Math.round(duplicateWarning.confidence * 100)}%
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs bg-amber-600 text-white border-amber-600 hover:bg-amber-700"
                  onClick={() => {
                    if (duplicateWarning.match?.id) {
                      window.location.href = `/parties/${duplicateWarning.match.id}`;
                    }
                  }}
                >
                  Use Existing
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-amber-300 text-amber-800 hover:bg-amber-100"
                  onClick={() => setDuplicateWarning(null)}
                >
                  Create Anyway
                </Button>
              </div>
            </div>
          )}
        </div>
      );
      break;

    case 'number':
      input = (
        <input
          {...register(fieldName, { valueAsNumber: true })}
          type="number"
          className={inputBaseClass}
          placeholder={label}
        />
      );
      break;

    case 'date':
      input = (
        <input
          {...register(fieldName)}
          type="date"
          className={inputBaseClass}
        />
      );
      break;

    case 'boolean':
      input = (
        <div className="flex items-center gap-2 pt-2">
          <Checkbox
            checked={!!currentValue}
            onCheckedChange={(checked) =>
              setValue(fieldName, checked as PathValue<T, typeof fieldName>)
            }
          />
          <span className="text-sm text-[#626260]">{label}</span>
        </div>
      );
      break;

    case 'select':
      input = (
        <Select
          value={(currentValue as string) ?? ''}
          onValueChange={(val) => setValue(fieldName, val as PathValue<T, typeof fieldName>)}
        >
          <SelectTrigger className={inputBaseClass}>
            <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
      break;

    case 'multi_select':
      input = (
        <div className="space-y-1.5">
          {field.options?.map((opt) => {
            const selected = ((currentValue as string[]) ?? []).includes(opt);
            return (
              <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={selected}
                  onCheckedChange={(checked) => {
                    const current = (currentValue as string[]) ?? [];
                    const next = checked
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
      input = (
        <input
          {...register(fieldName)}
          type="text"
          className={inputBaseClass}
          placeholder={label}
        />
      );
  }

  if (field.field_type === 'boolean') {
    return (
      <div className="space-y-1.5">
        {isPrefilled && (
          <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-[#3b82f6] text-[#3b82f6]">
            Pre-filled
          </Badge>
        )}
        {input}
        {error && (
          <p className="text-xs text-[#c41c1c]">{error.message}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5 relative">
      {isPrefilled && (
        <Badge variant="outline" className="absolute -top-2 -right-1 text-[10px] h-4 px-1.5 border-[#3b82f6] text-[#3b82f6] bg-white">
          Pre-filled
        </Badge>
      )}
      <Label className="text-sm font-medium text-[#626260]">
        {label}
        {field.required && <span className="text-[#c41c1c] ml-0.5">*</span>}
      </Label>
      {input}
      {error && (
        <p className="text-xs text-[#c41c1c]">{error.message}</p>
      )}
    </div>
  );
}
