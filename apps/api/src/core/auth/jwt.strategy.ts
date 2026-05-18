import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ClsService } from 'nestjs-cls';
import type { TenantRole, PlatformRole } from '@meta-crm/types';
import type { RequestScope } from '../tenant/request-scope.interface';

export interface JwtPayload {
  sub: string;
  tenant_id: string;
  assignment_ids: string[];
  role: TenantRole;
  platform_role?: PlatformRole;
  iat: number;
  exp: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly cls: ClsService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env['JWT_SECRET'] || 'dev-secret-change-in-production',
    });
  }

  async validate(payload: JwtPayload): Promise<RequestScope> {
    const scope: RequestScope = {
      user_id: payload.sub,
      tenant_id: payload.tenant_id,
      assignment_ids: payload.assignment_ids,
      role: payload.role,
      platform_role: payload.platform_role,
    };

    this.cls.set('scope', scope);
    return scope;
  }
}
