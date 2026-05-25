import { describe, it, expect } from 'vitest';
import React from 'react';
import { pluginUIRegistry } from '../plugins-registry';

const DummyComponent1 = () => <div>Dummy Component 1</div>;
const DummyComponent2 = () => <div>Dummy Component 2</div>;

describe('PluginUIRegistry', () => {
  it('should register and retrieve a component', () => {
    pluginUIRegistry.register('test-plugin', 'TestAnchor', DummyComponent1);
    expect(pluginUIRegistry.getComponent('test-plugin', 'TestAnchor')).toBe(DummyComponent1);
  });

  it('should return null for unregistered plugins or anchors', () => {
    expect(pluginUIRegistry.getComponent('unknown-plugin', 'TestAnchor')).toBeNull();
    expect(pluginUIRegistry.getComponent('test-plugin', 'UnknownAnchor')).toBeNull();
  });

  it('should support case-insensitive and prefix-insensitive plugin ID matching', () => {
    pluginUIRegistry.register('@meta-crm/plugin-healthcare', 'CaseSidePanel', DummyComponent2);
    
    // Exact match
    expect(pluginUIRegistry.getComponent('@meta-crm/plugin-healthcare', 'CaseSidePanel')).toBe(DummyComponent2);
    // Lowercase without prefix
    expect(pluginUIRegistry.getComponent('healthcare', 'CaseSidePanel')).toBe(DummyComponent2);
    // Case-insensitive match
    expect(pluginUIRegistry.getComponent('HealthCare', 'CaseSidePanel')).toBe(DummyComponent2);
  });
});
