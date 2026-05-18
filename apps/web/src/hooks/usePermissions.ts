import { usePermissionsContext } from '@/contexts/permissions.context';

export function usePermissions() {
  const { can, ability } = usePermissionsContext();
  return { can, ability };
}
