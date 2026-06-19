import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { settingsApi } from '@/api/settings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

const STATUS_OPTIONS = ['present', 'absent', 'late', 'leave'];
const STATUS_COLORS: Record<string, string> = {
  present: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
  absent: 'bg-red-100 text-red-700 hover:bg-red-200',
  late: 'bg-amber-100 text-amber-700 hover:bg-amber-200',
  leave: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
};

export function AttendanceSheet() {
  const queryClient = useQueryClient();
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [pendingChanges, setPendingChanges] = useState<Map<string, string>>(new Map());

  const { data: batchesData } = useQuery({
    queryKey: ['batches'],
    queryFn: () => settingsApi.batches.list({ status: 'active' }),
  });

  const { data: batchDetail } = useQuery({
    queryKey: ['batch', selectedBatchId],
    queryFn: () => settingsApi.batches.get(selectedBatchId),
    enabled: !!selectedBatchId,
  });

  const { data: attendanceData, refetch: refetchAttendance } = useQuery({
    queryKey: ['attendance', selectedBatchId, selectedDate],
    queryFn: () => settingsApi.attendance.list({ batch_id: selectedBatchId, date: selectedDate }),
    enabled: !!selectedBatchId && !!selectedDate,
  });

  const markMutation = useMutation<any, Error, { enrollment_id: string; status: string }>({
    mutationFn: (data) =>
      settingsApi.attendance.mark({
        batch_id: selectedBatchId,
        enrollment_id: data.enrollment_id,
        date: selectedDate,
        status: data.status,
      }),
    onSuccess: () => {
      refetchAttendance();
      toast.success('Attendance marked');
    },
    onError: () => toast.error('Failed to mark attendance'),
  });

  const bulkSaveMutation = useMutation({
    mutationFn: (records: { enrollment_id: string; status: string }[]) =>
      settingsApi.attendance.bulkMark({
        batch_id: selectedBatchId,
        date: selectedDate,
        records,
      }),
    onSuccess: () => {
      refetchAttendance();
      setPendingChanges(new Map());
      toast.success('All attendance saved');
    },
    onError: () => toast.error('Failed to save attendance'),
  });

  const getAttendanceFor = (enrollmentId: string): string | undefined => {
    if (pendingChanges.has(enrollmentId)) return pendingChanges.get(enrollmentId);
    const record = attendanceData?.find((a: any) => a.enrollment_id === enrollmentId);
    return record?.status;
  };

  const handleStatusClick = (enrollmentId: string, currentStatus: string | undefined) => {
    const idx = currentStatus ? STATUS_OPTIONS.indexOf(currentStatus) : -1;
    const nextStatus = STATUS_OPTIONS[(idx + 1) % STATUS_OPTIONS.length];
    markMutation.mutate({ enrollment_id: enrollmentId, status: nextStatus! });
  };

  const setAllStatus = (status: string) => {
    const enrollments = batchDetail?.enrollments?.filter((e: any) => e.status === 'active') ?? [];
    bulkSaveMutation.mutate(enrollments.map((e: any) => ({ enrollment_id: e.id, status })));
  };

  const activeEnrollments = batchDetail?.enrollments?.filter((e: any) => e.status === 'active') ?? [];

  return (
    <div className="space-y-6 p-6 max-w-[1200px]">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Attendance</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Mark daily attendance by batch</p>
      </div>

      <div className="flex items-end gap-4 flex-wrap">
        <div className="space-y-2">
          <Label>Batch</Label>
          <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
            <SelectTrigger className="w-72"><SelectValue placeholder="Select active batch" /></SelectTrigger>
            <SelectContent>
              {batchesData?.data?.map((b: any) => (
                <SelectItem key={b.id} value={b.id}>{b.name} — {b.course?.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Date</Label>
          <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setAllStatus('present')}>Mark All Present</Button>
          <Button variant="outline" size="sm" onClick={() => setAllStatus('absent')}>Mark All Absent</Button>
        </div>
      </div>

      {selectedBatchId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {batchDetail?.name} — {new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeEnrollments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No active students in this batch</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {activeEnrollments.map((enrollment: any) => {
                  const currentStatus = getAttendanceFor(enrollment.id);
                  return (
                    <button
                      key={enrollment.id}
                      onClick={() => handleStatusClick(enrollment.id, currentStatus)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all hover:shadow-sm ${
                        currentStatus
                          ? 'border-transparent shadow-sm'
                          : 'border-dashed border-muted-foreground/30'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                        {enrollment.party?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-xs font-medium text-center leading-tight line-clamp-2">
                        {enrollment.party?.name}
                      </span>
                      {enrollment.roll_number && (
                        <span className="text-[10px] text-muted-foreground">#{enrollment.roll_number}</span>
                      )}
                      {currentStatus && (
                        <Badge className={`text-[10px] px-2 py-0 ${STATUS_COLORS[currentStatus]}`}>
                          {currentStatus}
                        </Badge>
                      )}
                      {!currentStatus && (
                        <span className="text-[10px] text-muted-foreground">Tap to mark</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
