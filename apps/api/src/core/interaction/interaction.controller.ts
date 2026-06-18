import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  UseGuards,
} from '@nestjs/common';
import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { CheckPermissions } from '../permissions/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { InteractionService } from './interaction.service';
import { CreateInteractionDto } from './dto/create-interaction.dto';
import type { RequestScope } from '../tenant/request-scope.interface';

class TimelineQuery {
  @IsOptional()
  @IsString()
  party_id?: string;

  @IsOptional()
  @IsString()
  case_id?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

@Controller('interactions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InteractionController {
  constructor(private readonly interactionService: InteractionService) {}

  @Get()
  @CheckPermissions('read', 'Interaction')
  async findTimeline(@Query() query: TimelineQuery) {
    if (!query.party_id && !query.case_id) {
      throw new BadRequestException({ code: 'MISSING_FILTER', message: 'Provide party_id or case_id' });
    }

    const result = await this.interactionService.findTimeline(query);
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Post()
  @CheckPermissions('create', 'Interaction')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateInteractionDto) {
    const result = await this.interactionService.create(dto);
    if (result.isErr()) {
      switch (result.error.code) {
        case 'PARTY_NOT_FOUND':
        case 'LEAD_NOT_FOUND':
          throw new BadRequestException(result.error);
        default:
          throw new InternalServerErrorException(result.error);
      }
    }
    return result.value;
  }

  @Post(':id/pin')
  @HttpCode(HttpStatus.OK)
  @CheckPermissions('manage', 'Lead')
  async pin(@Param('id') id: string, @CurrentUser() scope: RequestScope) {
    const result = await this.interactionService.pin(id, scope.user_id);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') throw new NotFoundException(result.error);
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Delete(':id/pin')
  @HttpCode(HttpStatus.OK)
  @CheckPermissions('manage', 'Lead')
  async unpin(@Param('id') id: string) {
    const result = await this.interactionService.unpin(id);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') throw new NotFoundException(result.error);
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }
}
