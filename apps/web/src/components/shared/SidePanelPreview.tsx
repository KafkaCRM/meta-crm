import { useEffect } from 'react';
import { X, ExternalLink, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { partiesApi } from '@/api/parties';
import { RecordLayout } from './RecordLayout';
import { useLabels } from '@/hooks/useLabels';
import { useNavigate } from '@tanstack/react-router';

interface SidePanelPreviewProps {
  isOpen: boolean;
  recordId: string | null;
  objectType: string;
  onClose: () => void;
}

export function SidePanelPreview({ isOpen, recordId, objectType, onClose }: SidePanelPreviewProps) {
  const { t } = useLabels();
  const navigate = useNavigate();

  // Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const { data: record, isLoading, error } = useQuery({
    queryKey: ['parties', recordId],
    queryFn: () => recordId ? partiesApi.get(recordId) : Promise.resolve(null),
    enabled: !!recordId && objectType === 'Party',
  });

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop overlay */}
      <div 
        className="fixed inset-0 z-40 bg-slate-900/10 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Slide-over Drawer Panel */}
      <div className="fixed right-0 top-0 h-full w-full sm:w-[460px] bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col justify-between animate-in slide-in-from-right duration-200">
        
        {/* Drawer Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 select-none">
              Record Workspace Preview
            </h3>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5 select-none">
              Quick Inspector Mode
            </p>
          </div>
          
          <div className="flex items-center gap-1.5">
            {recordId && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  navigate({ to: `/parties/${recordId}` });
                  onClose();
                }}
                title="Open full record details tab"
                className="h-7 w-7 rounded-md border-slate-200 hover:bg-slate-100 text-slate-500"
              >
                <ExternalLink size={13} />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-7 w-7 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700"
            >
              <X size={14} className="stroke-[2.5]" />
            </Button>
          </div>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 no-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full py-20 space-y-3">
              <span className="animate-spin h-6 w-6 border-2 border-slate-200 border-t-slate-600 rounded-full inline-block" />
              <p className="text-xs text-slate-500 font-medium">Resolving record metadata layout...</p>
            </div>
          ) : error || !record ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
              <div className="p-3 bg-red-50 text-red-500 border border-red-100 rounded-full">
                <ShieldAlert size={20} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800">Resolve Failed</h4>
                <p className="text-[11px] text-slate-500 max-w-xs mt-1">
                  Could not retrieve record contents. Verify your active connectivity scope.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#0f172a] text-white flex items-center justify-center font-bold text-xs">
                  {record.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">{record.name}</h4>
                  <p className="text-[10px] text-slate-400 font-semibold capitalize mt-0.5">
                    {record.type} · Lead Source: {record.source}
                  </p>
                </div>
              </div>
              
              <RecordLayout objectType={objectType} record={record} t={t} />
            </div>
          )}
        </div>

        {/* Drawer Footer Actions */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-8 text-xs border-slate-200 font-semibold text-slate-700"
          >
            Close Panel
          </Button>
          {recordId && (
            <Button
              size="sm"
              onClick={() => {
                navigate({ to: `/parties/${recordId}` });
                onClose();
              }}
              className="h-8 text-xs bg-[#0f172a] hover:bg-slate-800 text-white font-semibold flex items-center gap-1 rounded-lg"
            >
              <ExternalLink size={12} />
              View Customer 360
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
