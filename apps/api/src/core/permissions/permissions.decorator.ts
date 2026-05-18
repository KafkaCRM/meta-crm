import { SetMetadata } from '@nestjs/common';

export const CHECK_PERMISSIONS_KEY = 'check_permissions';
export const CHECK_PLATFORM_PERMISSIONS_KEY = 'check_platform_permissions';

export const CheckPermissions = (action: string, resource: string) =>
  SetMetadata(CHECK_PERMISSIONS_KEY, { action, resource });

export const CheckPlatformPermissions = (action: string, resource: string) =>
  SetMetadata(CHECK_PLATFORM_PERMISSIONS_KEY, { action, resource });
