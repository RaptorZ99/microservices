/**
 * Tests unitaires de lib/api.ts
 *
 * fetch est mocké globalement — aucun appel réseau n'est effectué.
 * Pattern AAA : Arrange / Act / Assert.
 */

import { serverApi } from '../../lib/api';

// Mock global de fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Helper : simule une réponse HTTP réussie avec un body JSON
function mockSuccess(body: unknown, status = 200) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status,
    json: async () => body,
  });
}

// Helper : simule une réponse HTTP en erreur
function mockError(status: number) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => ({}),
  });
}

describe('serverApi', () => {
  beforeEach(() => mockFetch.mockReset());

  // ─────────────────────────────────────────────────────────────────
  // get()
  // ─────────────────────────────────────────────────────────────────
  describe('get()', () => {
    it('doit appeler fetch avec la bonne URL construite depuis baseURL + path', async () => {
      // Arrange
      mockSuccess({ status: 'ok' });
      const api = serverApi('http://localhost:8000');

      // Act
      await api.get('/health');

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/health',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('doit retourner le body JSON parsé', async () => {
      // Arrange
      const expected = { status: 'ok', service: 'auth-service' };
      mockSuccess(expected);
      const api = serverApi('http://localhost:8000');

      // Act
      const result = await api.get('/health');

      // Assert
      expect(result).toEqual(expected);
    });

    it('doit lever une erreur si la réponse HTTP est non-ok', async () => {
      // Arrange
      mockError(404);
      const api = serverApi('http://localhost:8000');

      // Act & Assert
      await expect(api.get('/inexistant')).rejects.toThrow(
        'GET /inexistant → 404',
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // post()
  // ─────────────────────────────────────────────────────────────────
  describe('post()', () => {
    it('doit envoyer le Content-Type application/json', async () => {
      // Arrange
      mockSuccess({ access_token: 'token-abc' });
      const api = serverApi('http://localhost:8000');

      // Act
      await api.post('/auth/login', { username: 'alice', password: 'secret' });

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/auth/login',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        }),
      );
    });

    it('doit sérialiser le body en JSON', async () => {
      // Arrange
      mockSuccess({ access_token: 'token-abc' });
      const api = serverApi('http://localhost:8000');
      const payload = { username: 'alice', password: 'secret' };

      // Act
      await api.post('/auth/login', payload);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify(payload),
        }),
      );
    });

    it('doit lever une erreur si la réponse HTTP est non-ok', async () => {
      // Arrange
      mockError(401);
      const api = serverApi('http://localhost:8000');

      // Act & Assert
      await expect(
        api.post('/auth/login', { username: 'alice', password: 'wrong' }),
      ).rejects.toThrow('POST /auth/login → 401');
    });

    it("doit utiliser un body vide si aucun body n'est fourni", async () => {
      // Arrange
      mockSuccess({});
      const api = serverApi('http://localhost:8000');

      // Act
      await api.post('/auth/logout');

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ body: JSON.stringify({}) }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // baseURL par défaut
  // ─────────────────────────────────────────────────────────────────
  describe('baseURL par défaut', () => {
    it("doit utiliser http://localhost:3000/api si aucune baseURL n'est fournie", async () => {
      // Arrange
      mockSuccess({});
      delete process.env.NEXT_PUBLIC_API_BASE;
      const api = serverApi();

      // Act
      await api.get('/health');

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/health',
        expect.anything(),
      );
    });
  });
});
