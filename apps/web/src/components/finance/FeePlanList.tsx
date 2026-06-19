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

function FeePlanForm({ plan, onSuccess }: { plan?: any; onSuccess: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(plan?.name ?? '');
  const [description, setDescription] = useState(plan?.description ?? '');
  const [courseId, setCourseId] = useState(plan?.course_id ?? '');
  const [totalFee, setTotalFee] = useState(plan?.total_fee ?? '');

  const { data: courses } = useQuery({
    queryKey: ['courses'],
    queryFn: () => settingsApi.courses.list(),
  });

  const mutation = useMutation({
    mutationFn: (data: any) =>
      plan ? settingsApi.feePlans.update(plan.id, data) : settingsApi.feePlans.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fee-plans'] });
      toast.success(plan ? 'Fee plan updated' : 'Fee plan created');
      onSuccess();
    },
    onError: () => toast.error('Failed to save fee plan'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({ name, description, course_id: courseId, total_fee: Number(totalFee) });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Plan Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. 4-Installment Plan" />
      </div>
      <div className="space-y-2">
        <Label>Course</Label>
        <select value={courseId} onChange={(e) => setCourseId(e.target.value)} required className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
          <option value="">Select course</option>
          {courses?.data?.map((c: any) => (
            <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label>Total Fee</Label>
        <Input type="number" value={totalFee} onChange={(e) => setTotalFee(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={mutation.isPending}>
        {plan ? 'Update Fee Plan' : 'Create Fee Plan'}
      </Button>
    </form>
  );
}

export function FeePlanList() {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['fee-plans', search],
    queryFn: () => settingsApi.feePlans.list({ search: search || undefined }),
  });

  const queryClient = useQueryClient();
  const removeMutation = useMutation({
    mutationFn: (id: string) => settingsApi.feePlans.remove(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['fee-plans'] }); toast.success('Fee plan deleted'); },
    onError: () => toast.error('Failed to delete fee plan'),
  });

  return (
    <div className="space-y-6 p-6 max-w-[1200px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Fee Plans</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage fee structures per course</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus size={15} />Add Fee Plan</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit Fee Plan' : 'Add Fee Plan'}</DialogTitle>
            </DialogHeader>
            <FeePlanForm plan={editing} onSuccess={() => { setOpen(false); setEditing(null); }} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <Search size={16} className="text-muted-foreground" />
        <Input placeholder="Search fee plans..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Total Fee</TableHead>
                <TableHead>Installments</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
              ) : !data?.data?.length ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No fee plans yet</TableCell></TableRow>
              ) : data.data.map((plan: any) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium">{plan.name}</TableCell>
                  <TableCell>{plan.course?.name ?? '-'}</TableCell>
                  <TableCell>₹{plan.total_fee}</TableCell>
                  <TableCell>{plan.installments?.length ?? 0}</TableCell>
                  <TableCell>
                    <Badge variant={plan.status === 'active' ? 'default' : 'secondary'} className="capitalize">{plan.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal size={14} /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditing(plan); setOpen(true); }}><Pencil size={13} className="mr-2" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => removeMutation.mutate(plan.id)}><Trash2 size={13} className="mr-2" /> Delete</DropdownMenuItem>
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
