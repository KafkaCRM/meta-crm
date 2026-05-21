import { Drawer } from 'vaul';
import { X, ExternalLink, Clock, User, Calendar } from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { cn } from '@/lib/utils';
import type { CaseDto } from '@meta-crm/types';

dayjs.extend(relativeTime);

interface CardQuickViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseData: CaseDto;
  stageName: string;
}

export function CardQuickView({ open, onOpenChange, caseData, stageName }: CardQuickViewProps) {
  const attributeEntries = Object.entries(caseData.attributes ?? {});

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} direction="right">
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Drawer.Content className="fixed right-0 top-0 bottom-0 z-50 w-[400px] bg-background border-l border-border flex flex-col">
          <div className="flex items-start justify-between px-6 py-4 border-b">
            <div className="space-y-1">
              <Drawer.Title className="text-lg font-semibold">{caseData.title}</Drawer.Title>
              <Drawer.Description className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {stageName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {caseData.type}
                </span>
              </Drawer.Description>
            </div>
            <Drawer.Close className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Drawer.Close>
          </div>

          <div className="px-6 py-4 space-y-4 overflow-auto flex-1">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4" />
                <span>{caseData.assigned_to_id ? 'Assigned' : 'Unassigned'}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Created {dayjs(caseData.created_at).fromNow()}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground col-span-2">
                <Clock className="h-4 w-4" />
                <span>Stage changed {dayjs(caseData.last_stage_changed_at).fromNow()}</span>
              </div>
            </div>

            {attributeEntries.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2">Attributes</h3>
                <div className="rounded-lg border divide-y">
                  {attributeEntries.map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="text-muted-foreground capitalize">{key}</span>
                      <span className="font-medium">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-medium mb-2">Last Interaction</h3>
              <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                No interactions recorded yet.
              </div>
            </div>
          </div>

          <div className="flex flex-row justify-end gap-2 border-t px-6 py-4">
            <Drawer.Close asChild>
              <button className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">
                Close
              </button>
            </Drawer.Close>
            <button
              className={cn(
                'rounded-md bg-primary px-4 py-2 text-sm font-medium',
                'text-primary-foreground hover:bg-primary/90',
                'flex items-center gap-2',
              )}
              onClick={() => {
                onOpenChange(false);
                window.location.href = `/cases/${caseData.id}`;
              }}
            >
              <ExternalLink className="h-4 w-4" />
              Open Full Detail
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
