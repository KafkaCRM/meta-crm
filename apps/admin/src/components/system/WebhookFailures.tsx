import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getWebhookFailures, retryWebhookFailure } from '@/api/platform';

export function WebhookFailures() {
  const queryClient = useQueryClient();

  const { data: failures, isLoading } = useQuery({
    queryKey: ['webhooks', 'failures'],
    queryFn: getWebhookFailures,
    refetchInterval: 15_000,
  });

  const retryMutation = useMutation({
    mutationFn: (failureId: string) => retryWebhookFailure(failureId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks', 'failures'] });
    },
  });

  if (isLoading) {
    return <div className="py-12 text-center">Loading...</div>;
  }

  if (!failures || failures.length === 0) {
    return (
      <div className="rounded-lg bg-white p-6 shadow-md">
        <p className="py-8 text-center text-sm text-gray-500">No webhook failures</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow-md">
      <h3 className="mb-4 text-lg font-semibold">Failed Webhook Deliveries</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-2 text-left font-medium">ID</th>
              <th className="px-4 py-2 text-left font-medium">Tenant ID</th>
              <th className="px-4 py-2 text-left font-medium">Event Type</th>
              <th className="px-4 py-2 text-left font-medium">Attempts</th>
              <th className="px-4 py-2 text-left font-medium">Last Error</th>
              <th className="px-4 py-2 text-left font-medium">Failed At</th>
              <th className="px-4 py-2 text-left font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {failures.map((failure) => (
              <tr key={failure.id} className="border-t">
                <td className="px-4 py-2 font-mono text-xs">{failure.id.slice(0, 12)}</td>
                <td className="px-4 py-2 font-mono text-xs">{failure.tenant_id.slice(0, 12)}</td>
                <td className="px-4 py-2">
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs">{failure.event_type}</span>
                </td>
                <td className="px-4 py-2">{failure.attempts}</td>
                <td className="max-w-xs truncate px-4 py-2 text-red-600" title={failure.last_error}>
                  {failure.last_error}
                </td>
                <td className="px-4 py-2">{new Date(failure.failed_at).toLocaleString()}</td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => retryMutation.mutate(failure.id)}
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
    </div>
  );
}
