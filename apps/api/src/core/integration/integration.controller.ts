import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { CheckPermissions } from '../permissions/permissions.decorator';
import { IntegrationService } from './integration.service';

/**
 * IntegrationController serves the /integrations REST API used by
 * the frontend IntegrationSettings.tsx component.
 *
 * All routes require the 'manage Integration' permission (admin-only).
 * GET /integrations          — list all providers with connection status
 * POST /integrations/:id/configure — save encrypted credentials
 * DELETE /integrations/:id   — wipe credentials and disable
 */
@Controller('integrations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class IntegrationController {
  constructor(private readonly integrationService: IntegrationService) {}

  @Get()
  @CheckPermissions('read', 'Integration')
  async list() {
    const result = await this.integrationService.listIntegrations();
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Post(':provider/configure')
  @CheckPermissions('manage', 'Integration')
  @HttpCode(HttpStatus.OK)
  async configure(
    @Param('provider') provider: string,
    @Body() body: Record<string, string>,
  ) {
    // Separate credential fields from any non-credential meta
    const result = await this.integrationService.configure(provider, body);
    if (result.isErr()) {
      if (result.error.code === 'PROVIDER_NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      if (result.error.code === 'ENCRYPTION_FAILED') {
        throw new BadRequestException(result.error);
      }
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Delete(':provider')
  @CheckPermissions('manage', 'Integration')
  @HttpCode(HttpStatus.OK)
  async disconnect(@Param('provider') provider: string) {
    const result = await this.integrationService.disconnect(provider);
    if (result.isErr()) {
      if (result.error.code === 'PROVIDER_NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }
}
