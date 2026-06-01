import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { createColumnHelper } from '@tanstack/react-table';
import { leadsApi, type LeadResponse } from '@/api/leads';
import { VirtualTable } from '@/components/shared/VirtualTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageShell } from '@/components/shared/PageShell';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Megaphone, UserCheck } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { LeadDetail } from './LeadDetail';
import dayjs from 'dayjs';

const columnHelper = createColumnHelper<LeadResponse>();

function LeadSourceBadge({ source }: { source: string }) {
  let variant: 'success' | 'warning' | 'info' | 'secondary' | 'outline' = 'outline';
  if (source === 'whatsapp') variant = 'success';
  else if (source === 'justdial') variant = 'warning';
  else if (source === 'facebook') variant = 'info';
  else if (source === 'web' || source === 'web_form') variant = 'secondary';

  const label = source === 'whatsapp' ? 'WhatsApp' : source === 'justdial' ? 'JustDial' : source === 'facebook' ? 'Facebook' : source === 'web' || source === 'web_form' ? 'Web Form' : source;

  return (
    <Badge variant={variant} className="capitalize shrink-0">
      {label}
    </Badge>
  );
}

function LeadStatusBadge({ status }: { status: string }) {
  let variant: 'default' | 'success' | 'warning' | 'destructive' | 'secondary' = 'secondary';
  if (status === 'converted' || status === 'qualified') variant = 'success';
  else if (status === 'unqualified') variant = 'destructive';
  else if (status === 'contacted') variant = 'warning';
  else if (status === 'new') variant = 'default';

  return (
    <Badge variant={variant} className="capitalize shrink-0">
      {status.replace('_', ' ')}
    </Badge>
  );
}

export function LeadList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['leads', debouncedSearch],
    queryFn: () => {
      const params: Record<string, string | number> = { limit: 500 };
      if (debouncedSearch) {
        params.name = debouncedSearch;
      }
      return leadsApi.list(params as any);
    },
    staleTime: 30_000,
  });

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: 'Name',
        cell: (info) => (
          <span className="font-semibold text-foreground">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('phone', {
        header: 'Phone',
        cell: (info) => (
          <span className="text-muted-foreground text-sm font-mono">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('email', {
        header: 'Email',
        cell: (info) => (
          <span className="text-muted-foreground text-sm">{info.getValue() || '-'}</span>
        ),
      }),
      columnHelper.accessor('source', {
        header: 'Source',
        cell: (info) => <LeadSourceBadge source={info.getValue()} />,
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        cell: (info) => <LeadStatusBadge status={info.getValue()} />,
      }),
      columnHelper.accessor('created_at', {
        header: 'Ingested',
        cell: (info) => (
          <span className="text-sm text-muted-foreground">
            {dayjs(info.getValue()).format('DD MMM YYYY HH:mm')}
          </span>
        ),
      }),
    ],
    [],
  );

  const handleRowClick = useCallback(
    (row: LeadResponse) => {
      setPreviewId(row.id);
      setPreviewOpen(true);
    },
    [],
  );

  const leads = data?.data ?? [];

  return (
    <PageShell
      title="Leads Ingestion"
      description="Monitor raw inbound prospects from Facebook, Justdial, Web Forms before converting them to client contacts."
      actions={null}
    >
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="relative w-80 max-w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={13} />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search leads by name..."
              className="pl-9 h-9 border-border bg-card text-foreground"
            />
          </div>
        </div>

        {/* Data Table */}
        <Card className="bg-card border-border rounded-xl shadow-xs overflow-hidden">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
                Loading leads...
              </div>
            ) : leads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <Megaphone size={36} className="text-muted-foreground/40 mb-3" />
                <p className="font-semibold text-foreground">No leads ingested yet</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Leads from connected third-party integrations (Facebook Ads, Justdial, etc.) will appear here automatically.
                </p>
              </div>
            ) : (
              <VirtualTable
                data={leads}
                columns={columns as any}
                rowCount={leads.length}
                isLoading={isLoading}
                resource="Party"
                onRowClick={handleRowClick}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Slide-out Preview Panel */}
      <Sheet open={previewOpen} onOpenChange={setPreviewOpen}>
        <SheetContent className="sm:max-w-[460px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Lead Record Details</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            {previewId && (
              <LeadDetail
                leadId={previewId}
                onClose={() => setPreviewOpen(false)}
                onChanged={() => {
                  refetch();
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </PageShell>
  );
}
