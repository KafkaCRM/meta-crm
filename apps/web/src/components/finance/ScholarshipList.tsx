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

function ScholarshipForm({ scholarship, onSuccess }: { scholarship?: any; onSuccess: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(scholarship?.name ?? '');
  const [type, setType] = useState(scholarship?.type ?? 'percentage');
  const [value, setValue] = useState(scholarship?.value ?? '');
  const [eligibility, setEligibility] = useState(scholarship?.eligibility ?? '');

  const mutation = useMutation({
    mutationFn: (data: any) =>
      scholarship ? settingsApi.scholarships.update(scholarship.id, data) : settingsApi.scholarships.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scholarships'] });
      toast.success(scholarship ? 'Scholarship updated' : 'Scholarship created');
      onSuccess();
    },
    onError: () => toast.error('Failed to save scholarship'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({ name, type, value: Number(value), eligibility });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Scholarship Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Type</Label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
            <option value="percentage">Percentage</option>
            <option value="fixed">Fixed Amount</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label>Value</Label>
          <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} required />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Eligibility Criteria</Label>
        <Input value={eligibility} onChange={(e) => setEligibility(e.target.value)} placeholder="e.g. Score > 90%" />
      </div>
      <Button type="submit" className="w-full" disabled={mutation.isPending}>
        {scholarship ? 'Update Scholarship' : 'Create Scholarship'}
      </Button>
    </form>
  );
}

export function ScholarshipList() {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['scholarships', search],
    queryFn: () => settingsApi.scholarships.list({ search: search || undefined }),
  });

  const queryClient = useQueryClient();
  const removeMutation = useMutation({
    mutationFn: (id: string) => settingsApi.scholarships.remove(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['scholarships'] }); toast.success('Scholarship deleted'); },
    onError: () => toast.error('Failed to delete scholarship'),
  });

  return (
    <div className="space-y-6 p-6 max-w-[1200px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Scholarships</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Define scholarship schemes</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus size={15} />Add Scholarship</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit Scholarship' : 'Add Scholarship'}</DialogTitle>
            </DialogHeader>
            <ScholarshipForm scholarship={editing} onSuccess={() => { setOpen(false); setEditing(null); }} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <Search size={16} className="text-muted-foreground" />
        <Input placeholder="Search scholarships..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Eligibility</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
              ) : !data?.data?.length ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No scholarships yet</TableCell></TableRow>
              ) : data.data.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="capitalize">{s.type}</TableCell>
                  <TableCell>{s.type === 'percentage' ? `${s.value}%` : `₹${s.value}`}</TableCell>
                  <TableCell>{s.eligibility ?? '-'}</TableCell>
                  <TableCell>
                    <Badge variant={s.status === 'active' ? 'default' : 'secondary'} className="capitalize">{s.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal size={14} /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditing(s); setOpen(true); }}><Pencil size={13} className="mr-2" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => removeMutation.mutate(s.id)}><Trash2 size={13} className="mr-2" /> Delete</DropdownMenuItem>
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
