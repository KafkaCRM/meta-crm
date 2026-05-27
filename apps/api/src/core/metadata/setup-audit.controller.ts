import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { CheckPermissions } from '../permissions/permissions.decorator';
import { SetupAuditTrailService } from './setup-audit.service';

@Controller('setup-audits')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SetupAuditTrailController {
  constructor(private readonly service: SetupAuditTrailService) {}

  @Get()
  @CheckPermissions('manage', 'PlatformTenant')
  async list() {
    return await this.service.findMany();
  }
}
