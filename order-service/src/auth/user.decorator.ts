import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Expose req.user dans les méthodes des contrôleurs.
 * Usage :  create(@User() user)
 */
export const User = createParamDecorator((_, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  return req.user;
});
