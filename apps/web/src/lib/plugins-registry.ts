import React from 'react';

export type PluginUIComponent = React.ComponentType<any>;

class PluginUIRegistry {
  private registry: Map<string, Map<string, PluginUIComponent>> = new Map();

  /**
   * Registers a component for a specific plugin and UI slot anchor.
   */
  register(pluginId: string, anchor: string, component: PluginUIComponent): void {
    const normalizedPluginId = this.normalizeId(pluginId);
    if (!this.registry.has(normalizedPluginId)) {
      this.registry.set(normalizedPluginId, new Map());
    }
    this.registry.get(normalizedPluginId)!.set(anchor, component);
  }

  /**
   * Gets a registered component for a specific plugin and UI slot anchor.
   */
  getComponent(pluginId: string, anchor: string): PluginUIComponent | null {
    const normalizedPluginId = this.normalizeId(pluginId);
    const componentsMap = this.registry.get(normalizedPluginId);
    if (!componentsMap) return null;
    return componentsMap.get(anchor) ?? null;
  }

  /**
   * Normalizes the plugin ID to support matching with/without the prefix.
   */
  private normalizeId(pluginId: string): string {
    return pluginId.toLowerCase().replace('@meta-crm/plugin-', '');
  }
}

export const pluginUIRegistry = new PluginUIRegistry();
