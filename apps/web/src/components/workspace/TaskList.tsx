import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { settingsApi } from '@/api/settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

const STATUS_COLORS: Record<string, string> = { todo: 'bg-slate-100 text-slate-600', in_progress: 'bg-blue-100 text-blue-700', done: 'bg-emerald-100 text-emerald-700' };
const PRIORITY_COLORS: Record<string, string> = { low: 'bg-slate-100 text-slate-500', medium: 'bg-amber-100 text-amber-700', high: 'bg-orange-100 text-orange-700', urgent: 'bg-red-100 text-red-700' };

function TaskForm({ onSuccess }: { onSuccess: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(''); const [description, setDescription] = useState(''); const [priority, setPriority] = useState('medium'); const [dueDate, setDueDate] = useState(''); const [assigneeId, setAssigneeId] = useState('');
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => settingsApi.users.list() });
  const mutation = useMutation({
    mutationFn: (data: any) => settingsApi.tasks.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); toast.success('Task created'); onSuccess(); },
  });
  return (<form onSubmit={(e) => { e.preventDefault(); mutation.mutate({ title, description, priority, due_date: dueDate || undefined, assignee_id: assigneeId || undefined }); }} className="space-y-4">
    <div className="space-y-2"><Label>Title *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
    <div className="space-y-2"><Label>Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
    <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Priority</Label><select value={priority} onChange={(e) => setPriority(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>
      <div className="space-y-2"><Label>Due Date</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div></div>
    <div className="space-y-2"><Label>Assignee</Label><select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"><option value="">Unassigned</option>{users?.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
    <Button type="submit" className="w-full" disabled={mutation.isPending}>Create Task</Button>
  </form>);
}

export function TaskList() {
  const [open, setOpen] = useState(false); const [filter, setFilter] = useState(''); const [search, setSearch] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['tasks', filter, search], queryFn: () => settingsApi.tasks.list({ status: filter || undefined, search: search || undefined }) });
  const qc = useQueryClient();
  const removeMut = useMutation({ mutationFn: (id: string) => settingsApi.tasks.remove(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); toast.success('Task deleted'); } });
  const statusMut = useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) => settingsApi.tasks.update(id, { status }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); } });

  return (<div className="space-y-6 p-6 max-w-[1200px]">
    <div className="flex items-center justify-between">
      <div><h1 className="text-2xl font-semibold tracking-tight">Tasks</h1><p className="text-sm text-muted-foreground mt-0.5">Manage workspace tasks</p></div>
      <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button className="gap-2"><Plus size={15} />New Task</Button></DialogTrigger>
        <DialogContent><DialogHeader><DialogTitle>New Task</DialogTitle></DialogHeader><TaskForm onSuccess={() => setOpen(false)} /></DialogContent></Dialog>
    </div>
    <div className="flex items-center gap-3">
      <div className="relative flex-1 max-w-sm"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search tasks..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" /></div>
      <select value={filter} onChange={(e) => setFilter(e.target.value)} className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"><option value="">All status</option><option value="todo">To Do</option><option value="in_progress">In Progress</option><option value="done">Done</option></select>
    </div>
    <Card><CardContent className="p-0"><Table>
      <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead><TableHead>Assignee</TableHead><TableHead>Due Date</TableHead><TableHead className="w-16" /></TableRow></TableHeader>
      <TableBody>{isLoading ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
        : !data?.data?.length ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No tasks</TableCell></TableRow>
        : data.data.map((t: any) => (<TableRow key={t.id}>
          <TableCell className="font-medium max-w-[250px] truncate">{t.title}</TableCell>
          <TableCell><Badge variant="outline" className={`capitalize ${PRIORITY_COLORS[t.priority] ?? ''}`}>{t.priority}</Badge></TableCell>
          <TableCell><select value={t.status} onChange={(e) => statusMut.mutate({ id: t.id, status: e.target.value })} className="flex h-7 rounded-md border border-input bg-transparent px-2 py-0 text-xs"><option value="todo">To Do</option><option value="in_progress">In Progress</option><option value="done">Done</option></select></TableCell>
          <TableCell className="text-sm text-muted-foreground">{t.assignee?.name ?? '-'}</TableCell>
          <TableCell className="text-sm">{t.due_date ? new Date(t.due_date).toLocaleDateString() : '-'}</TableCell>
          <TableCell><Button variant="ghost" size="icon" onClick={() => removeMut.mutate(t.id)} className="text-red-500"><Trash2 size={14} /></Button></TableCell>
        </TableRow>))}</TableBody>
    </Table></CardContent></Card>
  </div>);
}
