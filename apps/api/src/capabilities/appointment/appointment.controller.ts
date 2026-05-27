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
import { IsString, IsOptional, IsDateString, IsNotEmpty } from 'class-validator';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/permissions/permissions.guard';
import { CheckPermissions } from '../../core/permissions/permissions.decorator';
import { CapabilityGuard } from '../../core/capability/capability.guard';
import { RequireCapability } from '../../core/capability/capability.decorator';
import { AppointmentService } from './appointment.service';

class CreateAppointmentDto {
  @IsString()
  @IsNotEmpty()
  party_id!: string;

  @IsString()
  @IsOptional()
  user_id?: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  start_time!: string;

  @IsDateString()
  end_time!: string;

  @IsString()
  @IsOptional()
  room?: string;
}

class UpdateAppointmentDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  @IsOptional()
  start_time?: string;

  @IsDateString()
  @IsOptional()
  end_time?: string;

  @IsString()
  @IsOptional()
  room?: string;

  @IsString()
  @IsOptional()
  status?: string;
}

class ListAppointmentsQuery {
  @IsString()
  @IsOptional()
  party_id?: string;

  @IsString()
  @IsOptional()
  user_id?: string;

  @IsString()
  @IsOptional()
  start?: string;

  @IsString()
  @IsOptional()
  end?: string;
}

class GetSlotsQuery {
  @IsString()
  @IsNotEmpty()
  date!: string;

  @IsString()
  @IsOptional()
  user_id?: string;
}

@Controller('appointments')
@RequireCapability('capability/appointment')
@UseGuards(JwtAuthGuard, CapabilityGuard, PermissionsGuard)
@CheckPermissions('read', 'Case')
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  @Get()
  async list(@Query() query: ListAppointmentsQuery) {
    const result = await this.appointmentService.listAppointments(query);
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Get('slots')
  async getSlots(@Query() query: GetSlotsQuery) {
    const result = await this.appointmentService.getAvailableSlots(query.date, query.user_id);
    if (result.isErr()) {
      if (result.error.code === 'INVALID_DATE') {
        throw new BadRequestException(result.error);
      }
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const result = await this.appointmentService.getAppointment(id);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Post()
  async create(@Body() body: CreateAppointmentDto) {
    const result = await this.appointmentService.createAppointment({
      ...body,
      start_time: new Date(body.start_time),
      end_time: new Date(body.end_time),
    });
    if (result.isErr()) {
      throw new BadRequestException(result.error);
    }
    return result.value;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: UpdateAppointmentDto) {
    const result = await this.appointmentService.updateAppointment(id, {
      title: body.title,
      description: body.description,
      room: body.room,
      status: body.status,
      ...(body.start_time && { start_time: new Date(body.start_time) }),
      ...(body.end_time && { end_time: new Date(body.end_time) }),
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
