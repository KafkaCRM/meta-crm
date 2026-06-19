import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, MoreHorizontal, Pencil, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { settingsApi } from '@/api/settings';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STATUS_OPTIONS = ['upcoming', 'active', 'completed', 'cancelled'];

function BatchForm({ batch, onSuccess }: { batch?: any; onSuccess: () => void }) {
  const queryClient = useQueryClient();
  const { data: coursesData } = useQuery({
    queryKey: ['courses'],
    queryFn: () => settingsApi.courses.list({ status: 'active' }),
  });

  const [courseId, setCourseId] = useState(batch?.course_id ?? '');
  const [name, setName] = useState(batch?.name ?? '');
  const [code, setCode] = useState(batch?.code ?? '');
  const [room, setRoom] = useState(batch?.room ?? '');
  const [capacity, setCapacity] = useState(batch?.capacity ?? '');
  const [startDate, setStartDate] = useState(batch?.start_date?.slice(0, 10) ?? '');
  const [endDate, setEndDate] = useState(batch?.end_date?.slice(0, 10) ?? '');
  const [status, setStatus] = useState(batch?.status ?? 'upcoming');

  const mutation = useMutation({
    mutationFn: (data: any) =>
      batch ? settingsApi.batches.update(batch.id, data) : settingsApi.batches.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      toast.success(batch ? 'Batch updated' : 'Batch created');
      onSuccess();
    },
    onError: () => toast.error('Failed to save batch'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      course_id: courseId, name, code, room,
      capacity: capacity ? Number(capacity) : undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      status,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Course</Label>
        <Select value={courseId} onValueChange={setCourseId} required>
          <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
          <SelectContent>
            {coursesData?.data?.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Batch Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. IELTS Morning A1" />
        </div>
        <div className="space-y-2">
          <Label>Code</Label>
          <Input value={code} onChange={(e) => setCode(e.target.value)} required placeholder="e.g. B-001" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Room</Label>
          <Input value={room} onChange={(e) => setRoom(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Capacity</Label>
          <Input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Start Date</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>End Date</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Status</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (<SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" className="w-full" disabled={mutation.isPending}>
        {batch ? 'Update Batch' : 'Create Batch'}
      </Button>
    </form>
  );
}

export function BatchList() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['batches'],
    queryFn: () => settingsApi.batches.list(),
  });

  const queryClient = useQueryClient();
  const removeMutation = useMutation({
    mutationFn: (id: string) => settingsApi.batches.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      toast.success('Batch deleted');
    },
    onError: () => toast.error('Failed to delete batch'),
  });

  return (
    <div className="space-y-6 p-6 max-w-[1200px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Batches</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage course batches and scheduling</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus size={15} />Add Batch</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit Batch' : 'Add Batch'}</DialogTitle>
            </DialogHeader>
            <BatchForm batch={editing} onSuccess={() => { setOpen(false); setEditing(null); }} />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Enrolled</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
              ) : data?.data?.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No batches yet</TableCell></TableRow>
              ) : data?.data?.map((batch: any) => (
                <TableRow key={batch.id}>
                  <TableCell className="font-medium">{batch.name}</TableCell>
                  <TableCell>{batch.course?.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {batch.start_date ? new Date(batch.start_date).toLocaleDateString() : '-'}
                    {batch.end_date ? ` — ${new Date(batch.end_date).toLocaleDateString()}` : ''}
                  </TableCell>
                  <TableCell>{batch.capacity ?? '-'}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5">
                      <Users size={13} className="text-muted-foreground" />
                      {batch._count?.enrollments ?? 0}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={batch.status === 'active' ? 'default' : batch.status === 'completed' ? 'secondary' : 'outline'} className="capitalize">
                      {batch.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal size={14} /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditing(batch); setOpen(true); }}>
                          <Pencil size={13} className="mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => removeMutation.mutate(batch.id)}>
                          <Trash2 size={13} className="mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
