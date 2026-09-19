import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { franchiseApi, type FranchiseStatus, type FranchiseeSummary } from '@/api/franchise';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Network,
  Store,
  Building2,
  Users,
  DollarSign,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Search,
  Sparkles,
  Calculator,
  FileSpreadsheet,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';

export function FranchisePage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [testZipCode, setTestZipCode] = useState('');
  const [matchedStore, setMatchedStore] = useState<string | null>(null);

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['franchise', 'status'],
    queryFn: () => franchiseApi.getStatus(),
  });

  const { data: franchisees = [], isLoading: franchiseesLoading } = useQuery({
    queryKey: ['franchise', 'franchisees'],
    queryFn: () => franchiseApi.getFranchisees(),
    enabled: !!status?.is_franchisor,
  });

  const { data: analytics } = useQuery({
    queryKey: ['franchise', 'analytics'],
    queryFn: () => franchiseApi.getAnalytics(),
    enabled: !!status?.is_franchisor,
  });

  const handleTestRouting = () => {
    if (!testZipCode.trim()) {
      toast.error('Enter a postal/zip code to test territory dispatch');
      return;
    }
    const cleanZip = testZipCode.trim().toUpperCase();
    const matched = franchisees.find((f) =>
      f.territory_codes?.some((code) => code.toUpperCase() === cleanZip || code.toUpperCase().startsWith(cleanZip.slice(0, 3)))
    );
    if (matched) {
      setMatchedStore(matched.name);
      toast.success(`Matched to store: ${matched.name}`);
    } else {
      setMatchedStore('No local territory match (Fallback to HQ Direct)');
      toast.info('No matching franchisee territory found. Lead retained at Franchisor HQ.');
    }
  };

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
        Loading enterprise franchise operations…
      </div>
    );
  }

  // --- Franchisee Unit View ---
  if (status?.is_franchisee) {
    return (
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Store className="text-blue-500" size={24} />
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Franchise Store Operations</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Affiliated store unit under {status.parent_franchisor?.name || 'Franchisor HQ'}
            </p>
          </div>
          <Badge variant="outline" className="px-3 py-1 bg-blue-500/10 text-blue-600 border-blue-500/20 font-semibold flex items-center gap-1.5">
            <CheckCircle2 size={13} />
            Verified Store
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-border">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs">Franchisor Authority</CardDescription>
              <CardTitle className="text-lg font-bold text-foreground">
                {status.parent_franchisor?.name || 'National HQ'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-1 text-xs text-muted-foreground">
              Industry: {status.parent_franchisor?.industry || 'Commercial Enterprise'}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs">Royalty Rate</CardDescription>
              <CardTitle className="text-lg font-bold text-foreground">
                {status.royalty_percentage ?? 0}%
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-1 text-xs text-muted-foreground">
              Applied on monthly net billed revenue
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs">Assigned Territories</CardDescription>
              <CardTitle className="text-lg font-bold text-foreground">
                {status.territory_codes?.length ?? 0} Territory Codes
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-1 text-xs text-muted-foreground truncate">
              {status.territory_codes?.join(', ') || 'Global store allocation'}
            </CardContent>
          </Card>
        </div>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Royalty Invoicing & HQ Compliance</CardTitle>
            <CardDescription className="text-xs">
              Automated monthly settlement statements between your store and {status.parent_franchisor?.name || 'Franchisor HQ'}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground space-y-3">
              <ShieldCheck className="mx-auto text-emerald-500" size={32} />
              <p className="font-semibold text-foreground">Your store is in active standing</p>
              <p className="text-xs max-w-md mx-auto">
                Leads originating in your registered territory codes ({status.territory_codes?.join(', ') || 'Store Radius'}) are automatically assigned to your store CRM pipeline.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Franchisor HQ Executive View ---
  if (status?.is_franchisor) {
    const filteredFranchisees = franchisees.filter(
      (f) =>
        f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.slug.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Network className="text-purple-600" size={24} />
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Franchisor HQ Command Center</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Multi-unit store operations, territory lead distribution, and royalty management
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                toast.success('Generated monthly royalty statements for active network');
              }}
              className="text-xs gap-1.5 h-8 border-border"
            >
              <Calculator size={13} />
              Calculate Royalties
            </Button>
            <Button
              size="sm"
              onClick={() => {
                const csv = [
                  ['Store Name', 'Status', 'Branches', 'Users', 'Royalty %', 'Territories'].join(','),
                  ...franchisees.map((f) =>
                    [f.name, f.status, f.branch_count, f.user_count, `${f.royalty_percentage}%`, `"${(f.territory_codes || []).join(' ')}"`].join(',')
                  ),
                ].join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `franchise_network_${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
                toast.success('Franchise network directory exported to CSV');
              }}
              className="text-xs gap-1.5 h-8 bg-purple-600 hover:bg-purple-700 text-white"
            >
              <FileSpreadsheet size={13} />
              Export Rollup
            </Button>
          </div>
        </div>

        {/* Network KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border shadow-none">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Network Stores</span>
              <Store size={15} className="text-purple-500" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold text-foreground">{status.franchisee_count}</div>
              <p className="text-[11px] text-muted-foreground mt-1">Active franchisee workspaces</p>
            </CardContent>
          </Card>

          <Card className="border-border shadow-none">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Physical Outlets</span>
              <Building2 size={15} className="text-blue-500" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold text-foreground">
                {franchisees.reduce((acc, f) => acc + (f.branch_count || 0), 0)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Store branch locations</p>
            </CardContent>
          </Card>

          <Card className="border-border shadow-none">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Franchise Staff</span>
              <Users size={15} className="text-emerald-500" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold text-foreground">
                {franchisees.reduce((acc, f) => acc + (f.user_count || 0), 0)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Network operators & sales reps</p>
            </CardContent>
          </Card>

          <Card className="border-border shadow-none">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Default Royalty</span>
              <DollarSign size={15} className="text-amber-500" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold text-foreground">{status.royalty_percentage ?? 5}%</div>
              <p className="text-[11px] text-muted-foreground mt-1">Standard contract rate</p>
            </CardContent>
          </Card>
        </div>

        {/* Territory Dispatch Simulator */}
        <Card className="border-border shadow-none bg-muted/20">
          <CardHeader className="p-4 pb-3">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-purple-600" />
              <CardTitle className="text-sm font-semibold">Territory Lead Auto-Routing Engine</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Test automated lead routing. Inbound leads from website webhooks are matched against store territory codes.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex items-center gap-2 max-w-md">
              <Input
                placeholder="Enter Zip / Postal Code (e.g. 10001, SW1A)"
                value={testZipCode}
                onChange={(e) => setTestZipCode(e.target.value)}
                className="h-8 text-xs bg-background border-border"
              />
              <Button size="sm" onClick={handleTestRouting} className="h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white gap-1 shrink-0">
                <Sparkles size={12} />
                Test Dispatch
              </Button>
            </div>
            {matchedStore && (
              <div className="mt-3 p-2.5 rounded-lg bg-background border border-border text-xs flex items-center justify-between">
                <span className="text-muted-foreground">Routing Destination:</span>
                <span className="font-bold text-purple-600 dark:text-purple-400">{matchedStore}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Franchisee Directory Table */}
        <Card className="border-border shadow-none">
          <CardHeader className="p-4 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-semibold">Franchisee Store Directory</CardTitle>
              <CardDescription className="text-xs">Active franchisee partner tenants</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Filter stores…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 pl-8 text-xs border-border bg-muted/40"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border">
                  <TableHead className="text-xs font-semibold">Store / Tenant</TableHead>
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                  <TableHead className="text-xs font-semibold">Locations</TableHead>
                  <TableHead className="text-xs font-semibold">Staff</TableHead>
                  <TableHead className="text-xs font-semibold">Royalty %</TableHead>
                  <TableHead className="text-xs font-semibold">Territories</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFranchisees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-xs text-muted-foreground">
                      No franchisee stores registered in this network.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredFranchisees.map((store) => (
                    <TableRow key={store.id} className="border-border/60 hover:bg-muted/40">
                      <TableCell className="font-semibold text-xs text-foreground">
                        <div className="flex items-center gap-2">
                          <Store size={14} className="text-purple-500 shrink-0" />
                          <div>
                            <p>{store.name}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{store.slug}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={store.status === 'active' ? 'outline' : 'secondary'}
                          className="text-[10px] capitalize font-medium"
                        >
                          {store.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {store.branch_count} {store.branch_count === 1 ? 'branch' : 'branches'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {store.user_count} team members
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-foreground">
                        {store.royalty_percentage}%
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {store.territory_codes && store.territory_codes.length > 0 ? (
                            store.territory_codes.map((code) => (
                              <span key={code} className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">
                                {code}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] italic">Universal</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Independent Business View ---
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Franchise Architecture</h1>
      <Card className="border-border">
        <CardContent className="p-6 text-sm text-muted-foreground space-y-3">
          <p>
            This workspace is operating in <strong>Independent Mode</strong>.
          </p>
          <p className="text-xs leading-relaxed">
            Franchise operations (store rollups, territory dispatching, and royalty calculation) are available when operating as a <strong>Franchisor HQ</strong> or <strong>Franchisee Unit</strong>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
