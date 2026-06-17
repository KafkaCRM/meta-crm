import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IsString, IsArray, IsOptional, ValidateIf } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { CheckPermissions } from '../permissions/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestScope } from '../tenant/request-scope.interface';
import { UserService } from './user.service';

class InviteUserDto {
  @IsString()
  name!: string;

  @IsOptional()
  @ValidateIf((o: any) => o.email && o.email.trim() !== '')
  @IsString()
  email?: string;

  @IsString()
  phone_number!: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsArray()
  @IsString({ each: true })
  role_ids!: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assignment_ids?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  vertical_ids?: string[];
}

class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone_number?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  role_ids?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assignment_ids?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  vertical_ids?: string[];
}

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UserController {
  constructor(private readonly service: UserService) {}

  @Get()
  @CheckPermissions('read', 'User')
  async list(@CurrentUser() user: RequestScope) {
    return this.service.list(user.tenant_id);
  }

  @Post('invite')
  @HttpCode(HttpStatus.CREATED)
  @CheckPermissions('manage', 'User')
  async invite(@CurrentUser() user: RequestScope, @Body() body: InviteUserDto) {
    return this.service.invite(user.tenant_id, body);
  }

  @Patch(':id')
  @CheckPermissions('manage', 'User')
  async update(
    @CurrentUser() user: RequestScope,
    @Param('id') id: string,
    @Body() body: UpdateUserDto,
  ) {
    return this.service.update(user.tenant_id, id, body);
  }

  @Delete(':id')
  @CheckPermissions('manage', 'User')
  async remove(@CurrentUser() user: RequestScope, @Param('id') id: string) {
    return this.service.remove(user.tenant_id, id);
  }
}
