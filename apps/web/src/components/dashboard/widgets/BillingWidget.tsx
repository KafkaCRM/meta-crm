import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { capabilitiesApi } from '@/api/capabilities';
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
      <Card className={`bg-white border-[#d3cec6] rounded-xl shadow-none ${className ?? ''}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-[#111111]">Billing & Invoicing</CardTitle>
        </CardHeader>
        <Separator className="bg-[#ebe7e1]" />
        <CardContent className="pt-4 space-y-3">
          <Skeleton className="h-8 w-24 bg-[#ebe7e1]" />
          <Skeleton className="h-4 w-full bg-[#ebe7e1]" />
          <Skeleton className="h-4 w-3/4 bg-[#ebe7e1]" />
        </CardContent>
      </Card>
    );
  }

  if (error || !stats) {
    return (
      <Card className={`bg-white border-[#d3cec6] rounded-xl shadow-none ${className ?? ''}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-[#111111]">Billing & Invoicing</CardTitle>
        </CardHeader>
        <Separator className="bg-[#ebe7e1]" />
        <CardContent className="pt-4">
          <p className="text-xs text-[#c41c1c]">Failed to load billing metrics.</p>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  const collectionRate = stats.total_billed > 0 ? (stats.total_paid / stats.total_billed) * 100 : 0;

  return (
    <Card className={`bg-white border-[#d3cec6] rounded-xl shadow-none hover:shadow-md transition-shadow ${className ?? ''}`}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold text-[#111111]">Billing & Invoicing</CardTitle>
        <Receipt size={16} className="text-[#9c9fa5]" />
      </CardHeader>
      <Separator className="bg-[#ebe7e1]" />
      <CardContent className="pt-4 space-y-4">
        {/* Main metric row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-[#9c9fa5] font-medium uppercase tracking-wider">Outstanding</p>
            <p className="text-2xl font-bold text-[#111111] mt-1 tracking-tight">
              {formatCurrency(stats.total_outstanding)}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#9c9fa5] font-medium uppercase tracking-wider">Total Paid</p>
            <p className="text-2xl font-semibold text-[#0a7f2e] mt-1 tracking-tight">
              {formatCurrency(stats.total_paid)}
            </p>
          </div>
        </div>

        {/* Collection progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-[#626260]">
            <span>Invoices Collected</span>
            <span className="font-medium">{collectionRate.toFixed(0)}%</span>
          </div>
          <div className="w-full h-1.5 bg-[#ebe7e1] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#0bdf50] rounded-full transition-all"
              style={{ width: `${collectionRate}%` }}
            />
          </div>
        </div>

        {/* Secondary metrics */}
        <div className="flex items-center justify-between text-xs pt-1">
          <div className="flex items-center gap-1.5 text-[#626260]">
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

        <div className="pt-2 border-t border-[#ebe7e1]">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: '/invoices' })}
            className="w-full h-7 text-xs text-[#626260] hover:text-[#111111]"
          >
            Manage Invoices
            <ArrowUpRight size={12} className="ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
