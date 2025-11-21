import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import * as jwt from 'jsonwebtoken';

describe('JwtAuthGuard', () => {
  const guard = new JwtAuthGuard();
  const secret = 'test-secret';

  const ctxFor = (headers: Record<string, string> = {}) => {
    const req: any = { headers };
    return {
      switchToHttp: () => ({ getRequest: () => req }),
    } as any;
  };

  beforeEach(() => {
    process.env.JWT_SECRET = secret;
  });

  it('throws when header is missing', () => {
    expect(() => guard.canActivate(ctxFor())).toThrow(UnauthorizedException);
  });

  it('throws when header is malformed', () => {
    expect(() => guard.canActivate(ctxFor({ authorization: 'Token abc' })) ).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects invalid token', () => {
    const token = jwt.sign({ sub: 'u1' }, 'wrong');
    expect(() => guard.canActivate(ctxFor({ authorization: `Bearer ${token}` })) ).toThrow(
      UnauthorizedException,
    );
  });

  it('accepts valid token with secret and attaches payload', () => {
    const token = jwt.sign({ sub: 'u1' }, secret, { expiresIn: '1h' });
    const ctx = ctxFor({ authorization: `Bearer ${token}` });

    const allowed = guard.canActivate(ctx);
    const req = ctx.switchToHttp().getRequest();

    expect(allowed).toBe(true);
    expect(req.user).toMatchObject({ sub: 'u1' });
  });

  it('accepts valid token using default secret when env unset', () => {
    delete process.env.JWT_SECRET;
    const token = jwt.sign({ sub: 'u2' }, 'change-me', { expiresIn: '1h' });
    const ctx = ctxFor({ authorization: `Bearer ${token}` });

    expect(guard.canActivate(ctx)).toBe(true);
  });
});
