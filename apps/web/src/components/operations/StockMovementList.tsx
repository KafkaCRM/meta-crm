import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { settingsApi } from '@/api/settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

const TYPE_COLORS: Record<string, string> = { in: 'bg-emerald-100 text-emerald-700', out: 'bg-red-100 text-red-700', adjustment: 'bg-blue-100 text-blue-700' };

function MovementForm({ onSuccess }: { onSuccess: () => void }) {
  const qc = useQueryClient();
  const [productId, setProductId] = useState(''); const [warehouseId, setWarehouseId] = useState(''); const [type, setType] = useState('in'); const [quantity, setQuantity] = useState('1'); const [reference, setReference] = useState(''); const [notes, setNotes] = useState('');
  const { data: products } = useQuery({ queryKey: ['products-all'], queryFn: () => settingsApi.products.list({ limit: 500 }) });
  const { data: warehouses } = useQuery({ queryKey: ['warehouses'], queryFn: () => settingsApi.warehouses.list() });
  const mutation = useMutation({ mutationFn: (d: any) => settingsApi.stockMovements.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['stock-movements'] }); toast.success('Movement recorded'); onSuccess(); }, onError: (e: any) => toast.error(e.message ?? 'Failed') });
  return (<form onSubmit={(e) => { e.preventDefault(); mutation.mutate({ product_id: productId, warehouse_id: warehouseId, type, quantity: Number(quantity), reference: reference || undefined, notes: notes || undefined }); }} className="space-y-4">
    <div className="space-y-2"><Label>Product *</Label><select value={productId} onChange={(e) => setProductId(e.target.value)} required className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"><option value="">Select</option>{products?.data?.map((p: any) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}</select></div>
    <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Warehouse *</Label><select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"><option value="">Select</option>{warehouses?.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
      <div className="space-y-2"><Label>Type</Label><select value={type} onChange={(e) => setType(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"><option value="in">Stock In</option><option value="out">Stock Out</option><option value="adjustment">Adjustment</option></select></div></div>
    <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Quantity</Label><Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} min={1} /></div><div className="space-y-2"><Label>Reference</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="PO #" /></div></div>
    <div className="space-y-2"><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
    <Button type="submit" className="w-full" disabled={mutation.isPending}>Record Movement</Button>
  </form>);
}

export function StockMovementList() {
  const [open, setOpen] = useState(false); const [typeFilter, setTypeFilter] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['stock-movements', typeFilter], queryFn: () => settingsApi.stockMovements.list({ type: typeFilter || undefined }) });
  return (<div className="space-y-6 p-6 max-w-[1200px]">
    <div className="flex items-center justify-between">
      <div><h1 className="text-2xl font-semibold tracking-tight">Stock Movements</h1><p className="text-sm text-muted-foreground mt-0.5">Inbound, outbound & adjustments</p></div>
      <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button className="gap-2"><Plus size={15} />New Movement</Button></DialogTrigger>
        <DialogContent><DialogHeader><DialogTitle>Record Movement</DialogTitle></DialogHeader><MovementForm onSuccess={() => setOpen(false)} /></DialogContent></Dialog>
    </div>
    <div className="flex items-center gap-3"><select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"><option value="">All types</option><option value="in">Stock In</option><option value="out">Stock Out</option><option value="adjustment">Adjustment</option></select></div>
    <Card><CardContent className="p-0"><Table>
      <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Warehouse</TableHead><TableHead>Type</TableHead><TableHead>Quantity</TableHead><TableHead>Reference</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
      <TableBody>{isLoading ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
        : !data?.data?.length ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No movements</TableCell></TableRow>
        : data.data.map((m: any) => (<TableRow key={m.id}>
          <TableCell className="font-medium">{m.product?.name}</TableCell>
          <TableCell className="text-sm">{m.warehouse?.name}</TableCell>
          <TableCell><Badge variant="outline" className={`capitalize ${TYPE_COLORS[m.type] ?? ''}`}>{m.type}</Badge></TableCell>
          <TableCell className="font-mono">{m.quantity}</TableCell>
          <TableCell className="text-sm text-muted-foreground">{m.reference ?? '-'}</TableCell>
          <TableCell className="text-sm">{new Date(m.created_at).toLocaleString()}</TableCell>
        </TableRow>))}</TableBody>
    </Table></CardContent></Card>
  </div>);
}
