export interface JwtPayload {
  sub: string;
  exp: number;
  type: 'access' | 'refresh';
}
