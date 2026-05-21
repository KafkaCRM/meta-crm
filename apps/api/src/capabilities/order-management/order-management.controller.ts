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
import { IsString, IsOptional, IsNumber, Min, IsArray, ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/permissions/permissions.guard';
import { CheckPermissions } from '../../core/permissions/permissions.decorator';
import { OrderManagementService } from './order-management.service';

class CreateOrderLineItemDto {
  @IsString()
  @IsNotEmpty()
  product_name!: string;

  @IsNumber()
  @Min(1)
  quantity!: number;

  @IsNumber()
  @Min(0.01)
  unit_price!: number;
}

class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  party_id!: string;

  @IsNumber()
  @Min(0)
  total_amount!: number;

  @IsString()
  @IsOptional()
  payment_method?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderLineItemDto)
  items!: CreateOrderLineItemDto[];
}

class UpdateOrderDto {
  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  payment_status?: string;

  @IsString()
  @IsOptional()
  payment_method?: string;
}

class ListOrdersQuery {
  @IsString()
  @IsOptional()
  party_id?: string;

  @IsString()
  @IsOptional()
  status?: string;
}

@Controller('orders')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@CheckPermissions('read', 'Case')
export class OrderManagementController {
  constructor(private readonly orderService: OrderManagementService) {}

  @Get()
  async list(@Query() query: ListOrdersQuery) {
    const result = await this.orderService.listOrders(query);
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const result = await this.orderService.getOrder(id);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Post()
  async create(@Body() body: CreateOrderDto) {
    const result = await this.orderService.createOrder(body);
    if (result.isErr()) {
      throw new BadRequestException(result.error);
    }
    return result.value;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: UpdateOrderDto) {
    const result = await this.orderService.updateOrder(id, body);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new BadRequestException(result.error);
    }
    return result.value;
  }
}
