import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';

/**
 * Vérifie la présence et la validité du token JWT.
 * Le token est signé par auth-service FastAPI avec un secret partagé.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const auth = req.headers['authorization'];

    if (!auth || !auth.startsWith('Bearer '))
      throw new UnauthorizedException('Missing or malformed token');

    const token = auth.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'change-me';

    try {
      // Vérifie signature + expiration
      const payload = jwt.verify(token, secret);

      // Injecte le payload dans la requête
      (req as any).user = payload;

      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
