import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, MoreHorizontal, Eye, ArrowRightFromLine, XCircle, User, BookOpen, Hash, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { settingsApi } from '@/api/settings';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  dropped: 'bg-rose-50 text-rose-700 border-rose-200',
  completed: 'bg-blue-50 text-blue-700 border-blue-200',
};

function EnrollmentForm({ onSuccess }: { onSuccess: () => void }) {
  const qc = useQueryClient();
  const { data: courses } = useQuery({ queryKey: ['courses'], queryFn: () => settingsApi.courses.list({ status: 'active' }) });
  const { data: batches } = useQuery({ queryKey: ['batches'], queryFn: () => settingsApi.batches.list() });
  const [partyId, setPartyId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');

  const mutation = useMutation({
    mutationFn: (data: any) => settingsApi.enrollments.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['enrollments'] }); toast.success('Student enrolled'); onSuccess(); },
    onError: () => toast.error('Failed to enroll'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({ party_id: partyId, course_id: courseId || undefined, batch_id: batchId || undefined, student_id: studentId || undefined, roll_number: rollNumber || undefined, parent_name: parentName || undefined, parent_phone: parentPhone || undefined });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2"><Label>Party ID</Label><Input value={partyId} onChange={(e) => setPartyId(e.target.value)} required placeholder="Party UUID" /></div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Course</Label><Select value={courseId} onValueChange={setCourseId}><SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger><SelectContent>{courses?.data?.map((c: any) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent></Select></div>
        <div className="space-y-2"><Label>Batch</Label><Select value={batchId} onValueChange={setBatchId}><SelectTrigger><SelectValue placeholder="Select batch" /></SelectTrigger><SelectContent>{batches?.data?.map((b: any) => (<SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>))}</SelectContent></Select></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Student ID</Label><Input value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="Optional" /></div>
        <div className="space-y-2"><Label>Roll Number</Label><Input value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} placeholder="Optional" /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Parent Name</Label><Input value={parentName} onChange={(e) => setParentName(e.target.value)} placeholder="Optional" /></div>
        <div className="space-y-2"><Label>Parent Phone</Label><Input value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} placeholder="Optional" /></div>
      </div>
      <Button type="submit" className="w-full" disabled={mutation.isPending}>Enroll Student</Button>
    </form>
  );
}

function EnrollmentDetail({ enrollment, onClose }: { enrollment: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [transferBatchId, setTransferBatchId] = useState('');
  const { data: batches } = useQuery({ queryKey: ['batches'], queryFn: () => settingsApi.batches.list() });

  const transferMutation = useMutation({
    mutationFn: () => settingsApi.enrollments.transfer(enrollment.id, transferBatchId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['enrollments'] }); toast.success('Transferred'); onClose(); },
    onError: () => toast.error('Transfer failed'),
  });

  const withdrawMutation = useMutation({
    mutationFn: () => settingsApi.enrollments.withdraw(enrollment.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['enrollments'] }); toast.success('Withdrawn'); onClose(); },
    onError: () => toast.error('Withdraw failed'),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs text-muted-foreground">Student</Label><p className="font-semibold">{enrollment.party?.name ?? enrollment.student_id ?? '—'}</p></div>
        <div><Label className="text-xs text-muted-foreground">Roll No.</Label><p className="font-semibold">{enrollment.roll_number ?? '—'}</p></div>
        <div><Label className="text-xs text-muted-foreground">Course</Label><p>{enrollment.course?.name ?? '—'}</p></div>
        <div><Label className="text-xs text-muted-foreground">Batch</Label><p>{enrollment.batch?.name ?? '—'}</p></div>
        <div><Label className="text-xs text-muted-foreground">Status</Label><Badge variant="outline" className={STATUS_COLORS[enrollment.status] ?? ''}>{enrollment.status}</Badge></div>
        <div><Label className="text-xs text-muted-foreground">Enrolled On</Label><p>{new Date(enrollment.created_at).toLocaleDateString()}</p></div>
      </div>
      {(enrollment.parent_name || enrollment.parent_phone) && (
        <>
          <Separator />
          <div className="grid grid-cols-2 gap-3">
            {enrollment.parent_name && <div><Label className="text-xs text-muted-foreground">Parent</Label><p>{enrollment.parent_name}</p></div>}
            {enrollment.parent_phone && <div><Label className="text-xs text-muted-foreground">Parent Phone</Label><p>{enrollment.parent_phone}</p></div>}
          </div>
        </>
      )}
      {enrollment.status === 'active' && (
        <>
          <Separator />
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Transfer to Batch</Label>
              <div className="flex gap-2 mt-1">
                <Select value={transferBatchId} onValueChange={setTransferBatchId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Select batch" /></SelectTrigger>
                  <SelectContent>{batches?.data?.filter((b: any) => b.id !== enrollment.batch_id).map((b: any) => (<SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>))}</SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={() => transferMutation.mutate()} disabled={!transferBatchId || transferMutation.isPending}>Transfer</Button>
              </div>
            </div>
            <Button size="sm" variant="destructive" onClick={() => withdrawMutation.mutate()} disabled={withdrawMutation.isPending} className="w-full">Withdraw</Button>
          </div>
        </>
      )}
    </div>
  );
}

export function EnrollmentList() {
  const [open, setOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const { data, isLoading } = useQuery({ queryKey: ['enrollments'], queryFn: () => settingsApi.enrollments.list() });
  const qc = useQueryClient();

  return (
    <div className="space-y-6 p-6 max-w-[1200px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Enrollments</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage student enrollments across courses and batches</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-2"><Plus size={15} />Enroll Student</Button></DialogTrigger>
          <DialogContent><DialogHeader><DialogTitle>Enroll Student</DialogTitle></DialogHeader><EnrollmentForm onSuccess={() => setOpen(false)} /></DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Roll No</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Parent</TableHead>
                <TableHead>Enrolled</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              : !data?.data?.length ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No enrollments yet</TableCell></TableRow>
              : data.data.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium flex items-center gap-2"><User size={13} className="text-muted-foreground" />{e.party?.name ?? e.student_id ?? '—'}</TableCell>
                  <TableCell>{e.roll_number ?? '—'}</TableCell>
                  <TableCell>{e.course?.name ?? '—'}</TableCell>
                  <TableCell>{e.batch?.name ?? '—'}</TableCell>
                  <TableCell><Badge variant="outline" className={STATUS_COLORS[e.status] ?? ''}>{e.status}</Badge></TableCell>
                  <TableCell className="text-sm">{e.parent_name ?? (e.parent_phone ? <span className="flex items-center gap-1"><Phone size={11} />{e.parent_phone}</span> : '—')}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(e.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal size={14} /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setSelected(e); setDetailOpen(true); }}><Eye size={13} className="mr-2" /> View</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={detailOpen} onOpenChange={(v) => { setDetailOpen(v); if (!v) setSelected(null); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader><DialogTitle>Enrollment Details</DialogTitle></DialogHeader>
          {selected && <EnrollmentDetail enrollment={selected} onClose={() => { setDetailOpen(false); setSelected(null); }} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
