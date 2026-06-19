import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, Search, MoreHorizontal, DollarSign, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { settingsApi } from '@/api/settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

function StudentFeeForm({ onSuccess }: { onSuccess: () => void }) {
  const queryClient = useQueryClient();
  const [enrollmentId, setEnrollmentId] = useState('');
  const [feePlanId, setFeePlanId] = useState('');
  const [totalFee, setTotalFee] = useState('');
  const [discountAmount, setDiscountAmount] = useState('0');

  const { data: feePlans } = useQuery({
    queryKey: ['fee-plans'],
    queryFn: () => settingsApi.feePlans.list(),
  });

  const mutation = useMutation({
    mutationFn: (data: any) => settingsApi.studentFees.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-fees'] });
      toast.success('Student fee record created');
      onSuccess();
    },
    onError: () => toast.error('Failed to create student fee'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      enrollment_id: enrollmentId,
      fee_plan_id: feePlanId || undefined,
      total_fee: Number(totalFee),
      discount_amount: Number(discountAmount) || 0,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Enrollment ID</Label>
        <Input value={enrollmentId} onChange={(e) => setEnrollmentId(e.target.value)} required placeholder="Enter enrollment ID" />
      </div>
      <div className="space-y-2">
        <Label>Fee Plan (optional)</Label>
        <select value={feePlanId} onChange={(e) => setFeePlanId(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
          <option value="">No plan (manual installments)</option>
          {feePlans?.data?.map((p: any) => (
            <option key={p.id} value={p.id}>{p.name} - ₹{p.total_fee}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Total Fee</Label>
          <Input type="number" value={totalFee} onChange={(e) => setTotalFee(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Discount</Label>
          <Input type="number" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={mutation.isPending}>Create Student Fee</Button>
    </form>
  );
}

export function StudentFeeList() {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['student-fees'],
    queryFn: () => settingsApi.studentFees.list(),
  });

  const queryClient = useQueryClient();
  const removeMutation = useMutation({
    mutationFn: (id: string) => settingsApi.studentFees.remove(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['student-fees'] }); toast.success('Fee record deleted'); },
    onError: () => toast.error('Failed to delete fee record'),
  });

  return (
    <div className="space-y-6 p-6 max-w-[1200px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Student Fees</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track fee collection per student</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus size={15} />Add Student Fee</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Student Fee</DialogTitle></DialogHeader>
            <StudentFeeForm onSuccess={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Fee Plan</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
              ) : !data?.data?.length ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No student fee records</TableCell></TableRow>
              ) : data.data.map((fee: any) => (
                <TableRow key={fee.id}>
                  <TableCell className="font-medium">{fee.enrollment?.party?.name ?? fee.enrollment_id}</TableCell>
                  <TableCell>{fee.feePlan?.name ?? 'Manual'}</TableCell>
                  <TableCell>₹{fee.net_fee}</TableCell>
                  <TableCell>₹{fee.paid_amount}</TableCell>
                  <TableCell>₹{fee.net_fee - fee.paid_amount}</TableCell>
                  <TableCell>
                    <Badge variant={fee.status === 'paid' ? 'default' : fee.status === 'partial' ? 'secondary' : 'outline'} className="capitalize">{fee.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal size={14} /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="text-destructive" onClick={() => removeMutation.mutate(fee.id)}><Trash2 size={13} className="mr-2" /> Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
