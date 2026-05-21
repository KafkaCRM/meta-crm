import { usePermissions } from '@/hooks/usePermissions';
import { useLabels } from '@/hooks/useLabels';
import { useAuth } from '@/contexts/auth.context';
import { DateRangePicker } from './DateRangePicker';
import { PipelineFunnelWidget } from './widgets/PipelineFunnelWidget';
import { ConversionRateWidget } from './widgets/ConversionRateWidget';
import { StageTimeWidget } from './widgets/StageTimeWidget';
import { InteractionVolumeWidget } from './widgets/InteractionVolumeWidget';
import { PartySourceWidget } from './widgets/PartySourceWidget';
import { MyCasesWidget } from './widgets/MyCasesWidget';
import { MyFollowUpsWidget } from './widgets/MyFollowUpsWidget';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  TrendingUp,
  Plus,
  Activity,
  ArrowUpRight,
  Download,
} from 'lucide-react';
import { Link } from '@tanstack/react-router';

export function Dashboard() {
  const { can } = usePermissions();
  const { t } = useLabels();
  const { user } = useAuth();

  const hasReportPermission = can('read', 'Report');
  const canExport = can('export', 'Report');

  return (
    <div className="space-y-5 max-w-[1280px]">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-medium text-[#111111] tracking-tight">
            {t('dashboard.title') ?? 'Dashboard'}
          </h1>
          <p className="text-sm text-[#9c9fa5] mt-0.5">
            Overview of your workspace activity
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <DateRangePicker />
          {canExport && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs border-[#d3cec6] text-[#626260] hover:bg-[#f5f1ec]"
            >
              <Download size={13} className="mr-1.5" />
              Export
            </Button>
          )}
          <Link to="/parties/new">
            <Button
              size="sm"
              className="bg-[#111111] hover:bg-black text-white rounded-lg text-sm font-medium h-8 px-3"
            >
              <Plus size={14} className="mr-1.5" />
              New {t('party.singular') ?? 'Contact'}
            </Button>
          </Link>
        </div>
      </div>

      {/* Always-visible widgets: My Cases + My Follow-ups */}
      <div className="grid gap-4 lg:grid-cols-2">
        <MyCasesWidget />
        <MyFollowUpsWidget />
      </div>

      {/* Report widgets — with permission gating */}
      {hasReportPermission ? (
        <>
          {/* Metric cards row */}
          <div className="grid gap-4 lg:grid-cols-2">
            <ConversionRateWidget />
            <PipelineFunnelWidget />
          </div>

          {/* Charts row */}
          <div className="grid gap-4 lg:grid-cols-2">
            <InteractionVolumeWidget />
            <StageTimeWidget />
          </div>

          {/* Donut chart + activity */}
          <div className="grid gap-4 lg:grid-cols-3">
            <PartySourceWidget />

            {/* Recent activity card */}
            <Card className="bg-white border-[#d3cec6] rounded-xl shadow-none hover:shadow-md transition-shadow lg:col-span-2">
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
                  { action: 'New contact added', name: 'Sarah Chen', time: '2 min ago', color: '#3b82f6' },
                  { action: 'Deal moved to Proposal', name: 'TechCorp Inc.', time: '18 min ago', color: '#0bdf50' },
                  { action: 'Note added', name: 'James Wilson', time: '1h ago', color: '#9c9fa5' },
                  { action: 'Email sent', name: 'GlobEx Ltd.', time: '2h ago', color: '#3b82f6' },
                  { action: 'Contact converted', name: 'Maria Santos', time: '4h ago', color: '#0bdf50' },
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
      ) : (
        /* Permission-locked state for non-report users */
        <Card className="bg-white border-[#d3cec6] rounded-xl shadow-none relative overflow-hidden">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="absolute inset-0 backdrop-blur-sm bg-white/60 flex items-center justify-center z-10">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-[#f5f1ec] flex items-center justify-center mx-auto mb-3">
                  <TrendingUp size={20} className="text-[#9c9fa5]" />
                </div>
                <h3 className="text-base font-medium text-[#111111] mb-1">Reports not available</h3>
                <p className="text-sm text-[#9c9fa5] max-w-xs">
                  Upgrade your role to view analytics and reports. Contact your administrator.
                </p>
              </div>
            </div>
            <div className="w-12 h-12 rounded-full bg-[#f5f1ec] flex items-center justify-center mb-3 opacity-30">
              <TrendingUp size={20} className="text-[#9c9fa5]" />
            </div>
            <h3 className="text-base font-medium text-[#111111] mb-1 opacity-30">Reports</h3>
            <p className="text-sm text-[#9c9fa5] max-w-xs opacity-30">
              Analytics and reports are locked
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
