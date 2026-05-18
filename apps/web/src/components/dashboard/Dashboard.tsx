import { usePermissions } from '@/hooks/usePermissions';
import { useLabels } from '@/hooks/useLabels';
import { DateRangePicker } from './DateRangePicker';
import { PipelineFunnelWidget } from './widgets/PipelineFunnelWidget';
import { ConversionRateWidget } from './widgets/ConversionRateWidget';
import { StageTimeWidget } from './widgets/StageTimeWidget';
import { InteractionVolumeWidget } from './widgets/InteractionVolumeWidget';
import { PartySourceWidget } from './widgets/PartySourceWidget';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  TrendingUp,
  TrendingDown,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Activity,
} from 'lucide-react';
import { Link } from '@tanstack/react-router';

/* ------------------------------------------------------------------ */
/*  Stat Card — DESIGN.md: white floating card on cream canvas        */
/* ------------------------------------------------------------------ */

interface StatCardProps {
  label: string;
  value: string;
  change?: number;
  changeLabel?: string;
  accent?: string;
}

function StatCard({ label, value, change, changeLabel, accent }: StatCardProps) {
  const isPositive = (change ?? 0) >= 0;

  return (
    <Card className="bg-white border-[#d3cec6] rounded-xl shadow-none">
      <CardContent className="pt-5 pb-5">
        <p className="text-xs font-medium text-[#9c9fa5] uppercase tracking-wider mb-2">{label}</p>
        <p className="text-3xl font-medium text-[#111111] tracking-tight mb-2">{value}</p>
        {change !== undefined && (
          <div className="flex items-center gap-1">
            {isPositive ? (
              <ArrowUpRight size={13} className="text-[#0bdf50]" />
            ) : (
              <ArrowDownRight size={13} className="text-[#c41c1c]" />
            )}
            <span className={`text-xs font-medium ${isPositive ? 'text-[#0bdf50]' : 'text-[#c41c1c]'}`}>
              {isPositive ? '+' : ''}{change}%
            </span>
            {changeLabel && (
              <span className="text-xs text-[#9c9fa5]">{changeLabel}</span>
            )}
          </div>
        )}
        {accent && (
          <div className="mt-2 w-full h-0.5 rounded-full" style={{ backgroundColor: accent }} />
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Quick actions bar                                                  */
/* ------------------------------------------------------------------ */

function QuickActions() {
  return (
    <div className="flex items-center gap-2">
      <Link to="/parties/new">
        <Button
          size="sm"
          className="bg-[#111111] hover:bg-black text-white rounded-lg text-sm font-medium h-8 px-3"
        >
          <Plus size={14} className="mr-1.5" />
          New Contact
        </Button>
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Dashboard page                                                     */
/* ------------------------------------------------------------------ */

export function Dashboard() {
  const { can } = usePermissions();
  const { t } = useLabels();

  return (
    <div className="space-y-6 max-w-[1280px]">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-[#111111] tracking-tight">
            {t('dashboard.title') ?? 'Dashboard'}
          </h1>
          <p className="text-sm text-[#9c9fa5] mt-0.5">
            Overview of your workspace activity
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker />
          <QuickActions />
        </div>
      </div>

      {/* KPI stat row */}
      {can('read', 'Report') && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Contacts"
            value="2,847"
            change={12.5}
            changeLabel="vs last month"
            accent="#65b5ff"
          />
          <StatCard
            label="Conversion Rate"
            value="18.4%"
            change={2.1}
            changeLabel="vs last month"
            accent="#0bdf50"
          />
          <StatCard
            label="Pipeline Value"
            value="$1.2M"
            change={-3.4}
            changeLabel="vs last month"
            accent="#ff2067"
          />
          <StatCard
            label="Avg. Response Time"
            value="4.2h"
            change={-18}
            changeLabel="improvement"
            accent="#b3e01c"
          />
        </div>
      )}

      {/* Main widgets */}
      {can('read', 'Report') && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <ConversionRateWidget />
            <PipelineFunnelWidget />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <StageTimeWidget />
            <InteractionVolumeWidget />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <PartySourceWidget />
            </div>

            {/* Recent activity card */}
            <Card className="bg-white border-[#d3cec6] rounded-xl shadow-none lg:col-span-2">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-medium text-[#111111]">
                    Recent Activity
                  </CardTitle>
                  <Badge
                    variant="secondary"
                    className="bg-[#f5f1ec] text-[#626260] border-0 text-xs rounded-md"
                  >
                    <Activity size={11} className="mr-1" />
                    Live
                  </Badge>
                </div>
              </CardHeader>
              <Separator className="bg-[#ebe7e1]" />
              <CardContent className="pt-4">
                {[
                  { action: 'New contact added', name: 'Sarah Chen', time: '2 min ago', color: '#65b5ff' },
                  { action: 'Deal moved to Proposal', name: 'TechCorp Inc.', time: '18 min ago', color: '#0bdf50' },
                  { action: 'Note added', name: 'James Wilson', time: '1h ago', color: '#b3e01c' },
                  { action: 'Email sent', name: 'GlobEx Ltd.', time: '2h ago', color: '#03b2cb' },
                  { action: 'Contact converted', name: 'Maria Santos', time: '4h ago', color: '#ff5600' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 py-2.5 border-b border-[#ebe7e1] last:border-0">
                    <div
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-[#626260]">{item.action} · </span>
                      <span className="text-sm font-medium text-[#111111]">{item.name}</span>
                    </div>
                    <span className="text-xs text-[#9c9fa5] flex-shrink-0">{item.time}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Empty state when no report access */}
      {!can('read', 'Report') && (
        <Card className="bg-white border-[#d3cec6] rounded-xl shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-10 h-10 rounded-full bg-[#f5f1ec] flex items-center justify-center mb-3">
              <TrendingUp size={20} className="text-[#9c9fa5]" />
            </div>
            <h3 className="text-base font-medium text-[#111111] mb-1">Reports not available</h3>
            <p className="text-sm text-[#9c9fa5] max-w-xs">
              You don't have permission to view reports. Contact your administrator.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
