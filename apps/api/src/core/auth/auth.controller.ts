import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  ForbiddenException,
  InternalServerErrorException,
  UseGuards,
} from '@nestjs/common';
import { IsString, IsOptional, IsEmail } from 'class-validator';
import { AuthService } from './auth.service';
import type { LoginResponse, RefreshResponse, AuthError } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { RequestScope } from './jwt.strategy';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;

  @IsOptional()
  @IsString()
  tenant_slug?: string;
}

export class RefreshDto {
  @IsString()
  refresh_token!: string;
}

export class LogoutDto {
  @IsString()
  refresh_token!: string;
}

function mapError(error: AuthError): never {
  switch (error.code) {
    case 'INVALID_CREDENTIALS':
    case 'TENANT_NOT_FOUND':
    case 'USER_NOT_IN_TENANT':
    case 'REFRESH_TOKEN_INVALID':
      throw new UnauthorizedException(error);
    case 'ACCOUNT_SUSPENDED':
      throw new ForbiddenException(error);
    case 'INTERNAL_ERROR':
    default:
      throw new InternalServerErrorException(error);
  }
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto): Promise<LoginResponse> {
    const result = await this.authService.login(dto);
    if (result.isErr()) {
      mapError(result.error);
    }
    return result.value;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshDto): Promise<RefreshResponse> {
    const result = await this.authService.refreshToken(dto.refresh_token);
    if (result.isErr()) {
      mapError(result.error);
    }
    return result.value;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(
    @Body() dto: LogoutDto,
    @CurrentUser() _user: RequestScope,
  ): Promise<{ message: string }> {
    const result = await this.authService.revokeToken(dto.refresh_token);
    if (result.isErr()) {
      mapError(result.error);
    }
    return { message: 'Logged out successfully' };
  }
}
