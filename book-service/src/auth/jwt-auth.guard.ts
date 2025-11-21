import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';

/**
 * Reproduit la logique de validation utilisée par order-service :
 * - récupère le header Authorization
 * - vérifie la signature et l'expiration via le secret partagé
 * - expose le payload JWT dans req.user
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.headers['authorization'];

    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or malformed token');
    }

    const token = authorization.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'change-me';

    try {
      const payload = jwt.verify(token, secret);
      (request as any).user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
