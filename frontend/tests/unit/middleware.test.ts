/**
 * Tests unitaires de middleware.ts
 *
 * On crée de vraies NextRequest avec ou sans cookie pour tester
 * le comportement de redirection.
 * Pattern AAA : Arrange / Act / Assert.
 */

import { middleware } from '../../middleware';
import { NextRequest } from 'next/server';

// Helper : crée une NextRequest simulée avec ou sans cookie access_token
function makeRequest(path: string, withToken: boolean): NextRequest {
  const url = `http://localhost:3000${path}`;
  const headers = new Headers();

  if (withToken) {
    headers.set('cookie', 'access_token=fake-jwt-token');
  }

  return new NextRequest(url, { headers });
}

describe('middleware', () => {
  // ─────────────────────────────────────────────────────────────────
  // Sans cookie access_token
  // ─────────────────────────────────────────────────────────────────
  describe('sans cookie access_token', () => {
    it('doit rediriger (statut 3xx)', () => {
      // Arrange
      const request = makeRequest('/order/list', false);

      // Act
      const response = middleware(request);

      // Assert — NextResponse.redirect retourne un statut 307 ou 308
      expect(response.status).toBeGreaterThanOrEqual(300);
      expect(response.status).toBeLessThan(400);
    });

    it('doit rediriger vers / avec le paramètre reason=auth-required', () => {
      // Arrange
      const request = makeRequest('/order/list', false);

      // Act
      const response = middleware(request);

      // Assert
      const location = response.headers.get('location') ?? '';
      expect(location).toContain('reason=auth-required');
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Avec cookie access_token
  // ─────────────────────────────────────────────────────────────────
  describe('avec cookie access_token', () => {
    it('doit laisser passer la requête (statut 200)', () => {
      // Arrange
      const request = makeRequest('/order/list', true);

      // Act
      const response = middleware(request);

      // Assert — NextResponse.next() retourne 200
      expect(response.status).toBe(200);
    });
  });
});
