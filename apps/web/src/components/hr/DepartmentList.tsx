import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { settingsApi } from '@/api/settings';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function DeptForm({ dept, onSuccess }: { dept?: any; onSuccess: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(dept?.name ?? '');
  const [description, setDescription] = useState(dept?.description ?? '');
  const mutation = useMutation({
    mutationFn: (data: any) => dept ? settingsApi.departments.update(dept.id, data) : settingsApi.departments.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departments'] }); toast.success(dept ? 'Updated' : 'Created'); onSuccess(); },
  });
  return (<form onSubmit={(e) => { e.preventDefault(); mutation.mutate({ name, description }); }} className="space-y-4">
    <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
    <div className="space-y-2"><Label>Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
    <Button type="submit" className="w-full" disabled={mutation.isPending}>{dept ? 'Update' : 'Create'} Department</Button>
  </form>);
}

export function DepartmentList() {
  const [open, setOpen] = useState(false); const [editing, setEditing] = useState<any>(null);
  const { data, isLoading } = useQuery({ queryKey: ['departments'], queryFn: () => settingsApi.departments.list() });
  const qc = useQueryClient();
  const remove = useMutation({ mutationFn: (id: string) => settingsApi.departments.remove(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['departments'] }); toast.success('Deleted'); } });

  return (<div className="space-y-6 p-6 max-w-[1200px]">
    <div className="flex items-center justify-between">
      <div><h1 className="text-2xl font-semibold tracking-tight">Departments</h1><p className="text-sm text-muted-foreground mt-0.5">Manage departments & teams</p></div>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogTrigger asChild><Button className="gap-2"><Plus size={15} />Add Department</Button></DialogTrigger>
        <DialogContent><DialogHeader><DialogTitle>{editing ? 'Edit' : 'Add'} Department</DialogTitle></DialogHeader><DeptForm dept={editing} onSuccess={() => { setOpen(false); setEditing(null); }} /></DialogContent>
      </Dialog>
    </div>
    <Card><CardContent className="p-0"><Table>
      <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Description</TableHead><TableHead>Employees</TableHead><TableHead>Status</TableHead><TableHead className="w-12" /></TableRow></TableHeader>
      <TableBody>{isLoading ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
        : !data?.data?.length ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No departments</TableCell></TableRow>
        : data.data.map((d: any) => (<TableRow key={d.id}>
          <TableCell className="font-medium">{d.name}</TableCell>
          <TableCell className="text-sm text-muted-foreground">{d.description ?? '-'}</TableCell>
          <TableCell>{d._count?.employees ?? 0}</TableCell>
          <TableCell><Badge variant={d.status === 'active' ? 'default' : 'secondary'} className="capitalize">{d.status}</Badge></TableCell>
          <TableCell><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal size={14} /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => { setEditing(d); setOpen(true); }}><Pencil size={13} className="mr-2" /> Edit</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={() => remove.mutate(d.id)}><Trash2 size={13} className="mr-2" /> Delete</DropdownMenuItem>
            </DropdownMenuContent></DropdownMenu></TableCell>
        </TableRow>))}</TableBody>
    </Table></CardContent></Card>
  </div>);
}
