import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { settingsApi } from '@/api/settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

function CategoryForm({ onSuccess }: { onSuccess: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(''); const [description, setDescription] = useState('');
  const mutation = useMutation({ mutationFn: (d: any) => settingsApi.productCategories.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['product-categories'] }); toast.success('Category created'); onSuccess(); } });
  return (<form onSubmit={(e) => { e.preventDefault(); mutation.mutate({ name, description }); }} className="space-y-4">
    <div className="space-y-2"><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
    <div className="space-y-2"><Label>Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
    <Button type="submit" className="w-full" disabled={mutation.isPending}>Create Category</Button>
  </form>);
}

export function ProductCategoryList() {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['product-categories'], queryFn: () => settingsApi.productCategories.list() });
  const qc = useQueryClient();
  const removeMut = useMutation({ mutationFn: (id: string) => settingsApi.productCategories.remove(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['product-categories'] }); toast.success('Deleted'); } });
  return (<div className="space-y-6 p-6 max-w-[900px]">
    <div className="flex items-center justify-between">
      <div><h1 className="text-2xl font-semibold tracking-tight">Product Categories</h1><p className="text-sm text-muted-foreground mt-0.5">Organize products by category</p></div>
      <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button className="gap-2"><Plus size={15} />New Category</Button></DialogTrigger>
        <DialogContent><DialogHeader><DialogTitle>New Category</DialogTitle></DialogHeader><CategoryForm onSuccess={() => setOpen(false)} /></DialogContent></Dialog>
    </div>
    <Card><CardContent className="p-0"><Table>
      <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Products</TableHead><TableHead className="w-16" /></TableRow></TableHeader>
      <TableBody>{isLoading ? <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
        : !data?.length ? <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No categories</TableCell></TableRow>
        : data.map((c: any) => (<TableRow key={c.id}>
          <TableCell className="font-medium">{c.name}</TableCell>
          <TableCell className="text-sm text-muted-foreground">{c.description ?? '-'}</TableCell>
          <TableCell className="text-right">{c._count?.products ?? 0}</TableCell>
          <TableCell><Button variant="ghost" size="icon" onClick={() => removeMut.mutate(c.id)} className="text-red-500"><Trash2 size={14} /></Button></TableCell>
        </TableRow>))}</TableBody>
    </Table></CardContent></Card>
  </div>);
}
