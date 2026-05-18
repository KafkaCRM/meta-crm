import { usePermissions } from '@/hooks/usePermissions';
import { useLabels } from '@/hooks/useLabels';
import { DateRangePicker } from './DateRangePicker';
import { PipelineFunnelWidget } from './widgets/PipelineFunnelWidget';
import { ConversionRateWidget } from './widgets/ConversionRateWidget';
import { StageTimeWidget } from './widgets/StageTimeWidget';
import { InteractionVolumeWidget } from './widgets/InteractionVolumeWidget';
import { PartySourceWidget } from './widgets/PartySourceWidget';

export function Dashboard() {
  const { can } = usePermissions();
  const { t } = useLabels();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('dashboard.title') ?? 'Dashboard'}</h1>
        <DateRangePicker />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {can('read', 'Report') && (
          <>
            <ConversionRateWidget />
            <PipelineFunnelWidget />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {can('read', 'Report') && (
          <>
            <StageTimeWidget />
            <InteractionVolumeWidget />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {can('read', 'Report') && (
          <PartySourceWidget />
        )}
      </div>
    </div>
  );
}
