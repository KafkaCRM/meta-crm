import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { capabilitiesApi } from '@/api/capabilities';
import { useCurrency } from '@/contexts/currency.context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ArrowUpRight, Receipt, DollarSign, AlertCircle, CheckCircle2 } from 'lucide-react';

interface BillingWidgetProps {
  className?: string;
}

export function BillingWidget({ className }: BillingWidgetProps) {
  const navigate = useNavigate();

  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['billing', 'stats'],
    queryFn: () => capabilitiesApi.billing.getStats(),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <Card className={`bg-card border-border rounded-xl shadow-none ${className ?? ''}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">Billing & Invoicing</CardTitle>
        </CardHeader>
        <Separator className="bg-[#e2e8f0]" />
        <CardContent className="pt-4 space-y-3">
          <Skeleton className="h-8 w-24 bg-[#e2e8f0]" />
          <Skeleton className="h-4 w-full bg-[#e2e8f0]" />
          <Skeleton className="h-4 w-3/4 bg-[#e2e8f0]" />
        </CardContent>
      </Card>
    );
  }

  if (error || !stats) {
    return (
      <Card className={`bg-card border-border rounded-xl shadow-none ${className ?? ''}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">Billing & Invoicing</CardTitle>
        </CardHeader>
        <Separator className="bg-[#e2e8f0]" />
        <CardContent className="pt-4">
          <p className="text-xs text-[#c41c1c]">Failed to load billing metrics.</p>
        </CardContent>
      </Card>
    );
  }

  const { formatCurrency } = useCurrency();
  const collectionRate = stats.total_billed > 0 ? (stats.total_paid / stats.total_billed) * 100 : 0;

  return (
    <Card className={`bg-card border-border rounded-xl shadow-none hover:shadow-md transition-shadow ${className ?? ''}`}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold text-foreground">Billing & Invoicing</CardTitle>
        <Receipt size={16} className="text-muted-foreground" />
      </CardHeader>
      <Separator className="bg-[#e2e8f0]" />
      <CardContent className="pt-4 space-y-4">
        {/* Main metric row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Outstanding</p>
            <p className="text-2xl font-bold text-foreground mt-1 tracking-tight">
              {formatCurrency(stats.total_outstanding)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Paid</p>
            <p className="text-2xl font-semibold text-[#0a7f2e] mt-1 tracking-tight">
              {formatCurrency(stats.total_paid)}
            </p>
          </div>
        </div>

        {/* Collection progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Invoices Collected</span>
            <span className="font-medium">{collectionRate.toFixed(0)}%</span>
          </div>
          <div className="w-full h-1.5 bg-[#e2e8f0] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#0bdf50] rounded-full transition-all"
              style={{ width: `${collectionRate}%` }}
            />
          </div>
        </div>

        {/* Secondary metrics */}
        <div className="flex items-center justify-between text-xs pt-1">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <CheckCircle2 size={13} className="text-[#0a7f2e]" />
            <span>{stats.invoice_count} Total Invoices</span>
          </div>
          {stats.overdue_count > 0 && (
            <div className="flex items-center gap-1.5 text-[#c41c1c] font-medium">
              <AlertCircle size={13} />
              <span>{stats.overdue_count} Overdue</span>
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: '/invoices' })}
            className="w-full h-7 text-xs text-muted-foreground hover:text-foreground"
          >
            Manage Invoices
            <ArrowUpRight size={12} className="ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
