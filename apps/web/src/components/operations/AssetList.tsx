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

const STATUS_COLORS: Record<string, string> = { available: 'bg-emerald-100 text-emerald-700', assigned: 'bg-blue-100 text-blue-700', maintenance: 'bg-amber-100 text-amber-700', retired: 'bg-slate-100 text-slate-500' };

function AssetForm({ onSuccess }: { onSuccess: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(''); const [assetCode, setAssetCode] = useState(''); const [type, setType] = useState(''); const [assignedToId, setAssignedToId] = useState(''); const [purchaseDate, setPurchaseDate] = useState(''); const [purchaseCost, setPurchaseCost] = useState(''); const [notes, setNotes] = useState('');
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => settingsApi.users.list() });
  const mutation = useMutation({ mutationFn: (d: any) => settingsApi.assets.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['assets'] }); toast.success('Asset created'); onSuccess(); } });
  return (<form onSubmit={(e) => { e.preventDefault(); mutation.mutate({ name, asset_code: assetCode, type: type || undefined, assigned_to_id: assignedToId || undefined, purchase_date: purchaseDate || undefined, purchase_cost: purchaseCost ? Number(purchaseCost) : undefined, notes: notes || undefined }); }} className="space-y-4">
    <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div><div className="space-y-2"><Label>Asset Code *</Label><Input value={assetCode} onChange={(e) => setAssetCode(e.target.value)} required /></div></div>
    <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Type</Label><Input value={type} onChange={(e) => setType(e.target.value)} placeholder="laptop, furniture, etc" /></div><div className="space-y-2"><Label>Assigned To</Label><select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"><option value="">Unassigned</option>{users?.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div></div>
    <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Purchase Date</Label><Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} /></div><div className="space-y-2"><Label>Purchase Cost</Label><Input type="number" value={purchaseCost} onChange={(e) => setPurchaseCost(e.target.value)} /></div></div>
    <div className="space-y-2"><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
    <Button type="submit" className="w-full" disabled={mutation.isPending}>Create Asset</Button>
  </form>);
}

export function AssetList() {
  const [open, setOpen] = useState(false); const [search, setSearch] = useState(''); const [statusFilter, setStatusFilter] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['assets', search, statusFilter], queryFn: () => settingsApi.assets.list({ search: search || undefined, status: statusFilter || undefined }) });
  const qc = useQueryClient();
  const removeMut = useMutation({ mutationFn: (id: string) => settingsApi.assets.remove(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['assets'] }); toast.success('Deleted'); } });
  return (<div className="space-y-6 p-6 max-w-[1200px]">
    <div className="flex items-center justify-between">
      <div><h1 className="text-2xl font-semibold tracking-tight">Assets</h1><p className="text-sm text-muted-foreground mt-0.5">Track company assets</p></div>
      <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button className="gap-2"><Plus size={15} />New Asset</Button></DialogTrigger>
        <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>New Asset</DialogTitle></DialogHeader><AssetForm onSuccess={() => setOpen(false)} /></DialogContent></Dialog>
    </div>
    <div className="flex items-center gap-3"><div className="relative flex-1 max-w-sm"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" /></div>
      <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"><option value="">All</option><option value="available">Available</option><option value="assigned">Assigned</option><option value="maintenance">Maintenance</option><option value="retired">Retired</option></select></div>
    <Card><CardContent className="p-0"><Table>
      <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead>Assigned To</TableHead><TableHead>Cost</TableHead><TableHead className="w-16" /></TableRow></TableHeader>
      <TableBody>{isLoading ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
        : !data?.data?.length ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No assets</TableCell></TableRow>
        : data.data.map((a: any) => (<TableRow key={a.id}>
          <TableCell className="font-medium">{a.name}</TableCell><TableCell className="text-sm">{a.asset_code}</TableCell>
          <TableCell className="text-sm">{a.type ?? '-'}</TableCell>
          <TableCell><Badge variant="outline" className={`capitalize ${STATUS_COLORS[a.status] ?? ''}`}>{a.status}</Badge></TableCell>
          <TableCell className="text-sm">{a.assigned_to?.name ?? '-'}</TableCell>
          <TableCell className="text-sm">{a.purchase_cost != null ? `$${a.purchase_cost.toFixed(2)}` : '-'}</TableCell>
          <TableCell><Button variant="ghost" size="icon" onClick={() => removeMut.mutate(a.id)} className="text-red-500"><Trash2 size={14} /></Button></TableCell>
        </TableRow>))}</TableBody>
    </Table></CardContent></Card>
  </div>);
}
