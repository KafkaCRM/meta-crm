import { Get, Controller, UseGuards, InternalServerErrorException } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/permissions/permissions.guard';
import { CheckPermissions } from '../../core/permissions/permissions.decorator';
import { CapabilityGuard } from '../../core/capability/capability.guard';
import { RequireCapability } from '../../core/capability/capability.decorator';
import { EnrollmentService } from './academics.service';

@Controller('academics')
@RequireCapability('capability/academics')
@UseGuards(JwtAuthGuard, CapabilityGuard, PermissionsGuard)
export class EnrollmentController {
  constructor(private readonly service: EnrollmentService) {}

  @Get('stats')
  @CheckPermissions('read', 'Report')
  async stats() {
    const result = await this.service.getStats();
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }
}
