import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { IsString, IsOptional, IsNumber, Min, IsArray, ValidateNested, IsNotEmpty, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/permissions/permissions.guard';
import { CheckPermissions } from '../../core/permissions/permissions.decorator';
import { CustomerOnboardingService } from './customer-onboarding.service';

class CreateOnboardingStepDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsNumber()
  order!: number;
}

class CreateOnboardingDto {
  @IsString()
  @IsNotEmpty()
  party_id!: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  contract_value?: number;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateOnboardingStepDto)
  steps?: CreateOnboardingStepDto[];
}

class UpdateOnboardingDto {
  @IsString()
  @IsOptional()
  status?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  contract_value?: number;
}

class UpdateStepDto {
  @IsBoolean()
  completed!: boolean;
}

class ListOnboardingsQuery {
  @IsString()
  @IsOptional()
  party_id?: string;

  @IsString()
  @IsOptional()
  status?: string;
}

@Controller('onboardings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@CheckPermissions('read', 'Case')
export class CustomerOnboardingController {
  constructor(private readonly onboardingService: CustomerOnboardingService) {}

  @Get()
  async list(@Query() query: ListOnboardingsQuery) {
    const result = await this.onboardingService.listOnboardings(query);
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const result = await this.onboardingService.getOnboarding(id);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Post()
  async create(@Body() body: CreateOnboardingDto) {
    const result = await this.onboardingService.createOnboarding(body);
    if (result.isErr()) {
      throw new BadRequestException(result.error);
    }
    return result.value;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: UpdateOnboardingDto) {
    const result = await this.onboardingService.updateOnboarding(id, body);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new BadRequestException(result.error);
    }
    return result.value;
  }

  @Patch(':id/steps/:stepId')
  async updateStep(
    @Param('id') id: string,
    @Param('stepId') stepId: string,
    @Body() body: UpdateStepDto,
  ) {
    const result = await this.onboardingService.updateStep(id, stepId, body.completed);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new BadRequestException(result.error);
    }
    return result.value;
  }
}
