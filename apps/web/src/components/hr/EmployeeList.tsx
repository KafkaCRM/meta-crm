import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, Search, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { settingsApi } from '@/api/settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

function EmpForm({ emp, onSuccess }: { emp?: any; onSuccess: () => void }) {
  const qc = useQueryClient();
  const [code, setCode] = useState(emp?.employee_code ?? '');
  const [userId, setUserId] = useState(emp?.user_id ?? '');
  const [deptId, setDeptId] = useState(emp?.department_id ?? '');
  const [designation, setDesignation] = useState(emp?.designation ?? '');
  const [salary, setSalary] = useState(emp?.salary ?? '');
  const { data: depts } = useQuery({ queryKey: ['departments'], queryFn: () => settingsApi.departments.list() });
  const mutation = useMutation({
    mutationFn: (data: any) => emp ? settingsApi.employees.update(emp.id, data) : settingsApi.employees.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); toast.success(emp ? 'Updated' : 'Created'); onSuccess(); },
  });
  return (<form onSubmit={(e) => { e.preventDefault(); mutation.mutate({ employee_code: code, user_id: userId || undefined, department_id: deptId || undefined, designation: designation || undefined, salary: salary ? Number(salary) : undefined }); }} className="space-y-4">
    <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Employee Code</Label><Input value={code} onChange={(e) => setCode(e.target.value)} required /></div>
      <div className="space-y-2"><Label>Designation</Label><Input value={designation} onChange={(e) => setDesignation(e.target.value)} /></div></div>
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2"><Label>Department</Label><select value={deptId} onChange={(e) => setDeptId(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"><option value="">None</option>{depts?.data?.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
      <div className="space-y-2"><Label>Salary</Label><Input type="number" value={salary} onChange={(e) => setSalary(e.target.value)} /></div>
    </div>
    <Button type="submit" className="w-full" disabled={mutation.isPending}>{emp ? 'Update' : 'Create'} Employee</Button>
  </form>);
}

export function EmployeeList() {
  const [open, setOpen] = useState(false); const [editing, setEditing] = useState<any>(null);
  const [search, setSearch] = useState(''); const [deptFilter, setDeptFilter] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['employees', search, deptFilter], queryFn: () => settingsApi.employees.list({ search: search || undefined, department_id: deptFilter || undefined }) });
  const { data: depts } = useQuery({ queryKey: ['departments'], queryFn: () => settingsApi.departments.list() });
  const qc = useQueryClient();
  const remove = useMutation({ mutationFn: (id: string) => settingsApi.employees.remove(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); toast.success('Deleted'); } });

  return (<div className="space-y-6 p-6 max-w-[1200px]">
    <div className="flex items-center justify-between">
      <div><h1 className="text-2xl font-semibold tracking-tight">Employees</h1><p className="text-sm text-muted-foreground mt-0.5">Manage workforce directory</p></div>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogTrigger asChild><Button className="gap-2"><Plus size={15} />Add Employee</Button></DialogTrigger>
        <DialogContent><DialogHeader><DialogTitle>{editing ? 'Edit' : 'Add'} Employee</DialogTitle></DialogHeader><EmpForm emp={editing} onSuccess={() => { setOpen(false); setEditing(null); }} /></DialogContent>
      </Dialog>
    </div>
    <div className="flex items-center gap-3"><div className="flex items-center gap-2 max-w-sm flex-1"><Search size={16} className="text-muted-foreground" /><Input placeholder="Search by name or code..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"><option value="">All depts</option>{depts?.data?.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
    </div>
    <Card><CardContent className="p-0"><Table>
      <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Department</TableHead><TableHead>Designation</TableHead><TableHead>Salary</TableHead><TableHead>Status</TableHead><TableHead className="w-12" /></TableRow></TableHeader>
      <TableBody>{isLoading ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
        : !data?.data?.length ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No employees</TableCell></TableRow>
        : data.data.map((e: any) => (<TableRow key={e.id}>
          <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{e.employee_code}</code></TableCell>
          <TableCell className="font-medium">{e.user?.name ?? '-'}</TableCell>
          <TableCell>{e.department?.name ?? '-'}</TableCell>
          <TableCell>{e.designation ?? '-'}</TableCell>
          <TableCell>{e.salary ? `₹${e.salary}` : '-'}</TableCell>
          <TableCell><Badge variant={e.status === 'active' ? 'default' : 'secondary'} className="capitalize">{e.status}</Badge></TableCell>
          <TableCell><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal size={14} /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => { setEditing(e); setOpen(true); }}><Pencil size={13} className="mr-2" /> Edit</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={() => remove.mutate(e.id)}><Trash2 size={13} className="mr-2" /> Delete</DropdownMenuItem>
            </DropdownMenuContent></DropdownMenu></TableCell>
        </TableRow>))}</TableBody>
    </Table></CardContent></Card>
  </div>);
}
