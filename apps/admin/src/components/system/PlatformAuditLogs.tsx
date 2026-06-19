import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getPlatformAuditLogs } from '@/api/platform';
import { 
  Search, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp, 
  Calendar, 
  User, 
  Info, 
  ShieldAlert,
  Shield,
  Activity,
  Globe,
  Terminal
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const PAGE_LIMIT = 50;

export function PlatformAuditLogs() {
  const [search, setSearch] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [allLogs, setAllLogs] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(true);

  // Fetch platform audit logs
  const { data: response, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['platform', 'audit-logs'],
    queryFn: () => getPlatformAuditLogs(),
    refetchInterval: 15000,
  });

  const logs = response?.data ?? [];

  // Reset accumulated logs when initial fetch changes
  const initialLogs = useMemo(() => {
    if (response) {
      setAllLogs(response.data ?? []);
      setCursor(response.next_cursor);
      setHasMore(!!response.next_cursor);
    }
    return response;
  }, [response]);

  const loadMore = async () => {
    if (!cursor || !hasMore) return;
    try {
      const nextPage = await getPlatformAuditLogs(cursor, PAGE_LIMIT);
      setAllLogs((prev) => [...prev, ...(nextPage.data ?? [])]);
      setCursor(nextPage.next_cursor);
      setHasMore(!!nextPage.next_cursor);
    } catch {
      // silently fail
    }
  };

  // Filter logs based on search query
  const filteredLogs = useMemo(() => {
    if (!search.trim()) return allLogs;

    const term = search.toLowerCase();
    return allLogs.filter((log) => {
      const action = (log.action || '').toLowerCase();
      const actorEmail = (log.actor_email || '').toLowerCase();
      const actorRole = (log.actor_role || '').toLowerCase();
      const reason = (log.reason || '').toLowerCase();
      const details = log.details ? JSON.stringify(log.details).toLowerCase() : '';
      return (
        action.includes(term) ||
        actorEmail.includes(term) ||
        actorRole.includes(term) ||
        reason.includes(term) ||
        details.includes(term)
      );
    });
  }, [logs, search]);

  const toggleExpand = (id: string) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  const formatDetails = (details: any) => {
    try {
      return JSON.stringify(details, null, 2);
    } catch {
      return String(details);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'medium',
      }).format(date);
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 max-w-[1280px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6 text-fin-orange" />
            Platform Audit Trail
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monitor real-time super-admin operations, system adjustments, plan updates, and support portal activities.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading || isFetching}
          className="h-9 border-border bg-card text-xs font-semibold text-foreground/80 rounded-lg hover:bg-muted transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <RefreshCw className={cn("h-3.5 w-3.5 text-muted-foreground", (isLoading || isFetching) && "animate-spin")} />
          Refresh Logs
        </Button>
      </div>

      {/* Main card */}
      <Card className="bg-card border-border rounded-xl shadow-sm overflow-hidden">
        {/* Search & Filter Header */}
        <CardHeader className="pb-4 border-b border-border/50 space-y-4 bg-muted/30">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter logs by Action, Actor email, Role, Reason..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs border-border bg-card text-foreground placeholder-slate-400 rounded-lg focus-visible:ring-indigo-500 shadow-none"
              />
            </div>
            <div className="text-xs text-muted-foreground font-medium">
              Showing {filteredLogs.length} of {allLogs.length} operations
            </div>
          </div>
        </CardHeader>

        {/* Audit Trail Timeline List */}
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
              <RefreshCw className="h-6 w-6 animate-spin text-fin-orange" />
              <p className="text-xs text-muted-foreground font-medium">Loading platform audit trail...</p>
            </div>
          ) : filteredLogs.length > 0 ? (
            <div className="divide-y divide-border/50">
              {filteredLogs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                
                // Color mapping for actions
                let actionColor = 'bg-slate-100 text-foreground/80 border-border';
                if (log.action.includes('suspend')) {
                  actionColor = 'bg-rose-50 text-rose-700 border-rose-100';
                } else if (log.action.includes('reactivate') || log.action.includes('create')) {
                  actionColor = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                } else if (log.action.includes('password') || log.action.includes('role')) {
                  actionColor = 'bg-amber-50 text-amber-700 border-amber-100';
                } else if (log.action.includes('plugin') || log.action.includes('entitlements')) {
                  actionColor = 'bg-violet-50 text-violet-700 border-violet-100';
                }

                return (
                  <div key={log.id} className="transition-colors hover:bg-muted/30">
                    <div 
                      className="flex items-center justify-between p-4 cursor-pointer select-none"
                      onClick={() => toggleExpand(log.id)}
                    >
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        {/* Status Icon Indicator */}
                        <div className="mt-0.5 p-1.5 bg-muted rounded-lg text-muted-foreground border border-border/50 flex-shrink-0">
                          <Activity className="h-4 w-4 text-fin-orange" />
                        </div>
                        
                        <div className="space-y-1 flex-1 min-w-0 pr-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge 
                              variant="outline" 
                              className={cn("text-[10px] py-0 px-2 rounded-md font-semibold tracking-tight uppercase", actionColor)}
                            >
                              {log.action}
                            </Badge>
                            {log.reason && (
                              <Badge 
                                variant="outline" 
                                className="bg-amber-50/40 text-amber-700 border-amber-100/50 text-[10px] py-0 px-2 rounded-md font-medium"
                              >
                                Reason: {log.reason}
                              </Badge>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <User className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-medium text-muted-foreground">{log.actor_email}</span>
                              <span className="text-[10px] text-muted-foreground">({log.actor_role})</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                              {formatDate(log.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Expand / Collapse Indicator */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground/80 hover:bg-muted/70 transition-colors flex-shrink-0"
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </Button>
                    </div>

                    {/* Expandable change log detail drawer */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 border-t border-dashed border-border/50 bg-muted/20">
                        <div className="grid md:grid-cols-2 gap-4 mt-2 mb-3">
                          <div className="bg-card p-3 rounded-lg border border-border/60 shadow-sm flex items-start gap-3">
                            <Globe className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <div className="space-y-0.5">
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Client IP Address</p>
                              <p className="text-xs font-mono font-medium text-foreground/80">{log.actor_ip || 'Internal System'}</p>
                            </div>
                          </div>
                          <div className="bg-card p-3 rounded-lg border border-border/60 shadow-sm flex items-start gap-3">
                            <Terminal className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <div className="space-y-0.5">
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Client Agent</p>
                              <p className="text-xs font-medium text-foreground/80 truncate max-w-md" title={log.user_agent}>{log.user_agent || 'Unknown Agent'}</p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                            <Info className="h-3.5 w-3.5 text-muted-foreground" />
                            Event Metadata Payload:
                          </div>
                          <pre className="text-[10px] font-mono bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto max-h-[300px] border border-slate-800 leading-normal">
                            {formatDetails(log.details)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : null}
            {filteredLogs.length > 0 && hasMore && (
              <div className="p-4 border-t border-border/50 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadMore}
                  className="h-8 text-xs font-semibold border-border bg-card text-muted-foreground rounded-lg hover:bg-muted"
                >
                  <RefreshCw className="h-3 w-3 mr-1.5" />
                  Load More
                </Button>
              </div>
            )}
            {filteredLogs.length === 0 && (
            <div className="py-16 text-center space-y-3">
              <div className="mx-auto w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-foreground">No Logs Recorded</h3>
                <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                  {search ? "No platform operations matched your active filters." : "No platform actions have been recorded yet."}
                </p>
              </div>
              {search && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSearch('')}
                  className="h-7 text-[10px] px-2.5 rounded-md"
                >
                  Clear Search
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
