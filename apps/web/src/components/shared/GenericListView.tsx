import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { objectsApi, type CustomFieldMeta } from '@/api/objects';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Search, Plus, Layers, Filter, RefreshCw, Trash2, Calendar, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface GenericListViewProps {
  objectKey: string;
}

export function GenericListView({ objectKey }: GenericListViewProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});

  // 1. Fetch Object Schema Definition
  const { data: meta, isLoading: metaLoading, error: metaError } = useQuery({
    queryKey: ['custom-object-meta', objectKey],
    queryFn: () => objectsApi.get(objectKey),
  });

  // 2. Fetch Records
  const { data: recordsData, isLoading: recordsLoading, refetch } = useQuery({
    queryKey: ['custom-object-records', objectKey, search, statusFilter],
    queryFn: () => objectsApi.listRecords(objectKey, { q: search || undefined, status: statusFilter || undefined }),
    enabled: !!meta,
  });

  // 3. Create Record Mutation
  const createMutation = useMutation({
    mutationFn: (data: Record<string, any>) => objectsApi.createRecord(objectKey, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-object-records', objectKey] });
      queryClient.invalidateQueries({ queryKey: ['custom-objects'] });
      setIsCreateOpen(false);
      setFormData({});
      toast.success(`${meta?.label || 'Record'} created successfully`);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create record');
    },
  });

  // 4. Delete Record Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => objectsApi.deleteRecord(objectKey, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-object-records', objectKey] });
      toast.success('Record removed');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete record');
    },
  });

  if (metaLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin text-primary" />
          Loading schema for {objectKey}…
        </div>
      </div>
    );
  }

  if (metaError || !meta) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center">
        <Layers className="mx-auto h-8 w-8 text-muted-foreground/50 mb-3" />
        <h3 className="text-base font-semibold text-foreground">Custom Object Not Found</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
          The entity &quot;{objectKey}&quot; has not been registered in this workspace yet.
        </p>
      </div>
    );
  }

  const fields = meta.fields || [];
  const previewFields = fields.slice(0, 3); // Display up to 3 custom fields in the list table
  const records = recordsData?.data || [];

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const primaryValue = formData[meta.primary_field] || formData.name;
    if (!primaryValue) {
      toast.error(`Please provide a ${meta.primary_field || 'name'}`);
      return;
    }

    createMutation.mutate({
      name: primaryValue,
      status: formData.status || 'active',
      data: formData,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">{meta.plural_label}</span>
            <Badge variant="outline" className="text-xs font-semibold uppercase tracking-wider">
              {meta.domain}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {meta.description || `Manage and track ${meta.plural_label.toLowerCase()} in your workspace.`}
          </p>
        </div>

        <Button
          onClick={() => setIsCreateOpen(true)}
          className="gap-2 rounded-xl shadow-sm font-semibold cursor-pointer"
        >
          <Plus size={16} />
          <span>New {meta.label}</span>
        </Button>
      </div>

      {/* Toolbar & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${meta.plural_label.toLowerCase()}...`}
              className="pl-9 h-9 text-xs rounded-xl bg-muted/40 border-border"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 text-xs font-medium border border-border rounded-xl px-2.5 bg-muted/40 text-foreground cursor-pointer outline-none"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-muted-foreground font-medium self-end sm:self-center">
          Showing <span className="font-semibold text-foreground">{records.length}</span> records
        </div>
      </div>

      {/* Dynamic Data Table */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">{meta.primary_field || 'Name'}</th>
                <th className="py-3 px-4">Status</th>
                {previewFields.map((f) => (
                  <th key={f.id} className="py-3 px-4">{f.label}</th>
                ))}
                <th className="py-3 px-4">Created</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recordsLoading ? (
                <tr>
                  <td colSpan={5 + previewFields.length} className="py-12 text-center text-muted-foreground">
                    <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2 text-primary" />
                    Loading records…
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={5 + previewFields.length} className="py-12 text-center text-muted-foreground">
                    <p className="text-sm font-semibold text-foreground">No {meta.plural_label.toLowerCase()} found</p>
                    <p className="text-xs text-muted-foreground mt-1">Get started by creating your first record.</p>
                    <Button
                      onClick={() => setIsCreateOpen(true)}
                      variant="outline"
                      size="sm"
                      className="mt-4 gap-1.5 rounded-xl text-xs font-semibold"
                    >
                      <Plus size={13} />
                      Add {meta.label}
                    </Button>
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-semibold text-foreground">
                      {r.name}
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant="secondary"
                        className={`text-[10px] font-bold uppercase tracking-wider capitalize ${
                          r.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-none'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {r.status}
                      </Badge>
                    </td>
                    {previewFields.map((f) => {
                      const val = r.data?.[f.name] ?? r.data?.[f.label];
                      return (
                        <td key={f.id} className="py-3 px-4 text-muted-foreground text-xs">
                          {val !== undefined && val !== null ? String(val) : '—'}
                        </td>
                      );
                    })}
                    <td className="py-3 px-4 text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          if (confirm(`Delete record '${r.name}'?`)) {
                            deleteMutation.mutate(r.id);
                          }
                        }}
                        className="text-muted-foreground hover:text-rose-600 rounded-lg"
                      >
                        <Trash2 size={13} />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dynamic Creation Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">New {meta.label}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Add a new {meta.label.toLowerCase()} to the system. Custom fields are validated dynamically.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-4 pt-2">
            {/* Primary Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground capitalize">
                {meta.primary_field || 'Name'} <span className="text-rose-500">*</span>
              </label>
              <Input
                required
                value={formData[meta.primary_field || 'name'] || ''}
                onChange={(e) => handleFieldChange(meta.primary_field || 'name', e.target.value)}
                placeholder={`Enter ${meta.primary_field || 'name'}...`}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            {/* Dynamic Schema Fields */}
            {fields
              .filter((f) => f.name !== meta.primary_field && f.name !== 'name')
              .map((field) => (
                <div key={field.id} className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    {field.label} {field.required && <span className="text-rose-500">*</span>}
                  </label>

                  {field.field_type === 'select' && field.options && field.options.length > 0 ? (
                    <select
                      value={formData[field.name] || ''}
                      onChange={(e) => handleFieldChange(field.name, e.target.value)}
                      required={field.required}
                      className="w-full h-9 text-xs font-medium border border-border rounded-xl px-2.5 bg-muted/40 text-foreground cursor-pointer outline-none"
                    >
                      <option value="">Select {field.label}...</option>
                      {field.options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : field.field_type === 'date' ? (
                    <Input
                      type="date"
                      value={formData[field.name] || ''}
                      onChange={(e) => handleFieldChange(field.name, e.target.value)}
                      required={field.required}
                      className="h-9 text-xs rounded-xl"
                    />
                  ) : field.field_type === 'number' ? (
                    <Input
                      type="number"
                      value={formData[field.name] || ''}
                      onChange={(e) => handleFieldChange(field.name, Number(e.target.value))}
                      required={field.required}
                      className="h-9 text-xs rounded-xl"
                    />
                  ) : (
                    <Input
                      type="text"
                      value={formData[field.name] || ''}
                      onChange={(e) => handleFieldChange(field.name, e.target.value)}
                      required={field.required}
                      placeholder={`Enter ${field.label.toLowerCase()}...`}
                      className="h-9 text-xs rounded-xl"
                    />
                  )}
                </div>
              ))}

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                className="rounded-xl text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="rounded-xl text-xs font-semibold gap-1.5"
              >
                {createMutation.isPending ? 'Saving…' : `Save ${meta.label}`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
