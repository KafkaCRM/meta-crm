import { useLocation, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { getTenant } from '@/api/platform';
import { Button } from '@/components/ui/button';
import { AlertTriangle, LogOut } from 'lucide-react';

export function SupportImpersonationBanner() {
  const location = useLocation();
  const navigate = useNavigate();

  // Match path: /admin/tenants/:id/impersonate
  const match = location.pathname.match(/^\/admin\/tenants\/([^/]+)\/impersonate$/);
  const tenantId = match ? match[1] : null;

  const { data: tenant } = useQuery({
    queryKey: ['tenant', tenantId],
    queryFn: () => getTenant(tenantId!),
    enabled: !!tenantId,
  });

  if (!tenantId) return null;

  const tenantName = tenant ? tenant.name : 'Loading...';

  const handleExit = () => {
    navigate({ to: '/admin/tenants/$id', params: { id: tenantId } });
  };

  return (
    <div className="bg-gradient-to-r from-amber-500 via-orange-600 to-amber-600 text-white px-4 py-2 flex items-center justify-between text-xs sm:text-sm font-semibold tracking-wide shadow-md border-b border-orange-700/50 animate-in slide-in-from-top duration-300">
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className="text-amber-100 animate-bounce flex-shrink-0" />
        <span>
          Support Impersonation Mode Active: Viewing Tenant{' '}
          <span className="underline decoration-wavy decoration-amber-200 font-bold">
            {tenantName}
          </span>{' '}
          (Read-Only System Context)
        </span>
      </div>
      <Button
        onClick={handleExit}
        size="xs"
        className="bg-card/10 hover:bg-card/20 text-white border border-white/20 hover:border-white/40 h-7 rounded px-3 transition-all flex items-center gap-1.5 shadow-sm"
      >
        <LogOut size={12} />
        <span>Exit Portal</span>
      </Button>
    </div>
  );
}
