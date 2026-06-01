import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ClsService } from 'nestjs-cls';
import { TenantRole } from '@meta-crm/types';
import type { PlatformRole } from '@meta-crm/types';
import type { RequestScope } from '../tenant/request-scope.interface';
import { PlatformPrismaService } from '../tenant/platform-prisma.service';

export interface JwtPayload {
  sub: string;
  tenant_id: string;
  assignment_ids: string[];
  role: TenantRole;
  platform_role?: PlatformRole;
  is_impersonating?: boolean;
  admin_user_id?: string;
  iat: number;
  exp: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly cls: ClsService,
    private readonly platformDb: PlatformPrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: any) => {
          if (req && req.cookies) {
            return req.cookies['access_token'] || null;
          }
          return null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env['JWT_SECRET'] || 'dev-secret-change-in-production',
    });
  }

  private async resolveVerticalIdsFromDb(
    tenantId: string,
    role: string,
    assignmentIds: string[],
  ): Promise<string[]> {
    if (
      role === TenantRole.Manager ||
      role === TenantRole.Admin ||
      role === TenantRole.Owner ||
      !tenantId ||
      assignmentIds.length === 0
    ) {
      return [];
    }

    const assignments = await this.platformDb.client.branchBrandAssignment.findMany({
      where: {
        id: { in: assignmentIds },
        tenant_id: tenantId,
      },
      select: { branch_id: true },
    });

    const branchIds = assignments.map((a) => a.branch_id);
    if (branchIds.length === 0) {
      return [];
    }

    const verticals = await this.platformDb.client.vertical.findMany({
      where: {
        branch_id: { in: branchIds },
        tenant_id: tenantId,
        status: 'active',
      },
      select: { id: true },
    });

    return verticals.map((v) => v.id);
  }

  async validate(payload: JwtPayload): Promise<RequestScope> {
    // Flag choice: Fetching vertical_ids from DB when not present in JWT payload,
    // to maintain full backwards compatibility with existing sessions and tests.
    let verticalIds: string[] = (payload as any).vertical_ids;

    if (!verticalIds && payload.tenant_id) {
      // TODO: Encode vertical_ids directly into the JWT token payload at signing time
      // inside AuthService.login/refreshToken to avoid performing a database lookup on every API request.
      verticalIds = await this.resolveVerticalIdsFromDb(
        payload.tenant_id,
        payload.role,
        payload.assignment_ids || [],
      );
    }

    const scope: RequestScope = {
      user_id: payload.sub,
      tenant_id: payload.tenant_id,
      assignment_ids: payload.assignment_ids,
      role: payload.role,
      platform_role: payload.platform_role,
      vertical_ids: verticalIds || [],
      is_impersonating: payload.is_impersonating,
      admin_user_id: payload.admin_user_id,
    };

    this.cls.set('scope', scope);
    return scope;
  }
}
