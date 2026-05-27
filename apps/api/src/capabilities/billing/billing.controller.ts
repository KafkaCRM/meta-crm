import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { IsString, IsOptional, IsNumber, Min, IsArray, ValidateNested, IsDateString, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/permissions/permissions.guard';
import { CheckPermissions } from '../../core/permissions/permissions.decorator';
import { CapabilityGuard } from '../../core/capability/capability.guard';
import { RequireCapability } from '../../core/capability/capability.decorator';
import { BillingService } from './billing.service';

class CreateInvoiceLineItemDto {
  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsNumber()
  @Min(0.01)
  quantity!: number;

  @IsNumber()
  @Min(0.01)
  unit_price!: number;
}

class CreateInvoiceDto {
  @IsString()
  @IsNotEmpty()
  party_id!: string;

  @IsDateString()
  due_date!: string;

  @IsOptional()
  billing_details?: any;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceLineItemDto)
  items!: CreateInvoiceLineItemDto[];
}

class RegisterPaymentDto {
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  @IsNotEmpty()
  method!: string;

  @IsString()
  @IsOptional()
  reference?: string;

  @IsDateString()
  @IsOptional()
  payment_date?: string;
}

class ListInvoicesQuery {
  @IsString()
  @IsOptional()
  party_id?: string;

  @IsString()
  @IsOptional()
  status?: string;
}

@Controller('invoices')
@RequireCapability('capability/billing')
@UseGuards(JwtAuthGuard, CapabilityGuard, PermissionsGuard)
@CheckPermissions('read', 'Case')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get()
  async list(@Query() query: ListInvoicesQuery) {
    const result = await this.billingService.listInvoices(query);
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Get('stats')
  async stats() {
    const result = await this.billingService.getStats();
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const result = await this.billingService.getInvoice(id);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Post()
  async create(@Body() body: CreateInvoiceDto) {
    const result = await this.billingService.createInvoice({
      ...body,
      due_date: new Date(body.due_date),
    });
    if (result.isErr()) {
      throw new BadRequestException(result.error);
    }
    return result.value;
  }

  @Post(':id/payments')
  async registerPayment(@Param('id') id: string, @Body() body: RegisterPaymentDto) {
    const result = await this.billingService.registerPayment(id, {
      amount: body.amount,
      method: body.method,
      reference: body.reference,
      ...(body.payment_date && { payment_date: new Date(body.payment_date) }),
    });
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new BadRequestException(result.error);
    }
    return result.value;
  }
}
