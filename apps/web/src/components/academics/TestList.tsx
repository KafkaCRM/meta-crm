import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, MoreHorizontal, Pencil, Trash2, ClipboardList } from 'lucide-react';
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

function TestForm({ test, onSuccess }: { test?: any; onSuccess: () => void }) {
  const qc = useQueryClient();
  const { data: courses } = useQuery({ queryKey: ['courses'], queryFn: () => settingsApi.courses.list({ status: 'active' }) });
  const [courseId, setCourseId] = useState(test?.course_id ?? '');
  const [name, setName] = useState(test?.name ?? '');
  const [type, setType] = useState(test?.type ?? 'exam');
  const [maxMarks, setMaxMarks] = useState(test?.max_marks ?? '');
  const [heldOn, setHeldOn] = useState(test?.held_on?.slice(0, 10) ?? '');

  const mutation = useMutation({
    mutationFn: (data: any) => test ? settingsApi.tests.update(test.id, data) : settingsApi.tests.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tests'] }); toast.success(test ? 'Test updated' : 'Test created'); onSuccess(); },
    onError: () => toast.error('Failed to save test'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({ course_id: courseId, name, type, max_marks: Number(maxMarks), held_on: heldOn || undefined });
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
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Test Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="exam">Exam</SelectItem>
              <SelectItem value="quiz">Quiz</SelectItem>
              <SelectItem value="mock">Mock Test</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Max Marks</Label><Input type="number" value={maxMarks} onChange={(e) => setMaxMarks(e.target.value)} required /></div>
        <div className="space-y-2"><Label>Date</Label><Input type="date" value={heldOn} onChange={(e) => setHeldOn(e.target.value)} /></div>
      </div>
      <Button type="submit" className="w-full" disabled={mutation.isPending}>{test ? 'Update' : 'Create'} Test</Button>
    </form>
  );
}

export function TestList() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const { data, isLoading } = useQuery({ queryKey: ['tests'], queryFn: () => settingsApi.tests.list() });
  const qc = useQueryClient();
  const removeMutation = useMutation({
    mutationFn: (id: string) => settingsApi.tests.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tests'] }); toast.success('Test deleted'); },
    onError: () => toast.error('Failed to delete test'),
  });

  return (
    <div className="space-y-6 p-6 max-w-[1200px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tests & Exams</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Create tests and record scores</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild><Button className="gap-2"><Plus size={15} />Add Test</Button></DialogTrigger>
          <DialogContent><DialogHeader><DialogTitle>{editing ? 'Edit Test' : 'Add Test'}</DialogTitle></DialogHeader><TestForm test={editing} onSuccess={() => { setOpen(false); setEditing(null); }} /></DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Max Marks</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Scores</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              : !data?.data?.length ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No tests yet</TableCell></TableRow>
              : data.data.map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>{t.course?.name}</TableCell>
                  <TableCell className="capitalize"><Badge variant="outline">{t.type}</Badge></TableCell>
                  <TableCell>{t.max_marks}</TableCell>
                  <TableCell>{t.held_on ? new Date(t.held_on).toLocaleDateString() : '-'}</TableCell>
                  <TableCell>{t._count?.scores ?? 0}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal size={14} /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditing(t); setOpen(true); }}><Pencil size={13} className="mr-2" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => removeMutation.mutate(t.id)}><Trash2 size={13} className="mr-2" /> Delete</DropdownMenuItem>
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
