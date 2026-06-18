import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { createColumnHelper } from '@tanstack/react-table';
import { leadsApi, type LeadResponse } from '@/api/leads';
import { useBranch } from '@/contexts/branch.context';
import { VirtualTable } from '@/components/shared/VirtualTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageShell } from '@/components/shared/PageShell';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Megaphone, Plus, Phone, MessageSquare, AlertTriangle, AlertCircle, Clock, ExternalLink, FileText } from 'lucide-react';
import {
  CompactRecordRow,
  DEFAULT_RECORD_ACTIONS,
  OperationalStatusBadge,
  SourceBadge as OperationalSourceBadge,
  type OperationalStatus,
} from '@/components/shared';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LeadDetail } from './LeadDetail';
import { CreateLeadModal } from './CreateLeadModal';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const columnHelper = createColumnHelper<LeadResponse>();

function LeadSourceBadge({ source }: { source: string }) {
  const label = source === 'whatsapp' ? 'WhatsApp' : source === 'justdial' ? 'JustDial' : source === 'facebook' ? 'Facebook' : source === 'web' || source === 'web_form' ? 'Web Form' : source;
  return <OperationalSourceBadge source={label} />;
}

function LeadStatusBadge({ status }: { status: string }) {
  const operationalStatus: OperationalStatus =
    status === 'converted'
      ? 'converted'
      : status === 'qualified'
        ? 'qualified'
        : status === 'unqualified'
          ? 'lost'
          : status === 'contacted'
            ? 'contacted'
            : status === 'new'
              ? 'new'
              : 'pending';

  return <OperationalStatusBadge status={operationalStatus} label={status.replace('_', ' ')} />;
}

export function LeadList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'new' | 'unassigned' | 'hot' | 'duplicate' | 'junk'>('all');
  const { selectedVerticalIds } = useBranch();

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery]);

  const verticalIdsStr = selectedVerticalIds.length > 0 ? selectedVerticalIds.join(',') : '';

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['leads', verticalIdsStr, debouncedSearch, activeTab],
    queryFn: () => {
      const params: Record<string, string | number> = {};
      if (verticalIdsStr) params.vertical_ids = verticalIdsStr;
      if (debouncedSearch) {
        params.name = debouncedSearch;
      }
      if (activeTab === 'new') {
        params.status = 'new';
      } else if (activeTab === 'unassigned') {
        params.assigned_to_id = 'unassigned';
      } else if (activeTab === 'hot') {
        params.status = 'hot';
      } else if (activeTab === 'junk') {
        params.status = 'junk';
      }
      return leadsApi.list(params as any);
    },
    staleTime: 15_000,
  });

  const rawLeads = data?.data ?? [];

  // Client-side filter for duplicate risk tab
  const leads = useMemo(() => {
    if (activeTab === 'duplicate') {
      return rawLeads.filter((l: any) => l.duplicate_risk);
    }
    return rawLeads;
  }, [rawLeads, activeTab]);

  const openPhone = useCallback((phone: string) => {
    window.location.href = `tel:${phone}`;
  }, []);

  const openWhatsApp = useCallback((phone: string) => {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) cleaned = `91${cleaned}`;
    window.open(`https://api.whatsapp.com/send?phone=${cleaned}`, '_blank');
  }, []);

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: 'Name',
        cell: (info) => {
          const row = info.row.original as any;
          return (
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">{info.getValue()}</span>
              {row.duplicate_risk && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  <AlertTriangle size={8} />
                  Dupe
                </span>
              )}
            </div>
          );
        },
      }),
      columnHelper.accessor('phone', {
        header: 'Phone',
        cell: (info) => {
          const phone = info.getValue();
          const row = info.row.original as any;
          const isInvalid = row.phone_valid === false;
          return (
            <div className="flex items-center gap-2 group/phone">
              <span className={cn(
                "text-sm font-mono font-medium",
                isInvalid ? "text-red-500 line-through decoration-dotted" : "text-muted-foreground"
              )}>
                {phone}
              </span>
              {isInvalid && (
                <span className="text-red-500" title="Invalid format">
                  <AlertCircle size={12} />
                </span>
              )}
              <div className="flex items-center gap-1.5 opacity-0 group-hover/phone:opacity-100 transition-opacity ml-1">
                <button
                  onClick={(e) => { e.stopPropagation(); openPhone(phone); }}
                  className="p-1 rounded bg-muted hover:bg-slate-200/80 text-muted-foreground hover:text-foreground transition-colors"
                  title="Call"
                >
                  <Phone size={11} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); openWhatsApp(phone); }}
                  className="p-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-600 hover:text-emerald-700 transition-colors"
                  title="WhatsApp"
                >
                  <MessageSquare size={11} />
                </button>
              </div>
            </div>
          );
        },
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
        header: 'SLA Status',
        cell: (info) => {
          const row = info.row.original as any;
          const date = dayjs(info.getValue());
          const now = dayjs();
          const diffHours = now.diff(date, 'hour');
          const isConverted = row.status === 'converted';

          let slaText = date.fromNow();
          let pillStyle = "bg-muted text-muted-foreground border-transparent";
          
          if (!isConverted) {
            if (diffHours < 2) {
              pillStyle = "bg-emerald-50 text-emerald-700 border-emerald-200";
              slaText = `New (<2h)`;
            } else if (diffHours < 24) {
              pillStyle = "bg-amber-50 text-amber-700 border-amber-200";
              slaText = `No contact (${diffHours}h)`;
            } else {
              pillStyle = "bg-red-50 text-red-700 border-red-200 animate-pulse font-bold";
              slaText = `Stale (>24h)`;
            }
          } else {
            slaText = "Converted";
            pillStyle = "bg-slate-100 text-slate-400 border-transparent";
          }

          return (
            <div className="flex items-center gap-1.5">
              <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border", pillStyle)}>
                <Clock size={8} />
                {slaText}
              </span>
            </div>
          );
        },
      }),
      columnHelper.accessor('assigned_to', {
        header: 'Assignee',
        cell: (info) => {
          const assignee = info.getValue() as any;
          return (
            <span className="text-sm text-muted-foreground">
              {assignee?.name ?? <span className="text-slate-400 italic">Unassigned</span>}
            </span>
          );
        },
      }),
    ],
    [openPhone, openWhatsApp],
  );

  const handleRowClick = useCallback(
    (row: LeadResponse) => {
      setPreviewId(row.id);
      setPreviewOpen(true);
    },
    [],
  );

  return (
    <PageShell
      title="Leads"
      description="Operational Cockpit: Quick calling, quality qualification, and lead promotion to active deals."
      actions={
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-primary hover:bg-[#1e293b] text-white flex items-center gap-1.5 h-9 rounded-lg text-xs font-semibold"
        >
          <Plus size={14} />
          Add Lead
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Tab Selector */}
        <div className="flex border-b border-border gap-6 overflow-x-auto scrollbar-none text-sm pt-1">
          {(['all', 'new', 'unassigned', 'hot', 'duplicate', 'junk'] as const).map((tab) => {
            const listForCount = rawLeads.filter(l => {
              if (tab === 'all') return true;
              if (tab === 'new') return l.status === 'new';
              if (tab === 'unassigned') return !l.assigned_to_id;
              if (tab === 'hot') return l.status === 'hot';
              if (tab === 'duplicate') return l.duplicate_risk;
              if (tab === 'junk') return l.status === 'junk';
              return true;
            });
            const count = listForCount.length;

            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "pb-2.5 pt-1 font-semibold border-b-2 capitalize transition-all relative text-xs md:text-sm whitespace-nowrap",
                  activeTab === tab 
                    ? "border-primary text-foreground" 
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {tab === 'duplicate' ? 'Duplicate Risk' : tab}
                <span className={cn(
                  "ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full font-bold",
                  activeTab === tab
                    ? "bg-primary text-white"
                    : "bg-muted text-muted-foreground"
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

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
            ) : isError ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <AlertCircle size={36} className="text-red-400/60 mb-3" />
                <p className="font-semibold text-foreground">Failed to load leads</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  There was an error fetching leads. Please try again.
                </p>
                <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-4 h-8 text-xs">
                  Retry
                </Button>
              </div>
            ) : leads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <Megaphone size={36} className="text-muted-foreground/40 mb-3" />
                <p className="font-semibold text-foreground">No leads found</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  {activeTab !== 'all' 
                    ? `No leads match the "${activeTab === 'duplicate' ? 'duplicate risk' : activeTab}" filter right now.` 
                    : 'Add a lead manually or connect a third-party integration to start capturing leads.'}
                </p>
              </div>
            ) : (
              <>
                <div className="hidden lg:block">
                  <VirtualTable
                    data={leads}
                    columns={columns as any}
                    rowCount={leads.length}
                    isLoading={isLoading}
                    resource="Party"
                    onRowClick={handleRowClick}
                    getRowActions={(row) => {
                      const phone = row.phone;
                      const openPhoneLocal = (e: React.MouseEvent) => {
                        e.stopPropagation();
                        openPhone(phone);
                      };
                      const openWhatsAppLocal = (e: React.MouseEvent) => {
                        e.stopPropagation();
                        openWhatsApp(phone);
                      };
                      const viewDetail = (e: React.MouseEvent) => {
                        e.stopPropagation();
                        handleRowClick(row);
                      };
                      return (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded bg-muted hover:bg-emerald-50 hover:text-emerald-600 text-muted-foreground transition-all duration-200"
                            onClick={openPhoneLocal}
                            title="Call"
                          >
                            <Phone size={11} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded bg-muted hover:bg-emerald-50 hover:text-emerald-600 text-muted-foreground transition-all duration-200"
                            onClick={openWhatsAppLocal}
                            title="WhatsApp"
                          >
                            <MessageSquare size={11} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded bg-muted hover:bg-blue-50 hover:text-blue-600 text-muted-foreground transition-all duration-200"
                            onClick={viewDetail}
                            title="Quick View"
                          >
                            <ExternalLink size={11} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded bg-muted hover:bg-indigo-50 hover:text-indigo-600 text-muted-foreground transition-all duration-200"
                            onClick={(e) => { e.stopPropagation(); navigate({ to: '/leads/$id', params: { id: row.id } }); }}
                            title="Full Page"
                          >
                            <FileText size={11} />
                          </Button>
                        </div>
                      );
                    }}
                  />
                </div>
                <div className="lg:hidden divide-y divide-border">
                  {leads.map((lead: any) => (
                    <CompactRecordRow
                      key={lead.id}
                      title={lead.name}
                      subtitle={lead.phone}
                      status={<LeadStatusBadge status={lead.status} />}
                      source={<LeadSourceBadge source={lead.source} />}
                      meta={
                        <div className="flex flex-col gap-1 w-full text-xs">
                          <div className="flex items-center justify-between text-slate-500">
                            <span>{lead.email || 'No email'}</span>
                            <span>{dayjs(lead.created_at).format('DD MMM, h:mm A')}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {lead.duplicate_risk && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                <AlertTriangle size={8} />
                                Duplicate Risk
                              </span>
                            )}
                            {lead.phone_valid === false && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-50 text-red-700 border border-red-200">
                                <AlertCircle size={8} />
                                Invalid Phone
                              </span>
                            )}
                            {lead.assigned_to?.name && (
                              <span className="text-[10px] text-slate-400 italic">
                                Assigned: {lead.assigned_to.name}
                              </span>
                            )}
                          </div>
                        </div>
                      }
                      actions={[
                        DEFAULT_RECORD_ACTIONS.call(() => openPhone(lead.phone)),
                        DEFAULT_RECORD_ACTIONS.whatsapp(() => openWhatsApp(lead.phone)),
                      ]}
                      onClick={() => handleRowClick(lead)}
                    />
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lead Detail Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-[540px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lead Details</DialogTitle>
          </DialogHeader>
          {previewId && (
            <LeadDetail
              leadId={previewId}
              onClose={() => setPreviewOpen(false)}
              onChanged={() => {
                refetch();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Create Lead Modal */}
      <CreateLeadModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => {
          setCreateOpen(false);
          refetch();
        }}
      />
    </PageShell>
  );
}
