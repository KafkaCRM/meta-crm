import { Controller, Get, UseGuards, InternalServerErrorException } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/permissions/permissions.guard';
import { CheckPermissions } from '../../core/permissions/permissions.decorator';
import { CapabilityGuard } from '../../core/capability/capability.guard';
import { RequireCapability } from '../../core/capability/capability.decorator';
import { InboxService } from './inbox.service';

@Controller('inbox')
@RequireCapability('capability/workspace')
@UseGuards(JwtAuthGuard, CapabilityGuard, PermissionsGuard)
export class InboxController {
  constructor(private readonly service: InboxService) {}

  @Get('conversations') @CheckPermissions('read', 'Case')
  async conversations() { const r = await this.service.conversations(); if (r.isErr()) throw new InternalServerErrorException(r.error); return r.value; }
}
