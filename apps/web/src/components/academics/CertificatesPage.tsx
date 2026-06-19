import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, Award, FileText, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { settingsApi } from '@/api/settings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Tab = 'templates' | 'issued';

function TemplateForm({ onSuccess }: { onSuccess: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [variables, setVariables] = useState('');

  const mutation = useMutation({
    mutationFn: (data: any) => settingsApi.certificates.createTemplate(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['certificate-templates'] }); toast.success('Template created'); onSuccess(); },
    onError: () => toast.error('Failed to create template'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const vars = variables.split(',').map((v) => v.trim()).filter(Boolean);
    mutation.mutate({ name, content, variables: vars.length ? vars : undefined });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2"><Label>Template Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
      <div className="space-y-2"><Label>Content (HTML)</Label><textarea value={content} onChange={(e) => setContent(e.target.value)} required className="w-full h-32 rounded-md border border-border bg-card text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" placeholder="<h1>{{student_name}}</h1><p>...</p>" /></div>
      <div className="space-y-2"><Label>Variables (comma-separated)</Label><Input value={variables} onChange={(e) => setVariables(e.target.value)} placeholder="student_name, course_name, date" /></div>
      <Button type="submit" className="w-full" disabled={mutation.isPending}>Create Template</Button>
    </form>
  );
}

function IssueCertificateForm({ onSuccess }: { onSuccess: () => void }) {
  const qc = useQueryClient();
  const { data: templates } = useQuery({ queryKey: ['certificate-templates'], queryFn: () => settingsApi.certificates.listTemplates() });
  const [enrollmentId, setEnrollmentId] = useState('');
  const [templateId, setTemplateId] = useState('');

  const mutation = useMutation({
    mutationFn: (data: any) => settingsApi.certificates.issue(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['certificates'] }); toast.success('Certificate issued'); onSuccess(); },
    onError: () => toast.error('Failed to issue certificate'),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate({ enrollment_id: enrollmentId, template_id: templateId || undefined }); }} className="space-y-4">
      <div className="space-y-2"><Label>Enrollment ID</Label><Input value={enrollmentId} onChange={(e) => setEnrollmentId(e.target.value)} required /></div>
      <div className="space-y-2"><Label>Template (optional)</Label><select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="w-full h-9 rounded-md border border-border bg-card text-foreground px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"><option value="">Default template</option>{templates?.map((t: any) => (<option key={t.id} value={t.id}>{t.name}</option>))}</select></div>
      <Button type="submit" className="w-full" disabled={mutation.isPending}>Issue Certificate</Button>
    </form>
  );
}

export function CertificatesPage() {
  const [tab, setTab] = useState<Tab>('templates');
  const [templateOpen, setTemplateOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);

  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['certificate-templates'],
    queryFn: () => settingsApi.certificates.listTemplates(),
  });

  const { data: issued, isLoading: issuedLoading } = useQuery({
    queryKey: ['certificates'],
    queryFn: () => settingsApi.certificates.list(''),
    enabled: tab === 'issued',
  });

  return (
    <div className="space-y-6 p-6 max-w-[1200px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Certificates</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage certificate templates and issued certificates</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
            <DialogTrigger asChild><Button variant="outline" className="gap-2"><Plus size={15} />New Template</Button></DialogTrigger>
            <DialogContent><DialogHeader><DialogTitle>Create Certificate Template</DialogTitle></DialogHeader><TemplateForm onSuccess={() => setTemplateOpen(false)} /></DialogContent>
          </Dialog>
          <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
            <DialogTrigger asChild><Button className="gap-2"><Award size={15} />Issue Certificate</Button></DialogTrigger>
            <DialogContent><DialogHeader><DialogTitle>Issue Certificate</DialogTitle></DialogHeader><IssueCertificateForm onSuccess={() => setIssueOpen(false)} /></DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-border">
        <button onClick={() => setTab('templates')} className={cn('px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px cursor-pointer', tab === 'templates' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
          <FileText size={14} className="inline mr-1.5" />Templates
        </button>
        <button onClick={() => setTab('issued')} className={cn('px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px cursor-pointer', tab === 'issued' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
          <Award size={14} className="inline mr-1.5" />Issued Certificates
        </button>
      </div>

      {tab === 'templates' && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Variables</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templatesLoading ? <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                : !templates?.length ? <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No templates yet</TableCell></TableRow>
                : templates.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{(t.variables as string[])?.join(', ') ?? '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {tab === 'issued' && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serial No</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Issued On</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issuedLoading ? <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                : !issued?.length ? <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No certificates issued yet</TableCell></TableRow>
                : issued.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-sm">{c.serial_number}</TableCell>
                    <TableCell className="font-medium">{c.enrollment?.party?.name ?? c.enrollment_id}</TableCell>
                    <TableCell>{c.template?.name ?? 'Default'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(c.issued_at ?? c.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
