import { ExecutionContext } from '@nestjs/common';
import { User, getUserFromContext } from './user.decorator';

describe('User decorator', () => {
  it('returns req.user', () => {
    const req = { user: { sub: 'u1', role: 'reader' } };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;

    const value = getUserFromContext(ctx);
    expect(value).toEqual(req.user);
  });

  it('returns undefined when user missing', () => {
    const req = {} as any;
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;

    const value = getUserFromContext(ctx);
    expect(value).toBeUndefined();
  });
});
