import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import * as jwt from 'jsonwebtoken';

describe('JwtAuthGuard', () => {
  const secret = 'test-secret';
  const guard = new JwtAuthGuard();

  const buildContext = (headers: Record<string, string> = {}) => {
    const req: any = { headers };
    return {
      switchToHttp: () => ({ getRequest: () => req }),
    } as any;
  };

  beforeEach(() => {
    process.env.JWT_SECRET = secret;
  });

  it('rejects when Authorization header is missing', () => {
    const ctx = buildContext();
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('rejects malformed bearer token', () => {
    const ctx = buildContext({ authorization: 'Token abc' });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('rejects invalid token signature', () => {
    const token = jwt.sign({ sub: 'user1' }, 'wrong-secret');
    const ctx = buildContext({ authorization: `Bearer ${token}` });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('accepts valid token and attaches user payload to request', () => {
    const token = jwt.sign({ sub: 'user1' }, secret, { expiresIn: '1h' });
    const context = buildContext({ authorization: `Bearer ${token}` });

    const allowed = guard.canActivate(context);
    const req = context.switchToHttp().getRequest();

    expect(allowed).toBe(true);
    expect(req.user).toMatchObject({ sub: 'user1' });
  });

  it('uses default secret when env is not set', () => {
    delete process.env.JWT_SECRET;
    const token = jwt.sign({ sub: 'user2' }, 'change-me');
    const context = buildContext({ authorization: `Bearer ${token}` });

    const allowed = guard.canActivate(context);
    const req = context.switchToHttp().getRequest();

    expect(allowed).toBe(true);
    expect(req.user).toMatchObject({ sub: 'user2' });
  });

  it('rejects expired token', () => {
    const expired = jwt.sign({ sub: 'user3' }, secret, { expiresIn: -1 });
    const context = buildContext({ authorization: `Bearer ${expired}` });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
