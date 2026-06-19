import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, Search, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { settingsApi } from '@/api/settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

const STATUS_COLORS: Record<string, string> = { pending: 'bg-amber-100 text-amber-700', approved: 'bg-emerald-100 text-emerald-700', rejected: 'bg-red-100 text-red-700' };

function LeaveForm({ onSuccess }: { onSuccess: () => void }) {
  const qc = useQueryClient();
  const [employeeId, setEmployeeId] = useState(''); const [leaveTypeId, setLeaveTypeId] = useState(''); const [fromDate, setFromDate] = useState(''); const [toDate, setToDate] = useState(''); const [reason, setReason] = useState('');
  const { data: employees } = useQuery({ queryKey: ['employees'], queryFn: () => settingsApi.employees.list() });
  const { data: leaveTypes } = useQuery({ queryKey: ['leave-types'], queryFn: () => settingsApi.leaveTypes.list() });
  const mutation = useMutation({
    mutationFn: (data: any) => settingsApi.leaveRequests.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-requests'] }); toast.success('Leave request created'); onSuccess(); },
  });
  return (<form onSubmit={(e) => { e.preventDefault(); mutation.mutate({ employee_id: employeeId, leave_type_id: leaveTypeId, from_date: fromDate, to_date: toDate, reason }); }} className="space-y-4">
    <div className="space-y-2"><Label>Employee</Label><select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"><option value="">Select</option>{employees?.data?.map((e: any) => <option key={e.id} value={e.id}>{e.employee_code} - {e.user?.name ?? ''}</option>)}</select></div>
    <div className="space-y-2"><Label>Leave Type</Label><select value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)} required className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"><option value="">Select</option>{leaveTypes?.data?.map((l: any) => <option key={l.id} value={l.id}>{l.name} ({l.days_per_year} days)</option>)}</select></div>
    <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>From</Label><Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} required /></div><div className="space-y-2"><Label>To</Label><Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} required /></div></div>
    <div className="space-y-2"><Label>Reason</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} /></div>
    <Button type="submit" className="w-full" disabled={mutation.isPending}>Submit Request</Button>
  </form>);
}

export function LeaveRequestList() {
  const [open, setOpen] = useState(false); const [statusFilter, setStatusFilter] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['leave-requests', statusFilter], queryFn: () => settingsApi.leaveRequests.list({ status: statusFilter || undefined }) });
  const qc = useQueryClient();
  const approve = useMutation({ mutationFn: (id: string) => settingsApi.leaveRequests.approve(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-requests'] }); toast.success('Approved'); } });
  const reject = useMutation({ mutationFn: (id: string) => settingsApi.leaveRequests.reject(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-requests'] }); toast.success('Rejected'); } });

  return (<div className="space-y-6 p-6 max-w-[1200px]">
    <div className="flex items-center justify-between">
      <div><h1 className="text-2xl font-semibold tracking-tight">Leave Requests</h1><p className="text-sm text-muted-foreground mt-0.5">Manage employee leave</p></div>
      <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button className="gap-2"><Plus size={15} />New Leave Request</Button></DialogTrigger>
        <DialogContent><DialogHeader><DialogTitle>New Leave Request</DialogTitle></DialogHeader><LeaveForm onSuccess={() => setOpen(false)} /></DialogContent></Dialog>
    </div>
    <div className="flex items-center gap-3"><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"><option value="">All status</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></div>
    <Card><CardContent className="p-0"><Table>
      <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Leave Type</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead><TableHead className="w-20" /></TableRow></TableHeader>
      <TableBody>{isLoading ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
        : !data?.data?.length ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No leave requests</TableCell></TableRow>
        : data.data.map((lr: any) => (<TableRow key={lr.id}>
          <TableCell className="font-medium">{lr.employee?.user?.name ?? lr.employee_id}</TableCell>
          <TableCell>{lr.leaveType?.name ?? '-'}</TableCell>
          <TableCell className="text-sm">{new Date(lr.from_date).toLocaleDateString()}</TableCell>
          <TableCell className="text-sm">{new Date(lr.to_date).toLocaleDateString()}</TableCell>
          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{lr.reason ?? '-'}</TableCell>
          <TableCell><Badge variant="outline" className={`capitalize ${STATUS_COLORS[lr.status] ?? ''}`}>{lr.status}</Badge></TableCell>
          <TableCell>{lr.status === 'pending' ? <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="text-emerald-600" onClick={() => approve.mutate(lr.id)}><Check size={14} /></Button>
            <Button variant="ghost" size="icon" className="text-red-600" onClick={() => reject.mutate(lr.id)}><X size={14} /></Button>
          </div> : '-'}</TableCell>
        </TableRow>))}</TableBody>
    </Table></CardContent></Card>
  </div>);
}
