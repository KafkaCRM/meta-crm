import jwt from 'jsonwebtoken';
import type { RequestScope } from '../types/context';

const JWT_SECRET = process.env.JWT_SECRET || (
  process.env.NODE_ENV === 'production'
    ? (() => { throw new Error('FATAL: JWT_SECRET environment variable is missing in production!'); })()
    : 'dev-jwt-secret-meta-crm-local'
);

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';

export interface JwtPayload {
  sub: string;
  tenant_id: string;
  email?: string;
  role: string;
  platform_role?: string;
  branch_id?: string;
  branch_ids?: string[];
  vertical_ids?: string[];
  assignment_ids?: string[];
  is_impersonating?: boolean;
  admin_user_id?: string;
  iat?: number;
  exp?: number;
}

export function signJwt(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN as any,
  });
}

export function verifyJwt(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export function payloadToScope(payload: JwtPayload): RequestScope {
  return {
    user_id: payload.sub,
    tenant_id: payload.tenant_id,
    email: payload.email,
    role: payload.role,
    platform_role: payload.platform_role,
    branch_id: payload.branch_id,
    branch_ids: payload.branch_ids,
    vertical_ids: payload.vertical_ids ?? [],
    assignment_ids: payload.assignment_ids ?? [],
    is_impersonating: payload.is_impersonating,
    admin_user_id: payload.admin_user_id,
  };
}
