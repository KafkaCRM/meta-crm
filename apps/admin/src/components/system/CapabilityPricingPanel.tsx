import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listCapabilityPricing,
  upsertCapabilityPricing,
  deleteCapabilityPricing,
  type CapabilityPricingItem,
} from '@/api/platform';
import { useAuth } from '@/contexts/auth.context';
import { RefreshCw, Check, DollarSign, Users, Save, Trash2 } from 'lucide-react';

export function CapabilityPricingPanel() {
  const { ability } = useAuth();
  const queryClient = useQueryClient();
  const canUpdate = ability?.can('update', 'Billing') ?? false;

  const { data: pricings = [], isLoading } = useQuery({
    queryKey: ['capability-pricing'],
    queryFn: listCapabilityPricing,
  });

  const upsertMutation = useMutation({
    mutationFn: ({ capabilityId, price_monthly, price_per_user }: { capabilityId: string; price_monthly: number; price_per_user: number }) =>
      upsertCapabilityPricing(capabilityId, { price_monthly, price_per_user }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['capability-pricing'] });
      toast.success('Capability pricing updated');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update pricing');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (capabilityId: string) => deleteCapabilityPricing(capabilityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['capability-pricing'] });
      toast.success('Capability pricing removed');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete pricing');
    },
  });

  const [editState, setEditState] = useState<Record<string, { price_monthly: string; price_per_user: string }>>({});

  const getEditState = (item: CapabilityPricingItem) => {
    if (!editState[item.capability_id]) {
      return {
        price_monthly: String(item.price_monthly),
        price_per_user: String(item.price_per_user),
      };
    }
    return editState[item.capability_id]!;
  };

  const handleSave = (item: CapabilityPricingItem) => {
    const state = editState[item.capability_id];
    if (!state) return;
    const monthly = parseFloat(state.price_monthly);
    const perUser = parseFloat(state.price_per_user);
    if (isNaN(monthly) || isNaN(perUser)) {
      toast.error('Invalid price values');
      return;
    }
    upsertMutation.mutate({
      capabilityId: item.capability_id,
      price_monthly: monthly,
      price_per_user: perUser,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-12 justify-center text-xs text-muted-foreground">
        <RefreshCw size={14} className="animate-spin" />
        Loading capability pricing…
      </div>
    );
  }

  if (pricings.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed border-border rounded-xl">
        <DollarSign size={24} className="mx-auto text-muted-foreground mb-2" />
        <p className="text-sm font-semibold text-foreground">No capability pricing configured</p>
        <p className="text-xs text-muted-foreground mt-1">Configure per-capability pricing below.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden border border-border rounded-xl">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left font-semibold text-muted-foreground px-4 py-3">Capability</th>
              <th className="text-left font-semibold text-muted-foreground px-4 py-3">Description</th>
              <th className="text-right font-semibold text-muted-foreground px-4 py-3">
                <span className="inline-flex items-center gap-1"><DollarSign size={11} /> Monthly</span>
              </th>
              <th className="text-right font-semibold text-muted-foreground px-4 py-3">
                <span className="inline-flex items-center gap-1"><Users size={11} /> Per User</span>
              </th>
              {canUpdate && <th className="w-16 px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pricings.map((item) => {
              const state = getEditState(item);
              const isDirty =
                state.price_monthly !== String(item.price_monthly) ||
                state.price_per_user !== String(item.price_per_user);
              const isPending = upsertMutation.isPending;

              return (
                <tr key={item.capability_id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-semibold text-foreground">{item.name}</td>
                  <td className="px-4 py-3 text-muted-foreground max-w-[260px] truncate">{item.description}</td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={state.price_monthly}
                      disabled={!canUpdate}
                      onChange={(e) =>
                        setEditState((prev) => ({
                          ...prev,
                          [item.capability_id]: { ...prev[item.capability_id] ?? state, price_monthly: e.target.value },
                        }))
                      }
                      className="w-full text-right rounded-lg border border-border px-3 py-1.5 bg-card focus:outline-none focus:ring-1 focus:ring-indigo-600 font-mono text-xs disabled:bg-muted disabled:text-muted-foreground"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={state.price_per_user}
                      disabled={!canUpdate}
                      onChange={(e) =>
                        setEditState((prev) => ({
                          ...prev,
                          [item.capability_id]: { ...prev[item.capability_id] ?? state, price_per_user: e.target.value },
                        }))
                      }
                      className="w-full text-right rounded-lg border border-border px-3 py-1.5 bg-card focus:outline-none focus:ring-1 focus:ring-indigo-600 font-mono text-xs disabled:bg-muted disabled:text-muted-foreground"
                    />
                  </td>
                  {canUpdate && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleSave(item)}
                          disabled={!isDirty || isPending}
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                            isDirty
                              ? 'bg-fin-orange border-fin-orange/30 text-white hover:bg-fin-orange/90'
                              : 'bg-muted border-border text-muted-foreground cursor-not-allowed'
                          }`}
                        >
                          {isPending ? (
                            <RefreshCw size={12} className="animate-spin" />
                          ) : (
                            <Save size={12} />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Reset pricing for "${item.name}" to defaults?`)) {
                              deleteMutation.mutate(item.capability_id);
                            }
                          }}
                          disabled={deleteMutation.isPending}
                          className="p-1.5 rounded-lg border border-border text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-all cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
