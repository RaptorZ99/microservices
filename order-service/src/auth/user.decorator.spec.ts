import { ExecutionContext } from '@nestjs/common';
import { getUserFromContext, User } from './user.decorator';

describe('User decorator', () => {
  it('should return req.user from context', () => {
    const req = { user: { sub: 'user-1', role: 'user' } };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;

    const user = getUserFromContext(ctx);
    expect(user).toEqual(req.user);
  });

  it('returns undefined when user is not set', () => {
    const req = {} as any;
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;

    const user = getUserFromContext(ctx);
    expect(user).toBeUndefined();
  });
});
