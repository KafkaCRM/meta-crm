import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getQueueStatus, getFailedJobs, retryFailedJob } from '@/api/platform';

export function QueueMonitor() {
  const queryClient = useQueryClient();

  const { data: queueStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['queue', 'status'],
    queryFn: getQueueStatus,
    refetchInterval: 10_000,
  });

  const { data: failedJobs, isLoading: jobsLoading } = useQuery({
    queryKey: ['queue', 'failed'],
    queryFn: getFailedJobs,
    refetchInterval: 10_000,
  });

  const retryMutation = useMutation({
    mutationFn: (jobId: string) => retryFailedJob(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue', 'failed'] });
      queryClient.invalidateQueries({ queryKey: ['queue', 'status'] });
    },
  });

  if (statusLoading || jobsLoading) {
    return <div className="py-12 text-center">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-5">
        <StatCard label="Waiting" value={queueStatus?.waiting ?? 0} color="bg-blue-100 text-blue-800" />
        <StatCard label="Active" value={queueStatus?.active ?? 0} color="bg-green-100 text-green-800" />
        <StatCard label="Completed" value={queueStatus?.completed ?? 0} color="bg-gray-100 text-gray-800" />
        <StatCard label="Failed" value={queueStatus?.failed ?? 0} color="bg-red-100 text-red-800" />
        <StatCard label="Delayed" value={queueStatus?.delayed ?? 0} color="bg-yellow-100 text-yellow-800" />
      </div>

      <div className="rounded-lg bg-white p-6 shadow-md">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Failed Jobs</h3>
          <span className="text-sm text-gray-500">
            Processing rate: {queueStatus?.processing_rate ?? 0}/min
          </span>
        </div>

        {!failedJobs || failedJobs.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">No failed jobs</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">ID</th>
                  <th className="px-4 py-2 text-left font-medium">Queue</th>
                  <th className="px-4 py-2 text-left font-medium">Job</th>
                  <th className="px-4 py-2 text-left font-medium">Attempts</th>
                  <th className="px-4 py-2 text-left font-medium">Error</th>
                  <th className="px-4 py-2 text-left font-medium">Failed At</th>
                  <th className="px-4 py-2 text-left font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {failedJobs.map((job) => (
                  <tr key={job.id} className="border-t">
                    <td className="px-4 py-2 font-mono text-xs">{job.id.slice(0, 12)}</td>
                    <td className="px-4 py-2">{job.queue}</td>
                    <td className="px-4 py-2">{job.name}</td>
                    <td className="px-4 py-2">
                      {job.attempts}/{job.max_attempts}
                    </td>
                    <td className="max-w-xs truncate px-4 py-2 text-red-600" title={job.error}>
                      {job.error}
                    </td>
                    <td className="px-4 py-2">{new Date(job.failed_at).toLocaleString()}</td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => retryMutation.mutate(job.id)}
                        disabled={retryMutation.isPending}
                        className="rounded border border-blue-300 px-3 py-1 text-xs text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                      >
                        Retry
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-lg p-4 ${color}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm">{label}</div>
    </div>
  );
}
