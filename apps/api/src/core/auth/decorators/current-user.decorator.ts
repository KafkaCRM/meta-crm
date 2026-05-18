import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestScope } from '../jwt.strategy';

export const CurrentUser = createParamDecorator(
  (data: keyof RequestScope | undefined, ctx: ExecutionContext): RequestScope | RequestScope[keyof RequestScope] => {
    const request = ctx.switchToHttp().getRequest();
    const scope: RequestScope = request.user;
    if (data) {
      return scope[data];
    }
    return scope;
  },
);
