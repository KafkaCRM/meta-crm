import React, { Component, lazy, Suspense, type ErrorInfo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { settingsApi } from '@/api/settings';
import type { SlotContextData } from '@meta-crm/types';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Plugin component error:', error, errorInfo);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="p-3 bg-red-50 text-red-700 text-xs rounded border border-red-200">
          Failed to load plugin component.
        </div>
      );
    }
    return this.props.children;
  }
}

export function PluginSlotSkeleton() {
  return (
    <div className="animate-pulse space-y-3 p-4 bg-surface-1 border border-hairline rounded-md">
      <div className="h-4 bg-surface-2 rounded w-3/4"></div>
      <div className="h-3 bg-surface-2 rounded"></div>
      <div className="h-3 bg-surface-2 rounded w-5/6"></div>
    </div>
  );
}

const PLUGIN_COMPONENTS: Record<string, Record<string, React.ComponentType<any>>> = {
  healthcare: {
    CaseSidePanel: lazy(() => import('@/components/plugins/healthcare/CaseSidePanel')),
    CaseMainTabs: lazy(() => import('@/components/plugins/healthcare/CaseMainTabs')),
  },
  marketing: {
    CaseSidePanel: lazy(() => import('@/components/plugins/marketing/CaseSidePanel')),
    CaseMainTabs: lazy(() => import('@/components/plugins/marketing/CaseMainTabs')),
  },
};

function getPluginKey(plugin: { id: string; name: string }) {
  const idLower = plugin.id.toLowerCase();
  const nameLower = plugin.name.toLowerCase();
  if (idLower.includes('healthcare') || nameLower.includes('healthcare')) {
    return 'healthcare';
  }
  if (idLower.includes('marketing') || nameLower.includes('marketing')) {
    return 'marketing';
  }
  return null;
}

export function PluginSlot({ anchor, context }: { anchor: string; context: SlotContextData }) {
  const { data: plugins = [], isLoading } = useQuery({
    queryKey: ['plugins'],
    queryFn: () => settingsApi.plugins.list(),
    staleTime: 60_000,
  });

  if (isLoading) {
    return <PluginSlotSkeleton />;
  }

  const activePlugins = plugins.filter((p) => p.installed && p.enabled);

  const matchedComponents = activePlugins
    .map((plugin) => {
      const key = getPluginKey(plugin);
      if (!key) return null;
      const component = PLUGIN_COMPONENTS[key]?.[anchor];
      if (!component) return null;
      return {
        pluginId: plugin.id,
        key,
        Component: component,
      };
    })
    .filter((c): c is { pluginId: string; key: string; Component: React.ComponentType<any> } => c !== null);

  if (matchedComponents.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {matchedComponents.map(({ pluginId, Component }) => (
        <Suspense key={pluginId} fallback={<PluginSlotSkeleton />}>
          <ErrorBoundary>
            <Component {...context} />
          </ErrorBoundary>
        </Suspense>
      ))}
    </div>
  );
}

export function usePluginTabs(context: SlotContextData) {
  const { data: plugins = [], isLoading } = useQuery({
    queryKey: ['plugins'],
    queryFn: () => settingsApi.plugins.list(),
    staleTime: 60_000,
  });

  const activePlugins = plugins.filter((p) => p.installed && p.enabled);

  const tabs = activePlugins
    .map((plugin) => {
      const key = getPluginKey(plugin);
      if (!key) return null;
      const Component = PLUGIN_COMPONENTS[key]?.['CaseMainTabs'];
      if (!Component) return null;
      return {
        id: key,
        label: plugin.name.includes('@meta-crm/plugin-')
          ? plugin.name.replace('@meta-crm/plugin-', '').replace(/^\w/, (c) => c.toUpperCase())
          : plugin.name,
        Component,
      };
    })
    .filter((t): t is { id: string; label: string; Component: React.ComponentType<any> } => t !== null);

  return { tabs, isLoading };
}
