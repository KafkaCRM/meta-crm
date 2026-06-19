import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
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

function AssignmentForm({ assignment, onSuccess }: { assignment?: any; onSuccess: () => void }) {
  const qc = useQueryClient();
  const { data: courses } = useQuery({ queryKey: ['courses'], queryFn: () => settingsApi.courses.list({ status: 'active' }) });
  const [courseId, setCourseId] = useState(assignment?.course_id ?? '');
  const [title, setTitle] = useState(assignment?.title ?? '');
  const [description, setDescription] = useState(assignment?.description ?? '');
  const [maxMarks, setMaxMarks] = useState(assignment?.max_marks ?? '');
  const [dueDate, setDueDate] = useState(assignment?.due_date?.slice(0, 10) ?? '');

  const mutation = useMutation({
    mutationFn: (data: any) => assignment ? settingsApi.assignments.update(assignment.id, data) : settingsApi.assignments.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assignments'] }); toast.success(assignment ? 'Updated' : 'Created'); onSuccess(); },
    onError: () => toast.error('Failed to save'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({ course_id: courseId, title, description, max_marks: maxMarks ? Number(maxMarks) : undefined, due_date: dueDate || undefined });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Course</Label>
        <Select value={courseId} onValueChange={setCourseId} required>
          <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
          <SelectContent>{courses?.data?.map((c: any) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
      <div className="space-y-2"><Label>Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Max Marks</Label><Input type="number" value={maxMarks} onChange={(e) => setMaxMarks(e.target.value)} /></div>
        <div className="space-y-2"><Label>Due Date</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
      </div>
      <Button type="submit" className="w-full" disabled={mutation.isPending}>{assignment ? 'Update' : 'Create'} Assignment</Button>
    </form>
  );
}

export function AssignmentList() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const { data, isLoading } = useQuery({ queryKey: ['assignments'], queryFn: () => settingsApi.assignments.list() });
  const qc = useQueryClient();
  const removeMutation = useMutation({
    mutationFn: (id: string) => settingsApi.assignments.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assignments'] }); toast.success('Deleted'); },
    onError: () => toast.error('Failed to delete'),
  });

  return (
    <div className="space-y-6 p-6 max-w-[1200px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Assignments</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Create and manage assignments</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild><Button className="gap-2"><Plus size={15} />Add Assignment</Button></DialogTrigger>
          <DialogContent><DialogHeader><DialogTitle>{editing ? 'Edit' : 'New'} Assignment</DialogTitle></DialogHeader><AssignmentForm assignment={editing} onSuccess={() => { setOpen(false); setEditing(null); }} /></DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Max Marks</TableHead>
                <TableHead>Submissions</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              : !data?.data?.length ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No assignments yet</TableCell></TableRow>
              : data.data.map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.title}</TableCell>
                  <TableCell>{a.course?.name}</TableCell>
                  <TableCell>{a.due_date ? new Date(a.due_date).toLocaleDateString() : '-'}</TableCell>
                  <TableCell>{a.max_marks ?? '-'}</TableCell>
                  <TableCell>{a._count?.submissions ?? 0}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal size={14} /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditing(a); setOpen(true); }}><Pencil size={13} className="mr-2" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => removeMutation.mutate(a.id)}><Trash2 size={13} className="mr-2" /> Delete</DropdownMenuItem>
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
