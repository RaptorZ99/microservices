import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Simplifie l'accès au payload JWT depuis les contrôleurs.
 * Usage : handler(@User() user)
 */
export const getUserFromContext = (ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
};

export const User = createParamDecorator((_, ctx: ExecutionContext) => {
  return getUserFromContext(ctx);
});
