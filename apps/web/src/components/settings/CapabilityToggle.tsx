import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Calendar, CreditCard, Home, Globe, Layers, ToggleLeft, ToggleRight, Check } from 'lucide-react';
import { settingsApi } from '@/api/settings';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePermissions } from '@/hooks/usePermissions';

export function CapabilityToggle() {
  const { can } = usePermissions();
  const canManage = can('manage', 'Plugin');
  const queryClient = useQueryClient();

  const { data: capabilities, isLoading } = useQuery({
    queryKey: ['settings', 'capabilities'],
    queryFn: () => settingsApi.capabilities.list(),
    staleTime: 30_000,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      settingsApi.capabilities.toggle(id, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'capabilities'] });
      toast.success('System capability updated');
    },
    onError: () => toast.error('Failed to update capability'),
  });

  const handleToggle = useCallback(
    (id: string, enabled: boolean) => {
      toggleMutation.mutate({ id, enabled: !enabled });
    },
    [toggleMutation],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-[#94a3b8]" />
      </div>
    );
  }

  // Capability ID to Icon mapping
  const getCapabilityIcon = (id: string) => {
    switch (id) {
      case 'capability/appointment':
        return Calendar;
      case 'capability/billing':
        return CreditCard;
      case 'capability/property-listing':
        return Home;
      case 'capability/custom-branding':
        return Globe;
      default:
        return Layers;
    }
  };

  return (
    <div className="space-y-6 max-w-[1000px]">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#0f172a]">Capabilities</h1>
        <p className="text-sm text-[#64748b] mt-0.5">
          Enable or disable optional system integrations, platform scopes, and telemetry features
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {capabilities?.map((cap) => {
          const Icon = getCapabilityIcon(cap.id);
          const isToggling = toggleMutation.isPending && toggleMutation.variables?.id === cap.id;

          return (
            <Card
              key={cap.id}
              className={`bg-white border transition-all rounded-xl shadow-none overflow-hidden flex flex-col justify-between ${
                cap.enabled ? 'border-[#e2e8f0]' : 'border-[#e2e8f0] opacity-80'
              }`}
            >
              <CardContent className="p-4 flex-1">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`p-2.5 rounded-lg border flex items-center justify-center flex-shrink-0 transition-colors ${
                      cap.enabled
                        ? 'bg-indigo-50/50 text-indigo-600 border-indigo-100'
                        : 'bg-[#f1f5f9] text-[#64748b] border-[#e2e8f0]'
                    }`}>
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-medium text-[#0f172a]">{cap.name}</span>
                        {cap.enabled && (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[8px] rounded-md font-bold py-0 px-1 flex items-center gap-0.5">
                            <Check size={8} strokeWidth={3} />
                            Active
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-[#64748b] mt-1 line-clamp-2 leading-relaxed">
                        {cap.description}
                      </p>
                    </div>
                  </div>

                  {/* Custom animated toggle switch */}
                  <button
                    disabled={isToggling || !canManage}
                    onClick={() => handleToggle(cap.id, cap.enabled)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 outline-none ${
                      cap.enabled ? 'bg-[#0f172a]' : 'bg-[#e2e8f0]'
                    } ${isToggling || !canManage ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        cap.enabled ? 'translate-x-4.5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              </CardContent>

              <div className="bg-[#f8fafc] border-t border-[#e2e8f0] px-4 py-2 flex items-center justify-between text-[9px] font-mono text-[#94a3b8]">
                <span>{cap.id}</span>
                {isToggling && <span className="animate-pulse text-[#64748b]">Updating...</span>}
              </div>
            </Card>
          );
        })}
        {capabilities?.length === 0 && (
          <div className="col-span-full py-8 text-center text-sm text-[#64748b]">
            No optional capabilities registered for this tenant.
          </div>
        )}
      </div>
    </div>
  );
}
