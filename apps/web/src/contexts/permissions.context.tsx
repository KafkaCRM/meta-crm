import { createContext, useContext, type ReactNode } from 'react';
import type { TenantAbility, TenantAction, TenantSubject } from '@meta-crm/permissions';

interface PermissionsContextValue {
  ability: TenantAbility | null;
  can: (action: TenantAction, resource: TenantSubject) => boolean;
}

const PermissionsContext = createContext<PermissionsContextValue | null>(null);

export function usePermissionsContext(): PermissionsContextValue {
  const ctx = useContext(PermissionsContext);
  if (!ctx) throw new Error('usePermissionsContext must be used within AbilityProvider');
  return ctx;
}

export function AbilityProvider({ ability, children }: { ability: TenantAbility | null; children: ReactNode }) {
  const can = (action: TenantAction, resource: TenantSubject): boolean => {
    if (!ability) return false;
    return ability.can(action, resource);
  };

  return (
    <PermissionsContext.Provider value={{ ability, can }}>
      {children}
    </PermissionsContext.Provider>
  );
}
