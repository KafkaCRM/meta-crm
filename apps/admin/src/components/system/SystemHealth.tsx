import { useState } from 'react';
import { QueueMonitor } from './QueueMonitor';
import { WebhookFailures } from './WebhookFailures';
import { Activity, Layers, Terminal, ShieldAlert, Cpu } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type TabId = 'queues' | 'webhooks';

export function SystemHealth() {
  const [activeTab, setActiveTab] = useState<TabId>('queues');

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Premium Status Banner */}
      <Card className="bg-[#0b0f19] border-slate-800 text-slate-100 rounded-xl overflow-hidden shadow-lg relative">
        <div className="absolute top-0 right-0 p-6 opacity-10">
          <Cpu size={120} className="text-muted-foreground" />
        </div>
        <CardContent className="p-6 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] uppercase font-mono tracking-widest text-fin-orange font-bold">Diagnostics Console</span>
              </div>
              <h2 className="text-xl font-bold font-mono text-white">Platform System Health</h2>
              <p className="text-xs text-muted-foreground">Real-time developer diagnostics, job queue pipelines, and webhook delivery records.</p>
            </div>
            
            <div className="flex flex-wrap gap-4 font-mono text-xs">
              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/80 flex flex-col min-w-[120px]">
                <span className="text-muted-foreground text-[10px] uppercase font-semibold">Active Workers</span>
                <span className="text-emerald-400 font-bold mt-1 text-sm">4 Online</span>
              </div>
              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/80 flex flex-col min-w-[120px]">
                <span className="text-muted-foreground text-[10px] uppercase font-semibold">Queue Ingestion</span>
                <span className="text-white font-bold mt-1 text-sm">99.98% OK</span>
              </div>
              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/80 flex flex-col min-w-[120px]">
                <span className="text-muted-foreground text-[10px] uppercase font-semibold">Webhook Latency</span>
                <span className="text-fin-orange font-bold mt-1 text-sm">242ms</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tab Switcher Console style */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('queues')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold tracking-tight border-b-2 transition-all ${
            activeTab === 'queues'
              ? 'border-indigo-600 text-fin-orange bg-fin-orange/10/10'
              : 'border-transparent text-muted-foreground hover:text-muted-foreground hover:bg-muted/50'
          }`}
        >
          <Layers size={15} />
          Queue Monitor Diagnostics
          <Badge className="ml-1 bg-fin-orange/10 text-fin-orange text-[10px] hover:bg-fin-orange/10 border-transparent shadow-none px-1.5 py-0">
            Active
          </Badge>
        </button>
        <button
          onClick={() => setActiveTab('webhooks')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold tracking-tight border-b-2 transition-all ${
            activeTab === 'webhooks'
              ? 'border-indigo-600 text-fin-orange bg-fin-orange/10/10'
              : 'border-transparent text-muted-foreground hover:text-muted-foreground hover:bg-muted/50'
          }`}
        >
          <ShieldAlert size={15} />
          Webhook Failure Records
          <Badge className="ml-1 bg-rose-50 text-rose-700 text-[10px] hover:bg-rose-50 border-transparent shadow-none px-1.5 py-0 animate-pulse">
            Log
          </Badge>
        </button>
      </div>

      {/* Workspace Area */}
      <div className="transition-all duration-300">
        {activeTab === 'queues' ? (
          <div className="animate-in fade-in duration-200">
            <QueueMonitor />
          </div>
        ) : (
          <div className="animate-in fade-in duration-200">
            <WebhookFailures />
          </div>
        )}
      </div>
    </div>
  );
}
