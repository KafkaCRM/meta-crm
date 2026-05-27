import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IsString, IsOptional, IsNumber, Min, IsArray, IsNotEmpty } from 'class-validator';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/permissions/permissions.guard';
import { CheckPermissions } from '../../core/permissions/permissions.decorator';
import { CapabilityGuard } from '../../core/capability/capability.guard';
import { RequireCapability } from '../../core/capability/capability.decorator';
import { PropertyService } from './property.service';

class CreatePropertyDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  address!: string;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsNumber()
  @Min(0)
  bedrooms!: number;

  @IsNumber()
  @Min(0)
  bathrooms!: number;

  @IsNumber()
  @Min(0)
  square_footage!: number;

  @IsNumber()
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @IsOptional()
  longitude?: number;

  @IsString()
  @IsOptional()
  status?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];
}

class UpdatePropertyDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsNumber()
  @IsOptional()
  price?: number;

  @IsNumber()
  @IsOptional()
  bedrooms?: number;

  @IsNumber()
  @IsOptional()
  bathrooms?: number;

  @IsNumber()
  @IsOptional()
  square_footage?: number;

  @IsNumber()
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @IsOptional()
  longitude?: number;

  @IsString()
  @IsOptional()
  status?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];
}

class ListPropertiesQuery {
  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsNumber()
  @IsOptional()
  min_price?: number;

  @IsNumber()
  @IsOptional()
  max_price?: number;

  @IsNumber()
  @IsOptional()
  bedrooms?: number;
}

@Controller('properties')
@RequireCapability('capability/property-listing')
@UseGuards(JwtAuthGuard, CapabilityGuard, PermissionsGuard)
@CheckPermissions('read', 'Case')
export class PropertyController {
  constructor(private readonly propertyService: PropertyService) {}

  @Get()
  async list(@Query() query: ListPropertiesQuery) {
    const result = await this.propertyService.listProperties(query);
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const result = await this.propertyService.getProperty(id);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Post()
  async create(@Body() body: CreatePropertyDto) {
    const result = await this.propertyService.createProperty(body);
    if (result.isErr()) {
      throw new BadRequestException(result.error);
    }
    return result.value;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: UpdatePropertyDto) {
    const result = await this.propertyService.updateProperty(id, body);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new BadRequestException(result.error);
    }
    return result.value;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    const result = await this.propertyService.deleteProperty(id);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }
}
