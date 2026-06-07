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
  Req,
  Res,
} from '@nestjs/common';
import { IsString, IsOptional, IsEmail } from 'class-validator';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from './auth.service';
import type { LoginResponse, RefreshResponse, AuthError, LoginResultPayload } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { RequestScope } from '../tenant/request-scope.interface';

export class LoginDto {
  @IsString()
  email!: string;

  @IsString()
  password!: string;

  @IsOptional()
  @IsString()
  tenant_slug?: string;
}

export class RefreshDto {
  @IsOptional()
  @IsString()
  refresh_token?: string;
}

export class LogoutDto {
  @IsOptional()
  @IsString()
  refresh_token?: string;
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
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<LoginResultPayload> {
    const result = await this.authService.login(dto);
    if (result.isErr()) {
      mapError(result.error);
    }

    if ('multiple_workspaces' in result.value) {
      return result.value;
    }

    const { access_token, refresh_token } = result.value;

    reply.setCookie('access_token', access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    reply.setCookie('refresh_token', refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return result.value;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: FastifyRequest,
    @Body() dto: RefreshDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<RefreshResponse> {
    const token = req.cookies['refresh_token'] || dto.refresh_token;
    if (!token) {
      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_INVALID',
        message: 'No refresh token provided',
      });
    }

    const result = await this.authService.refreshToken(token);
    if (result.isErr()) {
      mapError(result.error);
    }

    const { access_token } = result.value;

    reply.setCookie('access_token', access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return result.value;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(
    @Req() req: FastifyRequest,
    @Body() dto: LogoutDto,
    @Res({ passthrough: true }) reply: FastifyReply,
    @CurrentUser() _user: RequestScope,
  ): Promise<{ message: string }> {
    const token = req.cookies['refresh_token'] || dto.refresh_token;
    if (token) {
      const result = await this.authService.revokeToken(token);
      if (result.isErr()) {
        mapError(result.error);
      }
    }

    reply.clearCookie('access_token', { path: '/' });
    reply.clearCookie('refresh_token', { path: '/' });

    return { message: 'Logged out successfully' };
  }
}

