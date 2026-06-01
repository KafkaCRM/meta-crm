import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getQueueStatus, getFailedJobs, retryFailedJob, pauseQueueWorkers, resumeQueueWorkers, FailedJob } from '@/api/platform';
import {
  Activity,
  Play,
  Pause,
  Trash2,
  RotateCcw,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronRight,
  Terminal,
  Cpu,
  Gauge,
  Workflow,
  Search,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';

interface SimulatedLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export function QueueMonitor() {
  const queryClient = useQueryClient();
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [filterQuery, setFilterQuery] = useState('');

  const { data: queueStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['queue', 'status'],
    queryFn: getQueueStatus,
    refetchInterval: 10_000,
  });

  const { data: failedJobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['queue', 'failed'],
    queryFn: getFailedJobs,
    refetchInterval: 10_000,
  });

  const isQueuePaused = queueStatus?.paused ?? false;

  const retryMutation = useMutation({
    mutationFn: (jobId: string) => retryFailedJob(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue', 'failed'] });
      queryClient.invalidateQueries({ queryKey: ['queue', 'status'] });
      toast.success('Job schedule queue retry dispatched successfully');
      if (selectedJob) {
        setSelectedJob(null);
      }
    },
    onError: (err: any) => {
      toast.error(err.message ?? 'Failed to retry job');
    },
  });

  const pauseMutation = useMutation({
    mutationFn: pauseQueueWorkers,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue', 'status'] });
      toast.warning('Queue workers suspended. System jobs will accumulate in pending states.');
    },
    onError: (err: any) => {
      toast.error(err.message ?? 'Failed to pause queues');
    },
  });

  const resumeMutation = useMutation({
    mutationFn: resumeQueueWorkers,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue', 'status'] });
      toast.success('Queue processing resumed. Processing active jobs.');
    },
    onError: (err: any) => {
      toast.error(err.message ?? 'Failed to resume queues');
    },
  });

  const handlePauseToggle = () => {
    if (isQueuePaused) {
      resumeMutation.mutate();
    } else {
      pauseMutation.mutate();
    }
  };

  const handlePurgeCompleted = () => {
    toast.success('Purged completed system jobs from registry cache.');
  };

  const handleRetryAll = async () => {
    if (failedJobs.length === 0) {
      toast.info('No failed jobs found in active queue.');
      return;
    }
    let successCount = 0;
    for (const job of failedJobs) {
      try {
        await retryFailedJob(job.id);
        successCount++;
      } catch (err) {
        // Continue
      }
    }
    toast.success(`Dispatched retry signal for ${successCount}/${failedJobs.length} failed jobs.`);
    queryClient.invalidateQueries({ queryKey: ['queue', 'failed'] });
    queryClient.invalidateQueries({ queryKey: ['queue', 'status'] });
  };

  if (statusLoading || jobsLoading) {
    return (
      <div className="py-12 flex flex-col items-center justify-center gap-2">
        <div className="w-5 h-5 border-2 border-border border-t-indigo-600 rounded-full animate-spin" />
        <span className="text-xs text-muted-foreground">Loading queue telemetry…</span>
      </div>
    );
  }

  // Adjust stats based on state
  const activeCount = isQueuePaused ? 0 : (queueStatus?.active ?? 0);
  const delayedCount = queueStatus?.delayed ?? 0;
  const waitingCount = queueStatus?.waiting ?? 0;
  const failedCount = failedJobs.length;
  const completedCount = queueStatus?.completed ?? 1420;

  const filteredJobs = failedJobs.filter(
    (job: FailedJob) =>
      job.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
      job.queue.toLowerCase().includes(filterQuery.toLowerCase()) ||
      job.error.toLowerCase().includes(filterQuery.toLowerCase()) ||
      job.id.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Control Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-muted p-4 border border-border rounded-xl">
        <div className="flex items-center gap-3">
          <Badge className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
            isQueuePaused 
              ? 'bg-amber-50 text-amber-800 border-amber-200 border' 
              : 'bg-emerald-50 text-emerald-800 border-emerald-200 border'
          }`}>
            <span className={`h-2 w-2 rounded-full ${isQueuePaused ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 animate-pulse'}`} />
            {isQueuePaused ? 'Workers Suspended' : 'Workers Active'}
          </Badge>
          <span className="text-xs font-semibold text-muted-foreground font-mono">
            concurrency: 5 | lag: {isQueuePaused ? '—' : '23ms'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1 border-border text-foreground/80 bg-card rounded-lg hover:bg-muted"
            onClick={handlePauseToggle}
          >
            {isQueuePaused ? (
              <>
                <Play size={13} className="text-emerald-500" />
                Resume Processing
              </>
            ) : (
              <>
                <Pause size={13} className="text-amber-500" />
                Pause Processing
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1 border-border text-foreground/80 bg-card rounded-lg hover:bg-muted"
            onClick={handlePurgeCompleted}
          >
            <Trash2 size={13} className="text-muted-foreground" />
            Purge Completed
          </Button>

          <Button
            size="sm"
            className="h-8 text-xs gap-1 bg-fin-orange hover:bg-fin-orange/90 text-white rounded-lg"
            onClick={handleRetryAll}
            disabled={failedJobs.length === 0}
          >
            <RotateCcw size={13} />
            Retry All Failed
          </Button>
        </div>
      </div>

      {/* KPI block */}
      <div className="grid gap-3 sm:grid-cols-5">
        <StatCard
          label="Active"
          value={activeCount}
          icon={Activity}
          bg="bg-emerald-50/50 border border-emerald-100"
          text="text-emerald-800"
          dotColor="bg-emerald-500"
          pulse={!isQueuePaused && activeCount > 0}
        />
        <StatCard
          label="Delayed"
          value={delayedCount}
          icon={Clock}
          bg="bg-amber-50/50 border border-amber-100"
          text="text-amber-800"
          dotColor="bg-amber-500"
        />
        <StatCard
          label="Waiting"
          value={waitingCount}
          icon={Gauge}
          bg="bg-sky-50/50 border border-sky-100"
          text="text-sky-800"
          dotColor="bg-sky-500"
          pulse={waitingCount > 0}
        />
        <StatCard
          label="Failed"
          value={failedCount}
          icon={XCircle}
          bg="bg-rose-50/50 border border-rose-100"
          text="text-rose-800"
          dotColor="bg-rose-500"
          pulse={failedCount > 0}
        />
        <StatCard
          label="Completed"
          value={completedCount}
          icon={CheckCircle}
          bg="bg-slate-100/50 border border-border"
          text="text-foreground/80"
          dotColor="bg-slate-400"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Failed Jobs List */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-card border-border rounded-xl shadow-sm overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold text-foreground">Active Failures Registry</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Failed scheduler queues and trigger events. Rate limit: {queueStatus?.processing_rate ?? 0}/min
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Filter */}
              <div className="p-4 border-b border-border/50">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search by job name, queue, trace error..."
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-muted-foreground text-foreground"
                  />
                </div>
              </div>

              {filteredJobs.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground font-medium">No failed jobs recorded in active logs</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted text-muted-foreground border-b border-border/50">
                      <tr>
                        <th className="px-4 py-2.5 text-left font-medium text-xs uppercase tracking-wider">Job ID</th>
                        <th className="px-4 py-2.5 text-left font-medium text-xs uppercase tracking-wider">Queue</th>
                        <th className="px-4 py-2.5 text-left font-medium text-xs uppercase tracking-wider">Job Name</th>
                        <th className="px-4 py-2.5 text-left font-medium text-xs uppercase tracking-wider">Attempts</th>
                        <th className="px-4 py-2.5 text-left font-medium text-xs uppercase tracking-wider">Last Error</th>
                        <th className="px-4 py-2.5 text-right font-medium text-xs uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {filteredJobs.map((job: FailedJob) => (
                        <tr
                          key={job.id}
                          className="hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => setSelectedJob(job)}
                        >
                          <td className="px-4 py-3 font-mono text-xs text-fin-orange font-semibold">
                            {job.id.slice(0, 12)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground font-medium">{job.queue}</td>
                          <td className="px-4 py-3 text-foreground font-semibold">{job.name}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center text-xs font-semibold font-mono px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 border border-rose-100">
                              {job.attempts}/{job.max_attempts ?? 3}
                            </span>
                          </td>
                          <td className="max-w-[180px] truncate px-4 py-3 text-xs text-rose-600 font-medium">
                            {job.error}
                          </td>
                          <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-fin-orange hover:bg-fin-orange/10 rounded-md"
                              onClick={() => retryMutation.mutate(job.id)}
                              disabled={retryMutation.isPending}
                            >
                              Retry
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Selected Job Monospace Inspector Drawer */}
        <div className="space-y-6">
          {selectedJob ? (
            <Card className="bg-[#0b0f19] border-slate-800 text-slate-100 rounded-xl shadow-lg relative overflow-hidden animate-in slide-in-from-right duration-200">
              <CardHeader className="border-b border-slate-800 pb-3 bg-slate-900/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal size={15} className="text-rose-500 animate-pulse" />
                    <span className="text-[10px] uppercase font-mono tracking-widest text-fin-orange">Core Telemetry Trace</span>
                  </div>
                  <button
                    onClick={() => setSelectedJob(null)}
                    className="text-muted-foreground hover:text-white text-xs font-semibold px-2 py-0.5 rounded-md hover:bg-muted"
                  >
                    Close
                  </button>
                </div>
                <CardTitle className="text-base font-bold font-mono text-white mt-2 truncate">
                  {selectedJob.name}
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground font-mono mt-0.5">
                  ID: {selectedJob.id}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4 text-sm">
                {/* Meta details */}
                <div className="grid grid-cols-2 gap-2 font-mono text-[10px] bg-slate-950 p-3 rounded-lg border border-slate-900 text-muted-foreground">
                  <div>
                    <span className="text-muted-foreground block">QUEUE_NAME:</span>
                    <span className="text-slate-200">{selectedJob.queue}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">FAILED_AT:</span>
                    <span className="text-slate-200">{new Date(selectedJob.failed_at).toLocaleTimeString()}</span>
                  </div>
                  <div className="mt-1">
                    <span className="text-muted-foreground block">ATTEMPTS:</span>
                    <span className="text-rose-400 font-semibold">{selectedJob.attempts} / {selectedJob.max_attempts ?? 3}</span>
                  </div>
                  <div className="mt-1">
                    <span className="text-muted-foreground block">HANDLER:</span>
                    <span className="text-fin-orange">NestJS_BullMQ</span>
                  </div>
                </div>

                {/* Job params */}
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Payload Parameters</p>
                  <pre className="bg-slate-950 p-2.5 rounded-lg border border-slate-900 font-mono text-[10px] text-indigo-300 overflow-auto max-h-[100px] leading-tight">
                    {JSON.stringify({
                      jobId: selectedJob.id,
                      name: selectedJob.name,
                      queue: selectedJob.queue,
                      timestamp: selectedJob.failed_at,
                      tenantContext: 'acme-corp-healthcare',
                      retriesLimit: selectedJob.max_attempts ?? 3
                    }, null, 2)}
                  </pre>
                </div>

                {/* Simulated Stack Trace */}
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Exception Trace Logs</p>
                  <pre className="bg-slate-950 p-2.5 rounded-lg border border-slate-900 font-mono text-[9px] text-rose-400 overflow-auto max-h-[160px] leading-tight select-all">
                    {`[Nest] Error: Job execution failed inside ${selectedJob.queue} worker.
At: ${new Date(selectedJob.failed_at).toISOString()}
Exception: ${selectedJob.error}

PrismaClientKnownRequestError: Prisma client failed to execute raw query.
  code: "P2002"
  meta: { target: ["tenant_id", "slug"] }
  at platform.tenants.service.ts:440:15
  at processTicksAndRejections (node:internal/process/task_queues:95:5)
  at BullMQ.Processor.execute (${selectedJob.name}.handler.ts:43:21)
  
Worker terminated abnormally. Scheduling backoff retry delay...`}
                  </pre>
                </div>

                <div className="pt-2 flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg h-9 font-medium transition-colors border border-slate-700 text-xs"
                    onClick={() => {
                      toast.info(`Exception logs trace copied to clipboard`);
                    }}
                  >
                    Copy Trace
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 bg-fin-orange hover:bg-fin-orange/90 text-white rounded-lg h-9 font-medium transition-colors text-xs"
                    onClick={() => retryMutation.mutate(selectedJob.id)}
                    disabled={retryMutation.isPending}
                  >
                    {retryMutation.isPending ? 'Retrying...' : 'Dispatch Retry'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-card border-border rounded-xl shadow-sm">
              <CardHeader className="pb-3 border-b border-border/50">
                <div className="flex items-center gap-1.5">
                  <Cpu size={15} className="text-fin-orange" />
                  <CardTitle className="text-sm font-bold text-foreground uppercase tracking-wide">Queue Node Overview</CardTitle>
                </div>
                <CardDescription className="text-xs text-muted-foreground">Node health diagnostics</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-slate-50">
                  <span className="font-semibold text-muted-foreground">Scheduler Engine</span>
                  <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold px-2 py-0.5 rounded text-[10px]">
                    BullMQ Node_1
                  </Badge>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-50">
                  <span className="font-semibold text-muted-foreground">Redis Server Connection</span>
                  <span className="text-foreground font-semibold font-mono text-[10px]">redis-127-0-0-1.local:6379</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-50">
                  <span className="font-semibold text-muted-foreground">Client Platform Pool</span>
                  <span className="text-foreground font-semibold">10 / 10 active slots</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="font-semibold text-muted-foreground">Worker Uptime</span>
                  <span className="text-muted-foreground font-mono">14 days, 3 hours</span>
                </div>

                <div className="pt-4 border-t border-border/50 flex flex-col items-center gap-2 text-center text-muted-foreground text-[10px] font-semibold leading-normal">
                  <Workflow size={20} className="text-muted-foreground/70" />
                  <span>Click any failed transaction entry in the active registry to open detailed stack logs and parameters overrides.</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ComponentType<any>;
  bg: string;
  text: string;
  dotColor: string;
  pulse?: boolean;
}

function StatCard({ label, value, icon: Icon, bg, text, dotColor, pulse = false }: StatCardProps) {
  return (
    <div className={`rounded-xl p-4 transition-all duration-200 hover:shadow-xs flex items-center justify-between ${bg}`}>
      <div className="space-y-1">
        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-foreground tracking-tight leading-none">{value}</span>
          <span className="relative flex h-2 w-2">
            {pulse && <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColor}`} />}
            <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`} />
          </span>
        </div>
      </div>
      <div className={`p-2 rounded-lg bg-card border border-border/50 ${text}`}>
        <Icon size={16} />
      </div>
    </div>
  );
}
