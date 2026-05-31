import { useState } from 'react';
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
import { DailyPriorities } from './widgets/DailyPriorities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  TrendingUp,
  Plus,
  Activity,
  Download,
  GripVertical
} from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { useCapabilities } from '@/hooks/useCapabilities';
import { AppointmentsWidget } from './widgets/AppointmentsWidget';
import { BillingWidget } from './widgets/BillingWidget';
import { PropertiesWidget } from './widgets/PropertiesWidget';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { 
  DndContext, 
  DragEndEvent, 
  useSensor, 
  useSensors, 
  PointerSensor, 
  KeyboardSensor,
  closestCenter
} from '@dnd-kit/core';
import { 
  SortableContext, 
  useSortable, 
  rectSortingStrategy,
  sortableKeyboardCoordinates 
} from '@dnd-kit/sortable';
const transformToString = (transform: any) => {
  if (!transform) return undefined;
  return `translate3d(${transform.x}px, ${transform.y}px, 0) scaleX(${transform.scaleX ?? 1}) scaleY(${transform.scaleY ?? 1})`;
};

interface SortableWidgetProps {
  id: string;
  children: React.ReactNode;
  className?: string;
}

function SortableWidgetContainer({ id, children, className }: SortableWidgetProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: transformToString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 40 : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style} className={cn("relative group/widget", className)}>
      {/* Hover Grab Handle for reordering */}
      <div 
        {...attributes} 
        {...listeners} 
        className="absolute top-3 right-3 z-30 cursor-grab active:cursor-grabbing text-muted-foreground/70 hover:text-muted-foreground bg-card/95 border border-border/60 p-1.5 rounded-lg shadow-sm opacity-0 group-hover/widget:opacity-100 transition-all scale-90 hover:scale-100"
        title="Drag to reorder widget"
      >
        <GripVertical size={13} />
      </div>
      {children}
    </div>
  );
}

export function Dashboard() {
  const { can } = usePermissions();
  const { t } = useLabels();
  const { user } = useAuth();
  const { isEnabled } = useCapabilities();

  const hasReportPermission = can('read', 'Report');
  const canExport = can('export', 'Report');

  // Dynamic Dashboard widget layout reordering state
  const [widgetOrder, setWidgetOrder] = useState<string[]>([
    'conversion-rate',
    'pipeline-funnel',
    'interaction-volume',
    'stage-time',
    'party-source',
    'recent-activity',
  ]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = widgetOrder.indexOf(String(active.id));
    const newIndex = widgetOrder.indexOf(String(over.id));

    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = [...widgetOrder];
      const [removed] = newOrder.splice(oldIndex, 1);
      if (removed) {
        newOrder.splice(newIndex, 0, removed);
      }
      setWidgetOrder(newOrder);
      toast.success('Dashboard widgets layout updated');
    }
  };

  const widgetsMap: Record<string, React.ReactNode> = {
    'conversion-rate': <ConversionRateWidget />,
    'pipeline-funnel': <PipelineFunnelWidget />,
    'interaction-volume': <InteractionVolumeWidget />,
    'stage-time': <StageTimeWidget />,
    'party-source': <PartySourceWidget />,
    'recent-activity': (
      <Card className="bg-card border-border rounded-xl shadow-none hover:shadow-md transition-shadow h-full flex flex-col justify-between overflow-hidden">
        <CardHeader className="pb-3 bg-muted/20 border-b border-border">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-foreground">
              Recent Activity
            </CardTitle>
            <Badge
              variant="secondary"
              className="bg-background text-muted-foreground border-0 text-xs rounded-md"
            >
              <Activity size={11} className="mr-1 text-emerald-500 animate-pulse" />
              Live
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-2 p-0 flex-1 divide-y divide-[#e2e8f0]">
          {[
            { action: 'New contact added', name: 'Sarah Chen', time: '2 min ago', color: '#3b82f6' },
            { action: 'Deal moved to Proposal', name: 'TechCorp Inc.', time: '18 min ago', color: '#0bdf50' },
            { action: 'Note added', name: 'James Wilson', time: '1h ago', color: '#94a3b8' },
            { action: 'Email sent', name: 'GlobEx Ltd.', time: '2h ago', color: '#3b82f6' },
            { action: 'Contact converted', name: 'Maria Santos', time: '4h ago', color: '#0bdf50' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 p-3.5 hover:bg-muted/20 transition-colors">
              <div
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <div className="flex-1 min-w-0">
                <span className="text-xs text-muted-foreground">{item.action} · </span>
                <span className="text-xs font-semibold text-foreground">{item.name}</span>
              </div>
              <span className="text-[10px] text-muted-foreground flex-shrink-0">{item.time}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    ),
  };

  return (
    <div className="space-y-5 max-w-[1280px]">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">
            {t('dashboard.title') ?? 'Dashboard'}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Overview of your workspace activity
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <DateRangePicker />
          {canExport && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs border-border text-muted-foreground hover:bg-background"
            >
              <Download size={13} className="mr-1.5" />
              Export
            </Button>
          )}
          <Link to="/parties/new">
            <Button
              size="sm"
              className="bg-primary hover:bg-[#1e293b] text-white rounded-lg text-xs font-semibold h-8 px-3"
            >
              <Plus size={14} className="mr-1.5" />
              New {t('party.singular') ?? 'Contact'}
            </Button>
          </Link>
        </div>
      </div>

      {/* Always-visible widgets: My Cases + My Follow-ups + Daily Priorities checklist */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <MyCasesWidget />
        <MyFollowUpsWidget />
        <DailyPriorities />
      </div>

      {/* Dynamic Capability Overviews */}
      {(isEnabled('capability/appointment') || isEnabled('capability/billing') || isEnabled('capability/property-listing')) && (
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {isEnabled('capability/appointment') && <AppointmentsWidget />}
          {isEnabled('capability/billing') && <BillingWidget />}
          {isEnabled('capability/property-listing') && <PropertiesWidget />}
        </div>
      )}

      {/* Report widgets — with permission gating */}
      {hasReportPermission ? (
        <DndContext 
          sensors={sensors} 
          collisionDetection={closestCenter} 
          onDragEnd={handleDragEnd}
        >
          <SortableContext 
            items={widgetOrder} 
            strategy={rectSortingStrategy}
          >
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6 items-stretch">
              {widgetOrder.map((id) => {
                const widgetNode = widgetsMap[id];
                if (!widgetNode) return null;

                // Dynamically resolve grid columns span sizes for clean aesthetics
                let colSpan = 'lg:col-span-3'; // Default is half width (3 of 6 columns)
                if (id === 'party-source') {
                  colSpan = 'lg:col-span-2'; // 1/3 width
                } else if (id === 'recent-activity') {
                  colSpan = 'lg:col-span-4'; // 2/3 width
                }

                return (
                  <SortableWidgetContainer key={id} id={id} className={colSpan}>
                    {widgetNode}
                  </SortableWidgetContainer>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        /* Permission-locked state for non-report users */
        <Card className="bg-card border-border rounded-xl shadow-none relative overflow-hidden">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="absolute inset-0 backdrop-blur-sm bg-card/60 flex items-center justify-center z-10">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-background flex items-center justify-center mx-auto mb-3">
                  <TrendingUp size={20} className="text-muted-foreground" />
                </div>
                <h3 className="text-base font-medium text-foreground mb-1">Reports not available</h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Upgrade your role to view analytics and reports. Contact your administrator.
                </p>
              </div>
            </div>
            <div className="w-12 h-12 rounded-full bg-background flex items-center justify-center mb-3 opacity-30">
              <TrendingUp size={20} className="text-muted-foreground" />
            </div>
            <h3 className="text-base font-medium text-foreground mb-1 opacity-30">Reports</h3>
            <p className="text-sm text-muted-foreground max-w-xs opacity-30">
              Analytics and reports are locked
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
