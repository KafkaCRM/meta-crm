import React, { Component, Suspense, type ErrorInfo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { settingsApi } from '@/api/settings';
import type { SlotContextData } from '@meta-crm/types';
import { pluginUIRegistry } from './plugins-registry';

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

export function PluginSlot({
  anchor,
  context,
  contextData,
  activePlugins,
}: {
  anchor: string;
  context?: SlotContextData;
  contextData?: SlotContextData;
  activePlugins?: string[];
}) {
  const mergedContext = contextData || context;
  if (!mergedContext) {
    throw new Error('PluginSlot: context or contextData must be provided.');
  }

  const { data: plugins = [], isLoading } = useQuery({
    queryKey: ['plugins'],
    queryFn: () => settingsApi.plugins.list(),
    staleTime: 60_000,
    enabled: !activePlugins,
  });

  if (isLoading && !activePlugins) {
    return <PluginSlotSkeleton />;
  }

  const resolvedActivePlugins = activePlugins
    ? activePlugins.map((p) => ({ id: p, name: p, installed: true, enabled: true }))
    : plugins.filter((p) => p.installed && p.enabled);

  const matchedComponents = resolvedActivePlugins
    .map((plugin) => {
      // Check registry by plugin.id, then by plugin.name
      const component = pluginUIRegistry.getComponent(plugin.id, anchor) || pluginUIRegistry.getComponent(plugin.name, anchor);
      if (!component) return null;
      return {
        pluginId: plugin.id,
        Component: component,
      };
    })
    .filter((c): c is { pluginId: string; Component: React.ComponentType<any> } => c !== null);

  if (matchedComponents.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {matchedComponents.map(({ pluginId, Component }) => (
        <Suspense key={pluginId} fallback={<PluginSlotSkeleton />}>
          <ErrorBoundary>
            <Component {...mergedContext} />
          </ErrorBoundary>
        </Suspense>
      ))}
    </div>
  );
}

export function usePluginTabs(context: SlotContextData, activePlugins?: string[]) {
  const { data: plugins = [], isLoading } = useQuery({
    queryKey: ['plugins'],
    queryFn: () => settingsApi.plugins.list(),
    staleTime: 60_000,
    enabled: !activePlugins,
  });

  const resolvedActivePlugins = activePlugins
    ? activePlugins.map((p) => ({ id: p, name: p, installed: true, enabled: true }))
    : plugins.filter((p) => p.installed && p.enabled);

  const tabs = resolvedActivePlugins
    .map((plugin) => {
      const Component = pluginUIRegistry.getComponent(plugin.id, 'CaseMainTabs') || pluginUIRegistry.getComponent(plugin.name, 'CaseMainTabs');
      if (!Component) return null;
      const key = plugin.id.replace('@meta-crm/plugin-', '').toLowerCase();
      return {
        id: key,
        label: plugin.name.includes('@meta-crm/plugin-')
          ? plugin.name.replace('@meta-crm/plugin-', '').replace(/^\w/, (c) => c.toUpperCase())
          : plugin.name.replace(/^\w/, (c) => c.toUpperCase()),
        Component,
      };
    })
    .filter((t): t is { id: string; label: string; Component: React.ComponentType<any> } => t !== null);

  return { tabs, isLoading: !activePlugins && isLoading };
}


