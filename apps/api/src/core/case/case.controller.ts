import {
  Controller,
  Get,
  Post,
  Patch,
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
import { IsString, IsOptional, IsNumber, Min, Max, IsArray } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { CheckPermissions } from '../permissions/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CaseService } from './case.service';
import { StageTransitionService } from './stage-transition.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { TransitionStageDto } from './dto/transition-stage.dto';
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
  stage?: string;

  @IsOptional()
  @IsString()
  assigned_to_id?: string;

  @IsOptional()
  @IsString()
  party_id?: string;

  @IsOptional()
  @IsString()
  type?: string;
}

class UpdateCaseBody {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  attributes?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  assigned_to_id?: string | null;
}

class BulkAssignBody {
  @IsArray()
  @IsString({ each: true })
  case_ids!: string[];

  @IsString()
  assigned_to_id!: string;
}

@Controller('cases')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CaseController {
  constructor(
    private readonly caseService: CaseService,
    private readonly stageTransition: StageTransitionService,
  ) {}

  @Get()
  @CheckPermissions('read', 'Case')
  async findAll(@Query() query: CursorQuery) {
    const result = await this.caseService.findMany(query);
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Get(':id')
  @CheckPermissions('read', 'Case')
  async findOne(@Param('id') id: string) {
    const result = await this.caseService.findOne(id);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') throw new NotFoundException(result.error);
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Post()
  @CheckPermissions('create', 'Case')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateCaseDto) {
    const result = await this.caseService.create(dto);
    if (result.isErr()) {
      switch (result.error.code) {
        case 'PARTY_NOT_FOUND':
        case 'WORKFLOW_NOT_FOUND':
          throw new BadRequestException(result.error);
        default:
          throw new InternalServerErrorException(result.error);
      }
    }
    return result.value;
  }

  @Patch(':id')
  @CheckPermissions('update', 'Case')
  async update(@Param('id') id: string, @Body() body: UpdateCaseBody) {
    const result = await this.caseService.update(id, body);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') throw new NotFoundException(result.error);
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Post(':id/transition')
  @CheckPermissions('update', 'Case')
  @HttpCode(HttpStatus.OK)
  async transition(
    @Param('id') id: string,
    @Body() body: TransitionStageDto,
    @CurrentUser() scope: RequestScope,
  ) {
    const result = await this.stageTransition.transitionStage(
      id,
      body.to_stage_id,
      scope.user_id,
    );

    if (result.isErr()) {
      const error = result.error;
      switch (error.code) {
        case 'CASE_NOT_FOUND':
          throw new NotFoundException(error);
        case 'INVALID_TRANSITION':
          throw new BadRequestException(error);
        case 'CRITERIA_UNMET':
          throw new BadRequestException(error);
        default:
          throw new InternalServerErrorException(error);
      }
    }

    return result.value;
  }

  @Patch('bulk-assign')
  @HttpCode(HttpStatus.OK)
  @CheckPermissions('update', 'Case')
  async bulkAssign(@Body() body: BulkAssignBody) {
    const result = await this.caseService.bulkAssign(body.case_ids, body.assigned_to_id);
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Get(':id/events')
  @CheckPermissions('read', 'Case')
  async findEvents(
    @Param('id') id: string,
    @Query() query: { cursor?: string; limit?: number },
  ) {
    const result = await this.caseService.findEvents(id, query);
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }
}
