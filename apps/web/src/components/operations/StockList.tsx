import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { settingsApi } from '@/api/settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

function StockForm({ onSuccess }: { onSuccess: () => void }) {
  const qc = useQueryClient();
  const [productId, setProductId] = useState(''); const [warehouseId, setWarehouseId] = useState(''); const [quantity, setQuantity] = useState('0');
  const { data: products } = useQuery({ queryKey: ['products-all'], queryFn: () => settingsApi.products.list({ limit: 500 }) });
  const { data: warehouses } = useQuery({ queryKey: ['warehouses'], queryFn: () => settingsApi.warehouses.list() });
  const mutation = useMutation({ mutationFn: (d: any) => settingsApi.stock.adjust(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['stock'] }); toast.success('Stock adjusted'); onSuccess(); } });
  return (<form onSubmit={(e) => { e.preventDefault(); mutation.mutate({ product_id: productId, warehouse_id: warehouseId, quantity: Number(quantity) }); }} className="space-y-4">
    <div className="space-y-2"><Label>Product *</Label><select value={productId} onChange={(e) => setProductId(e.target.value)} required className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"><option value="">Select</option>{products?.data?.map((p: any) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}</select></div>
    <div className="space-y-2"><Label>Warehouse *</Label><select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"><option value="">Select</option>{warehouses?.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
    <div className="space-y-2"><Label>Quantity</Label><Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} min={0} /></div>
    <Button type="submit" className="w-full" disabled={mutation.isPending}>Set Stock</Button>
  </form>);
}

export function StockList() {
  const [open, setOpen] = useState(false); const [lowStock, setLowStock] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['stock', lowStock], queryFn: () => settingsApi.stock.list({ low_stock: lowStock || undefined }) });
  return (<div className="space-y-6 p-6 max-w-[1200px]">
    <div className="flex items-center justify-between">
      <div><h1 className="text-2xl font-semibold tracking-tight">Stock Levels</h1><p className="text-sm text-muted-foreground mt-0.5">Inventory by product & warehouse</p></div>
      <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button className="gap-2"><Plus size={15} />Adjust Stock</Button></DialogTrigger>
        <DialogContent><DialogHeader><DialogTitle>Adjust Stock</DialogTitle></DialogHeader><StockForm onSuccess={() => setOpen(false)} /></DialogContent></Dialog>
    </div>
    <div className="flex items-center gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={lowStock} onChange={(e) => setLowStock(e.target.checked)} className="rounded" /> Low stock only</label></div>
    <Card><CardContent className="p-0"><Table>
      <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>SKU</TableHead><TableHead>Warehouse</TableHead><TableHead>Quantity</TableHead><TableHead>Min Level</TableHead></TableRow></TableHeader>
      <TableBody>{isLoading ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
        : !data?.data?.length ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No stock records</TableCell></TableRow>
        : data.data.map((s: any) => (<TableRow key={s.id}>
          <TableCell className="font-medium">{s.product?.name}</TableCell>
          <TableCell className="text-sm">{s.product?.sku}</TableCell>
          <TableCell className="text-sm">{s.warehouse?.name}</TableCell>
          <TableCell><Badge variant="outline" className={`${s.quantity <= s.min_stock_level ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{s.quantity}</Badge></TableCell>
          <TableCell className="text-sm">{s.min_stock_level}</TableCell>
        </TableRow>))}</TableBody>
    </Table></CardContent></Card>
  </div>);
}
