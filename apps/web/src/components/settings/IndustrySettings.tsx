import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Check, Sparkles, Building2, BookOpen, HeartPulse, Home, ShoppingCart, Landmark } from 'lucide-react';
import { settingsApi } from '@/api/settings';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/usePermissions';

interface IndustryOption {
  id: string;
  name: string;
  desc: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  terms: {
    partySingular: string;
    partyPlural: string;
    caseSingular: string;
    casePlural: string;
  };
}

const INDUSTRIES: IndustryOption[] = [
  {
    id: 'technology',
    name: 'Technology & SaaS',
    desc: 'Optimized for software, startups, and IT consulting. Uses B2B account-based sales flows.',
    icon: Sparkles,
    terms: {
      partySingular: 'Account',
      partyPlural: 'Accounts',
      caseSingular: 'Pipeline Item',
      casePlural: 'Pipeline',
    },
  },
  {
    id: 'education',
    name: 'Education & Admissions',
    desc: 'Designed for academies, schools, and tutoring centres to track student enrollment.',
    icon: BookOpen,
    terms: {
      partySingular: 'Student',
      partyPlural: 'Students',
      caseSingular: 'Pipeline Item',
      casePlural: 'Pipeline',
    },
  },
  {
    id: 'healthcare',
    name: 'Healthcare & Wellness',
    desc: 'For clinics, practitioners, and therapists to coordinate patient visits.',
    icon: HeartPulse,
    terms: {
      partySingular: 'Patient',
      partyPlural: 'Patients',
      caseSingular: 'Pipeline Item',
      casePlural: 'Pipeline',
    },
  },
  {
    id: 'real-estate',
    name: 'Real Estate & Properties',
    desc: 'For brokers and agencies tracking property buyers, listings, and closures.',
    icon: Home,
    terms: {
      partySingular: 'Client',
      partyPlural: 'Clients',
      caseSingular: 'Pipeline Item',
      casePlural: 'Pipeline',
    },
  },
  {
    id: 'retail',
    name: 'Retail & Commerce',
    desc: 'Perfect for retail operations, dealerships, and high-volume customer orders.',
    icon: ShoppingCart,
    terms: {
      partySingular: 'Customer',
      partyPlural: 'Customers',
      caseSingular: 'Pipeline Item',
      casePlural: 'Pipeline',
    },
  },
  {
    id: 'finance',
    name: 'Financial Services',
    desc: 'Tailored for wealth management, insurance, and accounting client portfolios.',
    icon: Landmark,
    terms: {
      partySingular: 'Client',
      partyPlural: 'Clients',
      caseSingular: 'Pipeline Item',
      casePlural: 'Pipeline',
    },
  },
];

export function IndustrySettings() {
  const { can } = usePermissions();
  const canManage = can('manage', 'FieldDefinition');
  const queryClient = useQueryClient();
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);

  const { data: labels, isLoading: labelsLoading } = useQuery({
    queryKey: ['settings', 'labels'],
    queryFn: () => settingsApi.labels.list(),
    staleTime: 30_000,
  });

  const activeIndustry = labels?._industry || '';

  useEffect(() => {
    if (activeIndustry) {
      setSelectedIndustry(activeIndustry);
    }
  }, [activeIndustry]);

  const applyMutation = useMutation({
    mutationFn: (industry: string) => settingsApi.templates.apply(industry),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'labels'] });
      toast.success('Industry vertical applied successfully. Reloading workspace...');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to apply industry template');
    },
  });

  const handleApply = () => {
    if (!selectedIndustry) return;
    applyMutation.mutate(selectedIndustry);
  };

  if (labelsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1000px]">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Industry Vertical</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Select your industry to customize pipeline stages, layouts, vocabulary, and permissions automatically.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {INDUSTRIES.map((ind) => {
          const Icon = ind.icon;
          const isCurrent = activeIndustry === ind.id;
          const isSelected = selectedIndustry === ind.id;

          return (
            <div
              key={ind.id}
              onClick={() => canManage && setSelectedIndustry(ind.id)}
              className={`relative bg-card border rounded-xl p-5 cursor-pointer transition-all flex flex-col justify-between ${
                isSelected
                  ? 'border-fin-orange ring-1 ring-fin-orange'
                  : 'border-border hover:border-[#beb9b0]'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className={`p-2 rounded-lg ${isSelected ? 'bg-fin-orange/10 text-fin-orange' : 'bg-background text-muted-foreground'}`}>
                    <Icon size={20} />
                  </div>
                  {isCurrent && (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Active Vertical
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">{ind.name}</h3>
                  <p className="text-xs text-muted-foreground leading-normal">{ind.desc}</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-[#f1efe9] grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <span className="text-muted-foreground block uppercase font-semibold tracking-wider">Contact Term</span>
                  <span className="text-foreground font-medium mt-0.5 block">{ind.terms.partySingular} ({ind.terms.partyPlural})</span>
                </div>
                <div>
                  <span className="text-muted-foreground block uppercase font-semibold tracking-wider">Deal / Case Term</span>
                  <span className="text-foreground font-medium mt-0.5 block">{ind.terms.caseSingular} ({ind.terms.casePlural})</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {canManage && (
        <Card className="bg-card border-border rounded-xl shadow-none">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <Building2 size={16} className="text-muted-foreground" />
              Configure System Settings
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Applying a new vertical will provision custom fields and set up default pipeline stages.
            </CardDescription>
          </CardHeader>
          <CardFooter className="p-4 bg-background border-t border-border flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground max-w-md">
              Warning: Applying a template will overwrite existing system label overrides and roles. Custom field data is preserved.
            </p>
            <Button
              disabled={applyMutation.isPending || !selectedIndustry || selectedIndustry === activeIndustry}
              onClick={handleApply}
              className="bg-primary hover:bg-[#1e293b] text-white text-xs font-semibold h-9 px-4 rounded-md transition-colors shrink-0"
            >
              {applyMutation.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Apply {selectedIndustry ? INDUSTRIES.find(i => i.id === selectedIndustry)?.name : 'Vertical'}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
