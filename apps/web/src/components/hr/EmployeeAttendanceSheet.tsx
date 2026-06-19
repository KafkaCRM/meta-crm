import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useMemo } from 'react';
import { Save, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { settingsApi } from '@/api/settings';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const STATUS_OPTIONS = ['present', 'absent', 'late', 'half-day'];
const STATUS_COLORS: Record<string, string> = { present: 'bg-emerald-100 text-emerald-700', absent: 'bg-red-100 text-red-700', late: 'bg-amber-100 text-amber-700', 'half-day': 'bg-orange-100 text-orange-700' };

export function EmployeeAttendanceSheet() {
  const today = new Date().toISOString().split('T')[0]!;
  const [date, setDate] = useState(today);
  const [departmentId, setDepartmentId] = useState('');
  const [records, setRecords] = useState<Record<string, { status: string; check_in: string; check_out: string }>>({});
  const qc = useQueryClient();

  const { data: employees } = useQuery({ queryKey: ['employees', departmentId], queryFn: () => settingsApi.employees.list({ department_id: departmentId || undefined, limit: 500 }) });
  const { data: existingAttn } = useQuery({ queryKey: ['employee-attendance', date, departmentId], queryFn: () => settingsApi.employeeAttendance.findByDate({ date, department_id: departmentId }) });

  useEffect(() => {
    if (!existingAttn || !Array.isArray(existingAttn)) return;
    const map: Record<string, { status: string; check_in: string; check_out: string }> = {};
    for (const a of existingAttn) {
      map[a.employee_id] = {
        status: a.status ?? 'present',
        check_in: a.check_in ? new Date(a.check_in).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
        check_out: a.check_out ? new Date(a.check_out).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
      };
    }
    setRecords((prev) => {
      const merged = { ...prev };
      for (const [eid, v] of Object.entries(map)) merged[eid] = v;
      return merged;
    });
  }, [existingAttn]);

  const employeeList = useMemo(() => employees?.data ?? [], [employees]);

  useEffect(() => {
    if (!employeeList.length) return;
    setRecords((prev) => {
      const next = { ...prev };
      for (const emp of employeeList) {
        if (!next[emp.id]) next[emp.id] = { status: 'present', check_in: '', check_out: '' };
      }
      return next;
    });
  }, [employeeList.length]);

  const bulkMutation = useMutation({
    mutationFn: () => {
      const recs: { employee_id: string; status: string; check_in?: string; check_out?: string }[] = [];
      for (const e of employeeList) {
        const r = records[e.id];
        if (!r) continue;
        const item: { employee_id: string; status: string; check_in?: string; check_out?: string } = { employee_id: e.id, status: r.status };
        if (r.check_in) item.check_in = r.check_in;
        if (r.check_out) item.check_out = r.check_out;
        recs.push(item);
      }
      return settingsApi.employeeAttendance.bulkMark({ date, records: recs });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employee-attendance'] }); toast.success('Attendance saved'); },
    onError: () => toast.error('Failed to save attendance'),
  });

  return (<div className="space-y-6 p-6 max-w-[1200px]">
    <div className="flex items-center justify-between">
      <div><h1 className="text-2xl font-semibold tracking-tight">Employee Attendance</h1><p className="text-sm text-muted-foreground mt-0.5">Mark daily attendance</p></div>
      <Button className="gap-2" onClick={() => bulkMutation.mutate()} disabled={bulkMutation.isPending || !employeeList.length}>
        <Save size={15} />{bulkMutation.isPending ? 'Saving...' : 'Save All'}
      </Button>
    </div>
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2"><Calendar size={15} className="text-muted-foreground" /><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" /></div>
      <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm w-48">
        <option value="">All departments</option>
        {employees?.data?.filter((e: any, i: number, a: any[]) => a.findIndex((x: any) => x.department?.id === e.department?.id) === i).map((e: any) =>
          e.department ? <option key={e.department.id} value={e.department.id}>{e.department.name}</option> : null
        )}
      </select>
    </div>
    <Card><CardContent className="p-0"><Table>
      <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Code</TableHead><TableHead>Department</TableHead><TableHead>Status</TableHead><TableHead>Check In</TableHead><TableHead>Check Out</TableHead></TableRow></TableHeader>
      <TableBody>{!employeeList.length ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No employees found</TableCell></TableRow>
        : employeeList.map((emp: any) => {
          const rec = records[emp.id] ?? { status: 'present', check_in: '', check_out: '' };
          return (<TableRow key={emp.id}>
            <TableCell className="font-medium">{emp.user?.name ?? '-'}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{emp.employee_code}</TableCell>
            <TableCell className="text-sm">{emp.department?.name ?? '-'}</TableCell>
            <TableCell>
              <select value={rec.status} onChange={(e) => setRecords((p) => ({ ...p, [emp.id]: { ...p[emp.id], status: e.target.value } }))}
                className="flex h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs">
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <Badge variant="outline" className={`ml-2 capitalize ${STATUS_COLORS[rec.status] ?? ''}`}>{rec.status}</Badge>
            </TableCell>
            <TableCell><Input type="time" value={rec.check_in} onChange={(e) => setRecords((p) => ({ ...p, [emp.id]: { ...p[emp.id], check_in: e.target.value } }))} className="w-28 h-8" /></TableCell>
            <TableCell><Input type="time" value={rec.check_out} onChange={(e) => setRecords((p) => ({ ...p, [emp.id]: { ...p[emp.id], check_out: e.target.value } }))} className="w-28 h-8" /></TableCell>
          </TableRow>);
        })}</TableBody>
    </Table></CardContent></Card>
  </div>);
}
