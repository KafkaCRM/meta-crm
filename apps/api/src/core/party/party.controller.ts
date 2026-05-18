import {
  Controller,
  Get,
  Post,
  Patch,
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
import { PartyService } from './party.service';
import { PartyUpsertService } from './party-upsert.service';
import { PartyMergeService } from './party-merge.service';
import { CreatePartyDto } from './dto/create-party.dto';
import { UpdatePartyDto } from './dto/update-party.dto';
import type { RequestScope } from '../tenant/request-scope.interface';

class CursorQuery {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  type?: string;
}

class CheckDuplicateQuery {
  @IsString()
  phone!: string;
}

class MergeBody {
  @IsString()
  canonical_id!: string;

  @IsString()
  duplicate_id!: string;
}

@Controller('parties')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PartyController {
  constructor(
    private readonly partyService: PartyService,
    private readonly upsertService: PartyUpsertService,
    private readonly mergeService: PartyMergeService,
  ) {}

  @Get()
  @CheckPermissions('read', 'Party')
  async findAll(@Query() query: CursorQuery) {
    const result = await this.partyService.findMany(query);
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Get('check-duplicate')
  @CheckPermissions('read', 'Party')
  async checkDuplicate(
    @Query() query: CheckDuplicateQuery,
    @CurrentUser() scope: RequestScope,
  ) {
    const result = await this.upsertService.upsertByPhone(
      query.phone,
      { name: '', branch_brand_assignment_id: '' },
      'manual' as any,
      scope,
    );

    if (result.isErr()) {
      if (result.error.code === 'INVALID_PHONE') {
        throw new BadRequestException(result.error);
      }
      throw new InternalServerErrorException(result.error);
    }

    if (result.value.action === 'found') {
      return {
        found: true,
        confidence: 1.0,
        match: {
          id: result.value.party.id,
          name: result.value.party.name,
          phone_normalized: result.value.party.phone_normalized,
          source: result.value.party.source,
          created_at: result.value.party.created_at,
        },
      };
    }

    return { found: false, confidence: 0 };
  }

  @Get(':id')
  @CheckPermissions('read', 'Party')
  async findOne(@Param('id') id: string) {
    const result = await this.partyService.findOne(id);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Post()
  @CheckPermissions('create', 'Party')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreatePartyDto) {
    const result = await this.partyService.create(dto);
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Patch(':id')
  @CheckPermissions('update', 'Party')
  async update(@Param('id') id: string, @Body() dto: UpdatePartyDto) {
    const result = await this.partyService.update(id, dto);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @CheckPermissions('delete', 'Party')
  async remove(@Param('id') id: string) {
    const result = await this.partyService.softDelete(id);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new InternalServerErrorException(result.error);
    }
    return { message: 'Party deleted' };
  }

  @Post('merge')
  @HttpCode(HttpStatus.OK)
  @CheckPermissions('manage', 'Party')
  async merge(@Body() body: MergeBody, @CurrentUser() scope: RequestScope) {
    const result = await this.mergeService.mergeParties(body, scope);
    if (result.isErr()) {
      switch (result.error.code) {
        case 'PARTY_NOT_FOUND':
          throw new NotFoundException(result.error);
        case 'SAME_PARTY':
          throw new BadRequestException(result.error);
        default:
          throw new InternalServerErrorException(result.error);
      }
    }
    return result.value;
  }
}
