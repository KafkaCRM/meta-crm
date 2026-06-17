import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsApi } from '@/api/leads';
import { settingsApi } from '@/api/settings';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Link } from '@tanstack/react-router';
import { ShieldAlert, ArrowRight, UserCheck, Phone, Mail, FileText, Calendar, Building } from 'lucide-react';
import dayjs from 'dayjs';

interface LeadDetailProps {
  leadId: string;
  onClose?: () => void;
  onChanged?: () => void;
}

export function LeadDetail({ leadId, onClose, onChanged }: LeadDetailProps) {
  const queryClient = useQueryClient();
  const [showConvertForm, setShowConvertForm] = useState(false);

  // Form State
  const [assignmentId, setAssignmentId] = useState('');
  const { data: lead, isLoading: leadLoading } = useQuery({
    queryKey: ['lead', leadId],
    queryFn: () => leadsApi.get(leadId),
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['settings', 'assignments'],
    queryFn: () => settingsApi.assignments.list(),
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['settings', 'branches'],
    queryFn: () => settingsApi.branches.list ? settingsApi.branches.list() : [],
  });

  const { data: brands = [] } = useQuery({
    queryKey: ['settings', 'brands'],
    queryFn: () => settingsApi.brands.list(),
  });

  // Map assignment options
  const assignmentOptions = useMemo(() => {
    return assignments.map((ass) => {
      const branch = branches.find((b) => b.id === ass.branch_id);
      const brand = brands.find((b) => b.id === ass.brand_id);
      return {
        id: ass.id,
        label: `${brand?.name ?? 'Brand'} — ${branch?.name ?? 'Branch'}`,
      };
    });
  }, [assignments, branches, brands]);

  // Set default assignment from first option
  useMemo(() => {
    if (assignments.length > 0 && !assignmentId) {
      setAssignmentId(assignments[0]?.id || '');
    }
  }, [assignments, assignmentId]);

  const convertMutation = useMutation({
    mutationFn: (data: { branch_brand_assignment_id: string }) => leadsApi.convert(leadId, data),
    onSuccess: () => {
      toast.success('Lead promoted to Contact!');
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      if (onChanged) onChanged();
      setShowConvertForm(false);
    },
    onError: (err: any) => {
      toast.error(err?.message ?? 'Failed to promote lead');
    },
  });

  const handleConvert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignmentId) {
      toast.error('Please select a Branch/Brand assignment');
      return;
    }
    convertMutation.mutate({
      branch_brand_assignment_id: assignmentId,
    });
  };

  if (leadLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
        Loading lead details...
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-red-500">
        <ShieldAlert size={16} />
        <span>Lead not found</span>
      </div>
    );
  }

  const isConverted = lead.status === 'converted';

  return (
    <div className="space-y-6">
      {/* Profile Overview */}
      <div className="flex items-start justify-between gap-4 border-b border-border pb-5">
        <div>
          <h2 className="text-xl font-bold text-foreground leading-tight">{lead.name}</h2>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className="capitalize">
              Source: {lead.source}
            </Badge>
            <Badge variant={isConverted ? 'success' : 'default'} className="capitalize">
              {lead.status}
            </Badge>
          </div>
        </div>
        {!isConverted && !showConvertForm && (
          <div className="flex items-center gap-2">
            {assignments.length > 0 && (
              <Button
                onClick={() => {
                  const defaultAssignmentId = assignmentId || assignments[0]?.id;
                  if (!defaultAssignmentId) {
                    toast.error('No office assignment available');
                    return;
                  }
                  convertMutation.mutate({
                    branch_brand_assignment_id: defaultAssignmentId,
                  });
                }}
                disabled={convertMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5 h-9 text-xs rounded-lg font-bold"
              >
                <UserCheck size={14} />
                Quick Convert
              </Button>
            )}
            <Button
              onClick={() => setShowConvertForm(true)}
              variant="outline"
              className="border-border text-foreground hover:bg-slate-100 flex items-center gap-1.5 h-9 text-xs rounded-lg font-bold"
            >
              Convert Settings...
            </Button>
          </div>
        )}
      </div>

      {/* Main Details */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-4">
          <div className="flex items-center gap-2.5 text-sm text-foreground">
            <Phone size={14} className="text-muted-foreground" />
            <span className="font-semibold select-all font-mono">{lead.phone}</span>
          </div>
          <div className="flex items-center gap-2.5 text-sm text-foreground">
            <Mail size={14} className="text-muted-foreground" />
            <span className="truncate select-all">{lead.email || 'No email provided'}</span>
          </div>
          <div className="flex items-center gap-2.5 text-sm text-foreground">
            <Calendar size={14} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Ingested on {dayjs(lead.created_at).format('DD MMMM YYYY, hh:mm A')}
            </span>
          </div>
        </div>

        {/* Custom attributes display */}
        {lead.attributes && Object.keys(lead.attributes).length > 0 && (
          <div className="bg-background/40 p-3 rounded-lg border border-border">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Form Attributes</h4>
            <div className="space-y-1.5 text-xs">
              {Object.entries(lead.attributes).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between border-b border-border/40 pb-1 last:border-0 last:pb-0">
                  <span className="text-muted-foreground capitalize">{k.replace(/_/g, ' ')}:</span>
                  <span className="font-medium text-foreground">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {lead.notes && (
        <div className="space-y-1.5 border-t border-border pt-4">
          <h4 className="text-xs font-semibold text-foreground">Notes</h4>
          <p className="text-xs text-muted-foreground bg-background/50 p-2.5 rounded-lg border leading-relaxed">
            {lead.notes}
          </p>
        </div>
      )}

      {/* Conversion Result */}
      {isConverted && (
        <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl space-y-3">
          <div className="flex items-center gap-2 text-emerald-800">
            <UserCheck size={16} />
            <span className="text-xs font-bold uppercase tracking-wide">Promoted to Contact</span>
          </div>
          <p className="text-xs text-emerald-700">
            This lead has been promoted to a Contact in your workspace.
          </p>
          {lead.party_id && (
            <Link
              to={`/parties/$id`}
              params={{ id: lead.party_id }}
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1.5"
              onClick={onClose}
            >
              <ArrowRight size={12} />
              View Contact Profile
            </Link>
          )}
        </div>
      )}

      {/* Inline Convert Form */}
      {showConvertForm && (
        <form onSubmit={handleConvert} className="bg-background p-4 rounded-xl border border-border shadow-xs space-y-4 pt-4">
          <h3 className="text-sm font-bold text-foreground">Promote to Contact</h3>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Assign to Branch / Brand Office
            </Label>
            <Select value={assignmentId} onValueChange={setAssignmentId}>
              <SelectTrigger className="h-9 border-border bg-card">
                <SelectValue placeholder="Select branch & brand assignment..." />
              </SelectTrigger>
              <SelectContent>
                {assignmentOptions.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowConvertForm(false)}
              className="border-border text-foreground hover:bg-background h-8 rounded-lg font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={convertMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5 h-8 text-xs rounded-lg font-bold"
            >
              {convertMutation.isPending ? 'Promoting...' : 'Confirm & Promote'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
