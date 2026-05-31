import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CreditCard,
  TrendingUp,
  DollarSign,
  Users,
  Search,
  ArrowUpRight,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCcw,
  Download,
  Calendar,
  Building,
  ArrowDownRight,
  Sliders,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { listTenants } from '@/api/platform';

interface Transaction {
  id: string;
  tenantName: string;
  tenantSlug: string;
  planName: string;
  amount: number;
  status: 'Paid' | 'Pending' | 'Failed' | 'Refunded';
  date: string;
  billingCycle: 'Monthly' | 'Annual';
  invoiceNumber: string;
}

const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: 'TX-9021',
    tenantName: 'Acme Corporation',
    tenantSlug: 'acme-corp',
    planName: 'Enterprise Plan',
    amount: 2500.00,
    status: 'Paid',
    date: '2026-05-22T14:32:00Z',
    billingCycle: 'Monthly',
    invoiceNumber: 'INV-2026-042',
  },
  {
    id: 'TX-9022',
    tenantName: 'Globex Corp',
    tenantSlug: 'globex',
    planName: 'Starter Plan',
    amount: 150.00,
    status: 'Paid',
    date: '2026-05-20T09:15:00Z',
    billingCycle: 'Monthly',
    invoiceNumber: 'INV-2026-041',
  },
  {
    id: 'TX-9023',
    tenantName: 'Initech Systems',
    tenantSlug: 'initech',
    planName: 'Professional Plan',
    amount: 450.00,
    status: 'Paid',
    date: '2026-05-19T18:45:00Z',
    billingCycle: 'Monthly',
    invoiceNumber: 'INV-2026-040',
  },
  {
    id: 'TX-9024',
    tenantName: 'Umbrella Ltd',
    tenantSlug: 'umbrella',
    planName: 'Enterprise Plan',
    amount: 2500.00,
    status: 'Paid',
    date: '2026-05-18T11:04:00Z',
    billingCycle: 'Monthly',
    invoiceNumber: 'INV-2026-039',
  },
  {
    id: 'TX-9025',
    tenantName: 'Wayne Enterprises',
    tenantSlug: 'wayne',
    planName: 'Enterprise Plan',
    amount: 2500.00,
    status: 'Refunded',
    date: '2026-05-15T16:20:00Z',
    billingCycle: 'Monthly',
    invoiceNumber: 'INV-2026-038',
  },
  {
    id: 'TX-9026',
    tenantName: 'Hooli Inc',
    tenantSlug: 'hooli',
    planName: 'Professional Plan',
    amount: 450.00,
    status: 'Failed',
    date: '2026-05-12T08:00:00Z',
    billingCycle: 'Monthly',
    invoiceNumber: 'INV-2026-037',
  },
  {
    id: 'TX-9027',
    tenantName: 'Stark Industries',
    tenantSlug: 'stark',
    planName: 'Enterprise Plan',
    amount: 2500.00,
    status: 'Pending',
    date: '2026-05-10T10:11:00Z',
    billingCycle: 'Monthly',
    invoiceNumber: 'INV-2026-036',
  },
];

export function PlatformBilling() {
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [adjustingTx, setAdjustingTx] = useState<Transaction | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<string>('');

  const { data: tenantsRes } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => listTenants(),
  });

  const tenantCount = tenantsRes?.data?.length ?? 1;

  // KPIs
  const mrr = transactions
    .filter((tx) => tx.status === 'Paid')
    .reduce((sum, tx) => sum + (tx.billingCycle === 'Monthly' ? tx.amount : tx.amount / 12), 0) + 12500; // Mock additional MRR to look realistic

  const activeSubscribers = tenantCount + 23;

  const handleRefund = (txId: string) => {
    setTransactions((prev) =>
      prev.map((tx) => {
        if (tx.id === txId) {
          toast.success(`Successfully refunded invoice ${tx.invoiceNumber} for ${tx.tenantName}`);
          return { ...tx, status: 'Refunded' };
        }
        return tx;
      })
    );
    if (selectedTx?.id === txId) {
      setSelectedTx((prev) => prev ? { ...prev, status: 'Refunded' } : null);
    }
  };

  const handleAdjustBalance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingTx || !adjustAmount || isNaN(Number(adjustAmount))) {
      toast.error('Please enter a valid amount');
      return;
    }
    const amt = parseFloat(adjustAmount);
    setTransactions((prev) =>
      prev.map((tx) => {
        if (tx.id === adjustingTx.id) {
          toast.success(`Adjusted invoice ${tx.invoiceNumber} amount to $${amt.toFixed(2)}`);
          return { ...tx, amount: amt };
        }
        return tx;
      })
    );
    setAdjustingTx(null);
    setAdjustAmount('');
  };

  const filteredTransactions = transactions.filter((tx) => {
    const matchesSearch =
      tx.tenantName.toLowerCase().includes(search.toLowerCase()) ||
      tx.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      tx.planName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'All' || tx.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* KPI block */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card border-border rounded-xl shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-fin-orange/10 flex items-center justify-center text-fin-orange flex-shrink-0">
              <TrendingUp size={22} />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Monthly Recurring Revenue</p>
              <p className="text-2xl font-bold text-foreground mt-0.5">${mrr.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <span className="inline-flex items-center text-xs text-emerald-600 font-medium mt-1">
                <ArrowUpRight size={12} className="mr-0.5" /> +14.2% from last month
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border rounded-xl shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0">
              <Users size={22} />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Active Subscription Tiers</p>
              <p className="text-2xl font-bold text-foreground mt-0.5">{activeSubscribers} Workspaces</p>
              <span className="inline-flex items-center text-xs text-emerald-600 font-medium mt-1">
                <ArrowUpRight size={12} className="mr-0.5" /> +2 new this week
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border rounded-xl shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
              <DollarSign size={22} />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Total Invoiced (YTD)</p>
              <p className="text-2xl font-bold text-foreground mt-0.5">$245,200.00</p>
              <span className="inline-flex items-center text-xs text-muted-foreground font-medium mt-1">
                98.6% collection rate
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border rounded-xl shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600 flex-shrink-0">
              <AlertCircle size={22} />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Dunning / Retries Active</p>
              <p className="text-2xl font-bold text-foreground mt-0.5">1 Workspace</p>
              <span className="inline-flex items-center text-xs text-amber-600 font-medium mt-1">
                <Sliders size={12} className="mr-0.5" /> Auto-retry set for May 25
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left 2 columns - Transaction List */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-card border-border rounded-xl shadow-sm overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/50 bg-muted/50">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-semibold text-foreground">Invoices & Platform Ledger</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">Super User Platform Invoice Overrides</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1 border-border text-muted-foreground rounded-lg hover:bg-muted" onClick={() => {
                    setTransactions(INITIAL_TRANSACTIONS);
                    toast.info('Billing ledger reset to baseline');
                  }}>
                    <RefreshCcw size={13} />
                    Reset
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Search & Filter Header */}
              <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search by tenant name, plan, invoice..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-muted-foreground text-foreground"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter size={14} className="text-muted-foreground" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="text-xs font-semibold py-1.5 px-3 border border-border rounded-lg bg-card text-foreground/80 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="All">All Invoices</option>
                    <option value="Paid">Paid</option>
                    <option value="Pending">Pending</option>
                    <option value="Failed">Failed</option>
                    <option value="Refunded">Refunded</option>
                  </select>
                </div>
              </div>

              {/* Grid */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-muted-foreground border-b border-border/50">
                    <tr>
                      <th className="px-5 py-3 text-left font-medium text-xs uppercase tracking-wider">Tenant</th>
                      <th className="px-5 py-3 text-left font-medium text-xs uppercase tracking-wider">Invoice</th>
                      <th className="px-5 py-3 text-left font-medium text-xs uppercase tracking-wider">Amount</th>
                      <th className="px-5 py-3 text-left font-medium text-xs uppercase tracking-wider">Status</th>
                      <th className="px-5 py-3 text-left font-medium text-xs uppercase tracking-wider">Date</th>
                      <th className="px-5 py-3 text-right font-medium text-xs uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50 bg-card">
                    {filteredTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-muted-foreground text-sm">
                          No matching platform transactions found.
                        </td>
                      </tr>
                    ) : (
                      filteredTransactions.map((tx) => {
                        const isPaid = tx.status === 'Paid';
                        const isPending = tx.status === 'Pending';
                        const isFailed = tx.status === 'Failed';
                        const isRefunded = tx.status === 'Refunded';

                        return (
                          <tr key={tx.id} className="hover:bg-muted/50 transition-colors">
                            <td className="px-5 py-3.5">
                              <div className="flex flex-col">
                                <span className="font-semibold text-foreground">{tx.tenantName}</span>
                                <span className="text-xs text-muted-foreground font-mono">{tx.planName}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="text-xs font-semibold text-muted-foreground font-mono">{tx.invoiceNumber}</span>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="font-medium text-foreground">${tx.amount.toFixed(2)}</span>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                                isPaid ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                isPending ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                                isFailed ? 'bg-rose-50 text-rose-700 border border-rose-100 animate-pulse' :
                                'bg-slate-100 text-muted-foreground border border-border'
                              }`}>
                                <span className={`w-1 h-1 rounded-full ${
                                  isPaid ? 'bg-emerald-500' :
                                  isPending ? 'bg-amber-500' :
                                  isFailed ? 'bg-rose-500' :
                                  'bg-slate-400'
                                }`} />
                                {tx.status}
                              </span>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="text-xs text-muted-foreground">{new Date(tx.date).toLocaleDateString()}</span>
                            </td>
                            <td className="px-5 py-3.5 text-right space-x-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2.5 text-xs text-muted-foreground hover:bg-muted/70 rounded-md"
                                onClick={() => setSelectedTx(tx)}
                              >
                                View
                              </Button>
                              {isPaid && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2.5 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 rounded-md"
                                  onClick={() => handleRefund(tx.id)}
                                >
                                  Refund
                                </Button>
                              )}
                              {!isRefunded && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2.5 text-xs text-fin-orange hover:bg-fin-orange/10 hover:text-fin-orange rounded-md"
                                  onClick={() => {
                                    setAdjustingTx(tx);
                                    setAdjustAmount(tx.amount.toString());
                                  }}
                                >
                                  Adjust
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right 1 column - Diagnostics & Active Tier Distribution */}
        <div className="space-y-6">
          {/* Diagnostic Drawer Card / Selected Invoice detail */}
          {selectedTx ? (
            <Card className="bg-[#0b0f19] border-slate-800 text-slate-100 rounded-xl shadow-lg relative overflow-hidden animate-in slide-in-from-right duration-200">
              <CardHeader className="border-b border-slate-800 pb-3 bg-slate-900/40">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[9px] uppercase font-mono tracking-widest text-fin-orange">Platform Diagnostic Console</span>
                    <CardTitle className="text-base font-bold font-mono text-white mt-1">Invoice Inspector</CardTitle>
                  </div>
                  <button
                    onClick={() => setSelectedTx(null)}
                    className="text-muted-foreground hover:text-white text-xs font-semibold px-2 py-0.5 rounded-md hover:bg-muted"
                  >
                    Close
                  </button>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4 text-sm">
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 space-y-3 font-mono text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">TXREF_ID:</span>
                    <span className="text-fin-orange">{selectedTx.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">INVOICE_NUM:</span>
                    <span className="text-slate-200 font-semibold">{selectedTx.invoiceNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">TENANT_SLUG:</span>
                    <span className="text-slate-200">{selectedTx.tenantSlug}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">BILLING_PLAN:</span>
                    <span className="text-slate-200">{selectedTx.planName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">CYCLE_RATE:</span>
                    <span className="text-slate-200">{selectedTx.billingCycle}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Total Invoice Amount</p>
                  <p className="text-3xl font-extrabold text-white tracking-tight">${selectedTx.amount.toFixed(2)}</p>
                </div>

                <div className="border-t border-slate-800 pt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-muted-foreground" />
                    <span className="text-xs text-muted-foreground/70">Generated: {new Date(selectedTx.date).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building size={14} className="text-muted-foreground" />
                    <span className="text-xs text-muted-foreground/70">Workspace: {selectedTx.tenantName}</span>
                  </div>
                </div>

                {/* Simulated Ledger Log */}
                <div className="border-t border-slate-800 pt-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Gateway Transaction Event Logs</p>
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-900 font-mono text-[10px] text-muted-foreground space-y-1 overflow-auto max-h-[140px] leading-tight">
                    <p className="text-muted-foreground">[2026-05-22T14:30:00Z] INITIALIZE_CHARGE</p>
                    <p className="text-muted-foreground">[2026-05-22T14:30:05Z] GATEWAY_PINGED: Stripe_v3</p>
                    <p className="text-emerald-500">[2026-05-22T14:32:00Z] SUCCESS: Charge authorized (ch_3M4e81)</p>
                    <p className="text-muted-foreground/70">[2026-05-22T14:32:10Z] SYSTEM_PROVISIONS: Extended plan terms verified</p>
                    {selectedTx.status === 'Refunded' && (
                      <p className="text-rose-400">[2026-05-23T02:20:00Z] OVERRIDE: Platform Owner requested refund (rf_1A2b3c)</p>
                    )}
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg h-9 font-medium transition-colors border border-slate-700 text-xs"
                    onClick={() => {
                      toast.info(`Invoice ${selectedTx.invoiceNumber} PDF downloaded successfully (Simulated)`);
                    }}
                  >
                    <Download size={13} className="mr-1.5 text-muted-foreground/70" /> Download PDF
                  </Button>
                  {selectedTx.status === 'Paid' && (
                    <Button
                      size="sm"
                      className="bg-rose-600 hover:bg-rose-700 text-white rounded-lg h-9 font-medium transition-colors text-xs"
                      onClick={() => handleRefund(selectedTx.id)}
                    >
                      Ref_und
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            /* Standard Plan Distribution Overview */
            <Card className="bg-card border-border rounded-xl shadow-sm">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-sm font-bold text-foreground uppercase tracking-wide">Plan Tier Share</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">Subscriber Distribution Overview</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {[
                  { name: 'Enterprise Plan', count: 6, percentage: 25, mrr: 15000, color: 'bg-fin-orange' },
                  { name: 'Professional Plan', count: 12, percentage: 50, mrr: 5400, color: 'bg-emerald-500' },
                  { name: 'Starter Plan', count: 6, percentage: 25, mrr: 900, color: 'bg-amber-500' },
                ].map((tier) => (
                  <div key={tier.name} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-foreground/80">{tier.name}</span>
                      <span className="font-mono text-muted-foreground font-medium">
                        {tier.count} ({tier.percentage}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${tier.color}`} style={{ width: `${tier.percentage}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground font-semibold font-mono">
                      <span>Est. MRR:</span>
                      <span className="text-muted-foreground">${tier.mrr.toLocaleString()}</span>
                    </div>
                  </div>
                ))}

                <div className="border-t border-border/50 pt-4 bg-muted/50 -mx-6 -mb-6 p-4">
                  <div className="flex items-center justify-between text-xs font-semibold text-foreground/80">
                    <span>Average Platform ACV:</span>
                    <span className="font-mono font-bold text-slate-950">$24,250.00</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Adjust Balance Modal Overlays */}
      {adjustingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <Card className="bg-card border-border max-w-sm w-full mx-4 shadow-xl rounded-xl overflow-hidden animate-in zoom-in-95 duration-150">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-base font-semibold text-foreground">Adjust Invoice Balance</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">Override billing charge for {adjustingTx.tenantName}</CardDescription>
            </CardHeader>
            <form onSubmit={handleAdjustBalance}>
              <CardContent className="pt-4 space-y-4">
                <div>
                  <label htmlFor="adjust-amount" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Invoice Amount ($ USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-sm text-muted-foreground">$</span>
                    <input
                      id="adjust-amount"
                      type="number"
                      value={adjustAmount}
                      onChange={(e) => setAdjustAmount(e.target.value)}
                      className="w-full pl-7 pr-4 py-1.5 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-muted-foreground text-foreground font-mono"
                      step="any"
                      required
                    />
                  </div>
                  <p className="mt-1.5 text-[10px] text-muted-foreground">Original invoice amount: <strong className="font-mono text-muted-foreground">${adjustingTx.amount.toFixed(2)}</strong></p>
                </div>
              </CardContent>
              <div className="p-4 bg-muted flex justify-end gap-2 border-t border-border/50">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs border-border rounded-lg hover:bg-muted/70 text-foreground/80"
                  onClick={() => setAdjustingTx(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="h-8 text-xs bg-fin-orange hover:bg-fin-orange/90 text-white rounded-lg"
                >
                  Apply Adjustment
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
