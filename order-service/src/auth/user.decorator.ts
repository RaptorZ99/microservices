import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// Helper séparé pour faciliter les tests unitaires.
export const getUserFromContext = (ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  return req.user;
};

/**
 * Expose req.user dans les méthodes des contrôleurs.
 * Usage :  create(@User() user)
 */
export const User = createParamDecorator((_, ctx: ExecutionContext) => {
  return getUserFromContext(ctx);
});
