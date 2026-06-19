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

function ProductForm({ onSuccess }: { onSuccess: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(''); const [sku, setSku] = useState(''); const [unit, setUnit] = useState(''); const [price, setPrice] = useState(''); const [categoryId, setCategoryId] = useState('');
  const { data: cats } = useQuery({ queryKey: ['product-categories'], queryFn: () => settingsApi.productCategories.list() });
  const mutation = useMutation({ mutationFn: (d: any) => settingsApi.products.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); toast.success('Product created'); onSuccess(); } });
  return (<form onSubmit={(e) => { e.preventDefault(); mutation.mutate({ name, sku, unit: unit || undefined, price: price ? Number(price) : undefined, category_id: categoryId || undefined }); }} className="space-y-4">
    <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div><div className="space-y-2"><Label>SKU *</Label><Input value={sku} onChange={(e) => setSku(e.target.value)} required /></div></div>
    <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Unit</Label><Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="pcs, kg, etc" /></div><div className="space-y-2"><Label>Price</Label><Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} /></div></div>
    <div className="space-y-2"><Label>Category</Label><select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"><option value="">None</option>{cats?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
    <Button type="submit" className="w-full" disabled={mutation.isPending}>Create Product</Button>
  </form>);
}

export function ProductList() {
  const [open, setOpen] = useState(false); const [search, setSearch] = useState(''); const [statusFilter, setStatusFilter] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['products', search, statusFilter], queryFn: () => settingsApi.products.list({ search: search || undefined, status: statusFilter || undefined }) });
  const qc = useQueryClient();
  const removeMut = useMutation({ mutationFn: (id: string) => settingsApi.products.remove(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); toast.success('Deleted'); } });
  return (<div className="space-y-6 p-6 max-w-[1200px]">
    <div className="flex items-center justify-between">
      <div><h1 className="text-2xl font-semibold tracking-tight">Products</h1><p className="text-sm text-muted-foreground mt-0.5">Product catalog</p></div>
      <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button className="gap-2"><Plus size={15} />New Product</Button></DialogTrigger>
        <DialogContent><DialogHeader><DialogTitle>New Product</DialogTitle></DialogHeader><ProductForm onSuccess={() => setOpen(false)} /></DialogContent></Dialog>
    </div>
    <div className="flex items-center gap-3"><div className="relative flex-1 max-w-sm"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" /></div>
      <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"><option value="">All</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
    <Card><CardContent className="p-0"><Table>
      <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>SKU</TableHead><TableHead>Category</TableHead><TableHead>Unit</TableHead><TableHead>Price</TableHead><TableHead>Status</TableHead><TableHead className="w-16" /></TableRow></TableHeader>
      <TableBody>{isLoading ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
        : !data?.data?.length ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No products</TableCell></TableRow>
        : data.data.map((p: any) => (<TableRow key={p.id}>
          <TableCell className="font-medium">{p.name}</TableCell><TableCell className="text-sm">{p.sku}</TableCell>
          <TableCell className="text-sm">{p.category?.name ?? '-'}</TableCell><TableCell className="text-sm">{p.unit ?? '-'}</TableCell>
          <TableCell className="text-sm">{p.price != null ? `$${p.price.toFixed(2)}` : '-'}</TableCell>
          <TableCell><Badge variant="outline" className={`capitalize ${p.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{p.status}</Badge></TableCell>
          <TableCell><Button variant="ghost" size="icon" onClick={() => removeMut.mutate(p.id)} className="text-red-500"><Trash2 size={14} /></Button></TableCell>
        </TableRow>))}</TableBody>
    </Table></CardContent></Card>
  </div>);
}
