import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, MoreHorizontal, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { settingsApi } from '@/api/settings';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function PayslipForm({ onSuccess }: { onSuccess: () => void }) {
  const qc = useQueryClient();
  const [employeeId, setEmployeeId] = useState(''); const [month, setMonth] = useState(''); const [year, setYear] = useState(new Date().getFullYear().toString());
  const [basic, setBasic] = useState(''); const [hra, setHra] = useState(''); const [allowances, setAllowances] = useState(''); const [deductions, setDeductions] = useState(''); const [netPay, setNetPay] = useState('');
  const { data: employees } = useQuery({ queryKey: ['employees'], queryFn: () => settingsApi.employees.list() });
  const mutation = useMutation({
    mutationFn: (data: any) => settingsApi.payslips.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payslips'] }); toast.success('Payslip created'); onSuccess(); },
  });
  return (<form onSubmit={(e) => { e.preventDefault(); mutation.mutate({ employee_id: employeeId, month: Number(month), year: Number(year), basic: Number(basic) || 0, hra: Number(hra) || 0, allowances: Number(allowances) || 0, deductions: Number(deductions) || 0, net_pay: Number(netPay) }); }} className="space-y-4">
    <div className="space-y-2"><Label>Employee</Label><select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"><option value="">Select</option>{employees?.data?.map((e: any) => <option key={e.id} value={e.id}>{e.employee_code} - {e.user?.name ?? ''}</option>)}</select></div>
    <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Month</Label><select value={month} onChange={(e) => setMonth(e.target.value)} required className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"><option value="">Select</option>{MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select></div>
      <div className="space-y-2"><Label>Year</Label><Input type="number" value={year} onChange={(e) => setYear(e.target.value)} required /></div></div>
    <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Basic</Label><Input type="number" value={basic} onChange={(e) => setBasic(e.target.value)} /></div><div className="space-y-2"><Label>HRA</Label><Input type="number" value={hra} onChange={(e) => setHra(e.target.value)} /></div></div>
    <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Allowances</Label><Input type="number" value={allowances} onChange={(e) => setAllowances(e.target.value)} /></div><div className="space-y-2"><Label>Deductions</Label><Input type="number" value={deductions} onChange={(e) => setDeductions(e.target.value)} /></div></div>
    <div className="space-y-2"><Label>Net Pay</Label><Input type="number" value={netPay} onChange={(e) => setNetPay(e.target.value)} required /></div>
    <Button type="submit" className="w-full" disabled={mutation.isPending}>Create Payslip</Button>
  </form>);
}

export function PayslipList() {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['payslips'], queryFn: () => settingsApi.payslips.list() });
  const qc = useQueryClient();
  const updateStatus = useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) => settingsApi.payslips.updateStatus(id, status), onSuccess: () => { qc.invalidateQueries({ queryKey: ['payslips'] }); toast.success('Status updated'); } });

  return (<div className="space-y-6 p-6 max-w-[1200px]">
    <div className="flex items-center justify-between">
      <div><h1 className="text-2xl font-semibold tracking-tight">Payslips</h1><p className="text-sm text-muted-foreground mt-0.5">Monthly payroll records</p></div>
      <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button className="gap-2"><Plus size={15} />Generate Payslip</Button></DialogTrigger>
        <DialogContent><DialogHeader><DialogTitle>Generate Payslip</DialogTitle></DialogHeader><PayslipForm onSuccess={() => setOpen(false)} /></DialogContent></Dialog>
    </div>
    <Card><CardContent className="p-0"><Table>
      <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Period</TableHead><TableHead>Basic</TableHead><TableHead>HRA</TableHead><TableHead>Allowances</TableHead><TableHead>Deductions</TableHead><TableHead>Net Pay</TableHead><TableHead>Status</TableHead><TableHead className="w-20" /></TableRow></TableHeader>
      <TableBody>{isLoading ? <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
        : !data?.data?.length ? <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No payslips</TableCell></TableRow>
        : data.data.map((p: any) => (<TableRow key={p.id}>
          <TableCell className="font-medium">{p.employee?.user?.name ?? p.employee_id}</TableCell>
          <TableCell>{MONTHS[p.month - 1]} {p.year}</TableCell>
          <TableCell>₹{p.basic}</TableCell><TableCell>₹{p.hra}</TableCell><TableCell>₹{p.allowances}</TableCell><TableCell>₹{p.deductions}</TableCell>
          <TableCell className="font-semibold">₹{p.net_pay}</TableCell>
          <TableCell><Badge variant={p.status === 'paid' ? 'default' : p.status === 'generated' ? 'secondary' : 'outline'} className="capitalize">{p.status}</Badge></TableCell>
          <TableCell><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal size={14} /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {p.status === 'draft' && <DropdownMenuItem onClick={() => updateStatus.mutate({ id: p.id, status: 'generated' })}><CheckCircle size={13} className="mr-2" /> Mark Generated</DropdownMenuItem>}
              {p.status === 'generated' && <DropdownMenuItem onClick={() => updateStatus.mutate({ id: p.id, status: 'paid' })}><CheckCircle size={13} className="mr-2" /> Mark Paid</DropdownMenuItem>}
            </DropdownMenuContent></DropdownMenu></TableCell>
        </TableRow>))}</TableBody>
    </Table></CardContent></Card>
  </div>);
}
