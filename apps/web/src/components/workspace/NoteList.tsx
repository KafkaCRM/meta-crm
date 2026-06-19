import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { settingsApi } from '@/api/settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

function NoteForm({ onSuccess }: { onSuccess: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(''); const [content, setContent] = useState('');
  const mutation = useMutation({
    mutationFn: (data: any) => settingsApi.notes.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notes'] }); toast.success('Note created'); onSuccess(); },
  });
  return (<form onSubmit={(e) => { e.preventDefault(); mutation.mutate({ title, content }); }} className="space-y-4">
    <div className="space-y-2"><Label>Title *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
    <div className="space-y-2"><Label>Content</Label><Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5} /></div>
    <Button type="submit" className="w-full" disabled={mutation.isPending}>Create Note</Button>
  </form>);
}

export function NoteList() {
  const [open, setOpen] = useState(false); const [search, setSearch] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['notes', search], queryFn: () => settingsApi.notes.list({ search: search || undefined }) });
  const qc = useQueryClient();
  const removeMut = useMutation({ mutationFn: (id: string) => settingsApi.notes.remove(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['notes'] }); toast.success('Note deleted'); } });

  return (<div className="space-y-6 p-6 max-w-[1200px]">
    <div className="flex items-center justify-between">
      <div><h1 className="text-2xl font-semibold tracking-tight">Notes</h1><p className="text-sm text-muted-foreground mt-0.5">Internal notes</p></div>
      <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button className="gap-2"><Plus size={15} />New Note</Button></DialogTrigger>
        <DialogContent><DialogHeader><DialogTitle>New Note</DialogTitle></DialogHeader><NoteForm onSuccess={() => setOpen(false)} /></DialogContent></Dialog>
    </div>
    <div className="relative max-w-sm"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search notes..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" /></div>
    <Card><CardContent className="p-0"><Table>
      <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Content</TableHead><TableHead>Created</TableHead><TableHead className="w-16" /></TableRow></TableHeader>
      <TableBody>{isLoading ? <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
        : !data?.data?.length ? <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No notes</TableCell></TableRow>
        : data.data.map((n: any) => (<TableRow key={n.id}>
          <TableCell className="font-medium max-w-[200px] truncate">{n.title}</TableCell>
          <TableCell className="text-sm text-muted-foreground max-w-[400px] truncate">{n.content ?? '-'}</TableCell>
          <TableCell className="text-sm">{new Date(n.created_at).toLocaleDateString()}</TableCell>
          <TableCell><Button variant="ghost" size="icon" onClick={() => removeMut.mutate(n.id)} className="text-red-500"><Trash2 size={14} /></Button></TableCell>
        </TableRow>))}</TableBody>
    </Table></CardContent></Card>
  </div>);
}
