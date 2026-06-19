import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { settingsApi } from '@/api/settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

function WarehouseForm({ onSuccess }: { onSuccess: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(''); const [location, setLocation] = useState('');
  const mutation = useMutation({ mutationFn: (d: any) => settingsApi.warehouses.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['warehouses'] }); toast.success('Warehouse created'); onSuccess(); } });
  return (<form onSubmit={(e) => { e.preventDefault(); mutation.mutate({ name, location }); }} className="space-y-4">
    <div className="space-y-2"><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
    <div className="space-y-2"><Label>Location</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} /></div>
    <Button type="submit" className="w-full" disabled={mutation.isPending}>Create Warehouse</Button>
  </form>);
}

export function WarehouseList() {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['warehouses'], queryFn: () => settingsApi.warehouses.list() });
  const qc = useQueryClient();
  const removeMut = useMutation({ mutationFn: (id: string) => settingsApi.warehouses.remove(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['warehouses'] }); toast.success('Deleted'); } });
  return (<div className="space-y-6 p-6 max-w-[900px]">
    <div className="flex items-center justify-between">
      <div><h1 className="text-2xl font-semibold tracking-tight">Warehouses</h1><p className="text-sm text-muted-foreground mt-0.5">Manage warehouse locations</p></div>
      <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button className="gap-2"><Plus size={15} />New Warehouse</Button></DialogTrigger>
        <DialogContent><DialogHeader><DialogTitle>New Warehouse</DialogTitle></DialogHeader><WarehouseForm onSuccess={() => setOpen(false)} /></DialogContent></Dialog>
    </div>
    <Card><CardContent className="p-0"><Table>
      <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Location</TableHead><TableHead>Status</TableHead><TableHead className="w-16" /></TableRow></TableHeader>
      <TableBody>{isLoading ? <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
        : !data?.length ? <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No warehouses</TableCell></TableRow>
        : data.map((w: any) => (<TableRow key={w.id}>
          <TableCell className="font-medium">{w.name}</TableCell>
          <TableCell className="text-sm text-muted-foreground">{w.location ?? '-'}</TableCell>
          <TableCell><Badge variant="outline" className={`capitalize ${w.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{w.status}</Badge></TableCell>
          <TableCell><Button variant="ghost" size="icon" onClick={() => removeMut.mutate(w.id)} className="text-red-500"><Trash2 size={14} /></Button></TableCell>
        </TableRow>))}</TableBody>
    </Table></CardContent></Card>
  </div>);
}
