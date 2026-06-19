import { DateRangePicker } from '@/components/dashboard/DateRangePicker';
import { PipelineFunnelWidget } from '@/components/dashboard/widgets/PipelineFunnelWidget';
import { ConversionRateWidget } from '@/components/dashboard/widgets/ConversionRateWidget';
import { StageTimeWidget } from '@/components/dashboard/widgets/StageTimeWidget';
import { InteractionVolumeWidget } from '@/components/dashboard/widgets/InteractionVolumeWidget';
import { PartySourceWidget } from '@/components/dashboard/widgets/PartySourceWidget';
import { usePermissions } from '@/hooks/usePermissions';

export function ReportsPage() {
  const { can } = usePermissions();
  const canView = can('read', 'Report');

  return (
    <div className="space-y-6 max-w-[1400px] animate-in fade-in duration-200">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Pipeline performance, conversion metrics, and activity trends
          </p>
        </div>
        <DateRangePicker />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ConversionRateWidget hasPermission={canView} />
        <PipelineFunnelWidget hasPermission={canView} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <InteractionVolumeWidget hasPermission={canView} />
        <PartySourceWidget hasPermission={canView} />
      </div>

      <div className="grid gap-6 lg:grid-cols-1">
        <StageTimeWidget hasPermission={canView} />
      </div>
    </div>
  );
}
