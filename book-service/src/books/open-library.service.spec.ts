import { OpenLibraryService } from './open-library.service';

describe('OpenLibraryService', () => {
  let service: OpenLibraryService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
    service = new OpenLibraryService();
  });

  describe('search', () => {
    it('maps search results to previews for title scope', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          docs: [
            {
              key: '/works/W1',
              title: 'Dune',
              author_name: ['Frank Herbert'],
              first_publish_year: 1965,
              cover_i: 123,
              editions: {
                docs: [
                  { title: 'First ed', publish_date: '1966', covers: [456] },
                ],
              },
            },
            {
              title: 'Missing key',
            },
          ],
        }),
      });

      const results = await service.search('dune', 'title');

      expect(fetchMock).toHaveBeenCalled();
      expect(results).toEqual([
        {
          workId: 'W1',
          title: 'Dune',
          authors: ['Frank Herbert'],
          editionTitle: 'First ed',
          publishYear: 1965,
          publishDate: '1966',
          coverUrl: 'https://covers.openlibrary.org/b/id/123-M.jpg',
        },
      ]);
    });
  });

  describe('workSummary', () => {
    it('returns summary with resolved authors and editions', async () => {
      // fetchWork
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          key: '/works/W1',
          title: 'Dune',
          first_publish_date: '1965',
          authors: [{ author: { key: '/authors/A1' } }],
          covers: [321],
        }),
      });
      // fetchAuthorName
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: 'Frank Herbert' }),
      });
      // fetchEditions
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ entries: [{ title: 'Hardcover', publish_date: '1966', covers: [654] }] }),
      });

      const summary = await service.workSummary('W1');

      expect(summary).toMatchObject({
        workId: 'W1',
        title: 'Dune',
        authors: ['Frank Herbert'],
        editionTitle: 'Hardcover',
        publishYear: 1965,
        publishDate: '1966',
      });
      expect(summary.coverUrl).toContain('covers.openlibrary.org');
    });
  });

  describe('workDetails', () => {
    it('returns detailed payload including covers, subjects, links and editions', async () => {
      // fetchWork
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          key: '/works/W9',
          title: 'Book',
          description: { value: 'A book' },
          subjects: ['s1', 's2', 's3'],
          covers: [101, 102],
          authors: [{ author: { key: '/authors/A9' } }],
          links: [
            { title: 'Link', url: 'https://example.com' },
            { title: 'Broken', url: '' },
          ],
        }),
      });
      // fetchAuthorName
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: 'Author' }),
      });
      // fetchEditions
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          entries: [
            { key: 'E1', title: 'Ed1', publish_date: '2000', covers: [201] },
            { key: 'E2', title: 'Ed2', publish_date: '2001', covers: [202] },
          ],
        }),
      });

      const detail = await service.workDetails('W9');

      expect(detail.workId).toBe('W9');
      expect(detail.authors).toEqual(['Author']);
      expect(detail.coverGallery?.length).toBeGreaterThan(0);
      expect(detail.links).toEqual([{ title: 'Link', url: 'https://example.com' }]);
      expect(detail.editions[0]).toMatchObject({ key: 'E1', title: 'Ed1' });
    });
  });

  describe('fetchJson', () => {
    it('throws on non-ok responses', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
      await expect(
        (service as any).fetchJson('/works/W1', { limit: '1' }),
      ).rejects.toThrow('OpenLibrary');
    });
  });
});
