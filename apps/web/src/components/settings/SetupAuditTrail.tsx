import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { settingsApi } from '@/api/settings';
import { 
  Search, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp, 
  Calendar, 
  User, 
  Info, 
  ShieldAlert,
  Sliders
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function SetupAuditTrail() {
  const [search, setSearch] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Fetch audit trail
  const { data: logs, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['settings', 'setup-audits'],
    queryFn: () => settingsApi.setupAudits.list(),
    staleTime: 10_000,
  });

  // Filter logs based on search query
  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    if (!search.trim()) return logs;

    const term = search.toLowerCase();
    return logs.filter((log) => {
      const action = (log.action || '').toLowerCase();
      const section = (log.section || '').toLowerCase();
      const user = (log.user_email || '').toLowerCase();
      const details = (log.details || '').toLowerCase();
      return (
        action.includes(term) ||
        section.includes(term) ||
        user.includes(term) ||
        details.includes(term)
      );
    });
  }, [logs, search]);

  const toggleExpand = (id: string) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  const formatDetails = (detailsStr: string) => {
    try {
      const parsed = JSON.parse(detailsStr);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return detailsStr;
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
    <div className="space-y-6 max-w-[1200px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Sliders className="h-6 w-6 text-foreground" />
            Setup Audit Trail
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monitor administrative configuration changes, schema definitions, and visual page layout modifications.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading || isFetching}
          className="h-9 border-border bg-card text-xs font-semibold text-foreground/80 rounded-lg hover:bg-muted transition-colors flex items-center gap-1.5"
        >
          <RefreshCw className={cn("h-3.5 w-3.5 text-muted-foreground", (isLoading || isFetching) && "animate-spin")} />
          Refresh Logs
        </Button>
      </div>

      {/* Main card */}
      <Card className="bg-card border-border rounded-xl shadow-none overflow-hidden">
        {/* Search & Filter Header */}
        <CardHeader className="pb-4 border-b border-border space-y-4 bg-muted/20">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter logs by Action, Section, User email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs border-border bg-card text-foreground placeholder-[#94a3b8] rounded-lg focus-visible:ring-indigo-500"
              />
            </div>
            <div className="text-xs text-muted-foreground font-medium">
              Showing {filteredLogs.length} of {logs?.length || 0} recent changes
            </div>
          </div>
        </CardHeader>

        {/* Audit Trail Timeline List */}
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
              <RefreshCw className="h-6 w-6 animate-spin text-fin-orange" />
              <p className="text-xs text-muted-foreground font-medium">Loading audit logs...</p>
            </div>
          ) : filteredLogs.length > 0 ? (
            <div className="divide-y divide-[#e2e8f0]">
              {filteredLogs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                return (
                  <div key={log.id} className="transition-colors hover:bg-muted/50">
                    <div 
                      className="flex items-center justify-between p-4 cursor-pointer select-none"
                      onClick={() => toggleExpand(log.id)}
                    >
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        {/* Status Icon Indicator */}
                        <div className="mt-0.5 p-1.5 bg-slate-100 rounded-lg text-muted-foreground border border-border">
                          <Sliders className="h-3.5 w-3.5" />
                        </div>
                        
                        <div className="space-y-1 flex-1 min-w-0 pr-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-foreground">
                              {log.action}
                            </span>
                            <Badge 
                              variant="outline" 
                              className="bg-[#f1f5f9] text-[#475569] border-border text-[9px] py-0 px-1.5 rounded-md font-medium"
                            >
                              {log.section}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3 text-muted-foreground" />
                              {log.user_email}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              {formatDate(log.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Expand / Collapse Indicator */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground/80 hover:bg-muted/70 transition-colors"
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </Button>
                    </div>

                    {/* Expandable change log detail card */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 border-t border-dashed border-border bg-muted/40">
                        <div className="space-y-2">
                          <div className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                            <Info className="h-3.5 w-3.5" />
                            Configuration Metadata Payload:
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
          ) : (
            <div className="py-16 text-center space-y-3">
              <div className="mx-auto w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-foreground">No Logs Found</h3>
                <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                  {search ? "No administrative logs matched your active search filters." : "No setup changes have been recorded in this tenant yet."}
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
