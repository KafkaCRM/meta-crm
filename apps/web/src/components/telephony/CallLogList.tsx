import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Search, Phone, PhoneIncoming, PhoneOutgoing, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { settingsApi } from '@/api/settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  busy: 'bg-amber-100 text-amber-700 border-amber-200',
  'no-answer': 'bg-slate-100 text-slate-700 border-slate-200',
  failed: 'bg-red-100 text-red-700 border-red-200',
  ringing: 'bg-blue-100 text-blue-700 border-blue-200',
  'in-progress': 'bg-blue-100 text-blue-700 border-blue-200',
};

export function CallLogList() {
  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['call-logs', search, direction],
    queryFn: () => settingsApi.callLogs.list({ direction: direction || undefined }),
  });

  const queryClient = useQueryClient();
  const removeMutation = useMutation({
    mutationFn: (id: string) => settingsApi.callLogs.remove(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['call-logs'] }); toast.success('Call log deleted'); },
    onError: () => toast.error('Failed to delete call log'),
  });

  return (
    <div className="space-y-6 p-6 max-w-[1200px]">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Call Logs</h1>
        <p className="text-sm text-muted-foreground mt-0.5">View inbound and outbound call history</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 max-w-sm flex-1">
          <Search size={16} className="text-muted-foreground" />
          <Input placeholder="Search by number..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select value={direction} onChange={(e) => setDirection(e.target.value)}
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
          <option value="">All calls</option>
          <option value="inbound">Inbound</option>
          <option value="outbound">Outbound</option>
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Direction</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
              ) : !data?.data?.length ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No call logs yet</TableCell></TableRow>
              ) : data.data.map((call: any) => (
                <TableRow key={call.id}>
                  <TableCell>
                    {call.direction === 'inbound' ? (
                      <span className="flex items-center gap-1.5 text-emerald-600"><PhoneIncoming size={14} /> Inbound</span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-blue-600"><PhoneOutgoing size={14} /> Outbound</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{call.from_number}</TableCell>
                  <TableCell className="font-mono text-sm">{call.to_number}</TableCell>
                  <TableCell>{call.party?.name ?? call.lead?.name ?? '-'}</TableCell>
                  <TableCell>
                    {call.duration_secs != null
                      ? `${Math.floor(call.duration_secs / 60)}:${String(call.duration_secs % 60).padStart(2, '0')}`
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`capitalize ${STATUS_COLORS[call.status] ?? ''}`}>{call.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(call.started_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => removeMutation.mutate(call.id)}>
                      <Trash2 size={14} className="text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
