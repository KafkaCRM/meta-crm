import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, Trash2, FileText, Video, Link as LinkIcon, File } from 'lucide-react';
import { toast } from 'sonner';
import { settingsApi } from '@/api/settings';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const TYPE_ICONS: Record<string, any> = { pdf: FileText, video: Video, link: LinkIcon, document: FileText, other: File };

function StudyMaterialForm({ onSuccess }: { onSuccess: () => void }) {
  const qc = useQueryClient();
  const { data: courses } = useQuery({ queryKey: ['courses'], queryFn: () => settingsApi.courses.list({ status: 'active' }) });
  const { data: batches } = useQuery({ queryKey: ['batches'], queryFn: () => settingsApi.batches.list() });
  const [courseId, setCourseId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState('pdf');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');

  const mutation = useMutation({
    mutationFn: (data: any) => settingsApi.studyMaterials.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['study-materials'] }); toast.success('Material added'); onSuccess(); },
    onError: () => toast.error('Failed to add material'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({ course_id: courseId, title, type, url, description: description || undefined, batch_id: batchId || undefined });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2"><Label>Course</Label><Select value={courseId} onValueChange={setCourseId} required><SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger><SelectContent>{courses?.data?.map((c: any) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent></Select></div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
        <div className="space-y-2"><Label>Type</Label><Select value={type} onValueChange={setType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pdf">PDF</SelectItem><SelectItem value="video">Video</SelectItem><SelectItem value="link">Link</SelectItem><SelectItem value="document">Document</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
      </div>
      <div className="space-y-2"><Label>URL</Label><Input value={url} onChange={(e) => setUrl(e.target.value)} required placeholder="https://..." /></div>
      <div className="space-y-2"><Label>Description (optional)</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
      <div className="space-y-2"><Label>Batch (optional)</Label><Select value={batchId} onValueChange={setBatchId}><SelectTrigger><SelectValue placeholder="All batches" /></SelectTrigger><SelectContent>{batches?.data?.map((b: any) => (<SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>))}</SelectContent></Select></div>
      <Button type="submit" className="w-full" disabled={mutation.isPending}>Add Material</Button>
    </form>
  );
}

export function StudyMaterialsList() {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['study-materials'], queryFn: () => settingsApi.studyMaterials.list() });
  const qc = useQueryClient();
  const removeMutation = useMutation({
    mutationFn: (id: string) => settingsApi.studyMaterials.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['study-materials'] }); toast.success('Removed'); },
    onError: () => toast.error('Failed to remove'),
  });

  return (
    <div className="space-y-6 p-6 max-w-[1200px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Study Materials</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Upload and organize learning resources</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-2"><Plus size={15} />Add Material</Button></DialogTrigger>
          <DialogContent><DialogHeader><DialogTitle>Add Study Material</DialogTitle></DialogHeader><StudyMaterialForm onSuccess={() => setOpen(false)} /></DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={5} className="text-center py-8"><Skeleton className="h-4 w-full" /></TableCell></TableRow>
              : !data?.data?.length ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No study materials yet</TableCell></TableRow>
              : data.data.map((m: any) => {
                const Icon = TYPE_ICONS[m.type] ?? File;
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium flex items-center gap-2">
                      <Icon size={14} className="text-primary" />
                      <a href={m.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{m.title}</a>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{m.type}</Badge></TableCell>
                    <TableCell>{m.course?.name ?? '—'}</TableCell>
                    <TableCell>{m.batch?.name ?? 'All'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeMutation.mutate(m.id)}><Trash2 size={14} /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
