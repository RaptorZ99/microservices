import { Injectable } from '@nestjs/common';

export interface BookPreview {
  workId: string;
  title: string;
  authors: string[];
  editionTitle?: string | null;
  publishYear?: number | null;
  publishDate?: string | null;
  coverUrl?: string | null;
}

export interface BookDetail extends BookPreview {
  description?: string | null;
  subjects: string[];
  coverGallery: string[];
  links: { title: string; url: string }[];
  editions: {
    key: string;
    title: string;
    publishDate?: string | null;
    coverUrl?: string | null;
  }[];
}

type SearchScope = 'title' | 'author';

interface SearchResponse {
  docs?: Array<Record<string, any>>;
}

interface WorkResponse {
  key?: string;
  title?: string;
  description?: string | { value?: string };
  subjects?: string[];
  covers?: number[];
  authors?: Array<{ author?: { key?: string } }>;
  first_publish_date?: string;
  created?: { value?: string };
  links?: Array<{ title?: string; url?: string }>;
}

interface EditionsResponse {
  entries?: Array<{
    key?: string;
    title?: string;
    publish_date?: string;
    covers?: number[];
  }>;
}

@Injectable()
export class OpenLibraryService {
  private readonly baseUrl = 'https://openlibrary.org';
  private readonly searchFields =
    'key,title,author_name,first_publish_year,cover_i,editions,editions.key,editions.title,editions.publish_date';
  private readonly searchLimit = Number(process.env.BOOK_SEARCH_LIMIT || 10);
  private readonly userAgent =
    process.env.OPENLIBRARY_USER_AGENT ||
    'BookInsights/1.0 (contact@example.com)';
  private readonly authorCache = new Map<string, string>();

  async search(query: string, scope: SearchScope): Promise<BookPreview[]> {
    const params = new URLSearchParams({
      fields: this.searchFields,
      limit: String(this.searchLimit),
    });

    if (scope === 'author') params.set('author', query);
    else params.set('q', query);

    const data = await this.fetchJson<SearchResponse>('/search.json', params);
    return (data.docs || [])
      .map((doc) => this.mapDocToPreview(doc))
      .filter((item): item is BookPreview => !!item);
  }

  async workSummary(workId: string): Promise<BookPreview> {
    const work = await this.fetchWork(workId);
    const [authors, editions] = await Promise.all([
      this.resolveAuthors(work.authors || []),
      this.fetchEditions(workId, 1),
    ]);

    const firstEdition = editions[0];

    return {
      workId: this.normalizeWorkKey(work.key || workId) || workId,
      title: work.title || 'Unknown book',
      authors,
      editionTitle: firstEdition?.title || null,
      publishYear: this.extractYear(
        work.first_publish_date || work.created?.value,
      ),
      publishDate: firstEdition?.publish_date || null,
      coverUrl: this.coverFromId(firstEdition?.covers?.[0] || work.covers?.[0]),
    };
  }

  async workDetails(workId: string): Promise<BookDetail> {
    const work = await this.fetchWork(workId);
    const [authors, editions] = await Promise.all([
      this.resolveAuthors(work.authors || []),
      this.fetchEditions(workId, 5),
    ]);

    const previews: BookPreview = {
      workId: this.normalizeWorkKey(work.key || workId) || workId,
      title: work.title || 'Unknown book',
      authors,
      editionTitle: editions[0]?.title || null,
      publishYear: this.extractYear(
        work.first_publish_date || work.created?.value,
      ),
      publishDate: editions[0]?.publish_date || null,
      coverUrl: this.coverFromId(work.covers?.[0]),
    };

    const coverGallery =
      (work.covers || [])
        .slice(0, 6)
        .map((id) => this.coverFromId(id))
        .filter((url): url is string => !!url) || [];

    return {
      ...previews,
      description: this.extractDescription(work.description),
      subjects: (work.subjects || []).slice(0, 12),
      coverGallery,
      links: (work.links || [])
        .map((link) => ({
          title: link.title || 'Lien',
          url: link.url || '',
        }))
        .filter((link) => !!link.url),
      editions: editions.map((edition) => ({
        key: edition.key || '',
        title: edition.title || 'Edition',
        publishDate: edition.publish_date || null,
        coverUrl: this.coverFromId(edition.covers?.[0]),
      })),
    };
  }

  private mapDocToPreview(doc: Record<string, any>): BookPreview | null {
    const workId = this.normalizeWorkKey(doc.key);
    if (!workId) return null;

    const editionDoc = doc.editions?.docs?.[0];
    const authors = Array.isArray(doc.author_name)
      ? doc.author_name.slice(0, 3)
      : [];

    return {
      workId,
      title: doc.title || 'Unknown book',
      authors,
      editionTitle: editionDoc?.title || null,
      publishYear: doc.first_publish_year || null,
      publishDate: editionDoc?.publish_date || null,
      coverUrl: this.coverFromId(doc.cover_i),
    };
  }

  private coverFromId(id?: number | null): string | null {
    if (!id || id <= 0) return null;
    return `https://covers.openlibrary.org/b/id/${id}-M.jpg`;
  }

  private async fetchWork(workId: string): Promise<WorkResponse> {
    const path = this.workPath(workId);
    return this.fetchJson<WorkResponse>(`${path}.json`);
  }

  private async fetchEditions(
    workId: string,
    limit: number,
  ): Promise<
    Array<{
      key?: string;
      title?: string;
      publish_date?: string;
      covers?: number[];
    }>
  > {
    const path = `${this.workPath(workId)}/editions.json`;
    const data = await this.fetchJson<EditionsResponse>(path, {
      limit: String(limit),
    });
    return data.entries || [];
  }

  private async resolveAuthors(
    authors: Array<{ author?: { key?: string } }>,
  ): Promise<string[]> {
    const tasks = authors.slice(0, 3).map((entry) => {
      const key = entry.author?.key;
      return key ? this.fetchAuthorName(key) : Promise.resolve(null);
    });

    const resolved = await Promise.all(tasks);
    return resolved.filter((name): name is string => !!name);
  }

  private async fetchAuthorName(key: string): Promise<string | null> {
    if (this.authorCache.has(key)) {
      return this.authorCache.get(key) || null;
    }

    try {
      const data = await this.fetchJson<{ name?: string }>(`${key}.json`);
      const name = data.name || null;
      if (name) this.authorCache.set(key, name);
      return name;
    } catch {
      return null;
    }
  }

  private async fetchJson<T>(
    path: string,
    params?: Record<string, string> | URLSearchParams,
  ): Promise<T> {
    const url =
      path.startsWith('http') || path.startsWith('https')
        ? new URL(path)
        : new URL(`${this.baseUrl}${path}`);

    if (params instanceof URLSearchParams) {
      params.forEach((value, key) => url.searchParams.set(key, value));
    } else if (params) {
      Object.entries(params).forEach(([key, value]) =>
        url.searchParams.set(key, value),
      );
    }

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': this.userAgent,
      },
    });

    if (!response.ok) {
      throw new Error(`OpenLibrary ${url.pathname} → ${response.status}`);
    }

    return (await response.json()) as T;
  }

  private extractDescription(
    description?: string | { value?: string },
  ): string | null {
    if (!description) return null;
    if (typeof description === 'string') return description;
    return description.value || null;
  }

  private extractYear(date?: string): number | null {
    if (!date) return null;
    const match = date.match(/\d{4}/);
    return match ? Number(match[0]) : null;
  }

  private normalizeWorkKey(key?: string): string | null {
    if (!key) return null;
    return key.replace('/works/', '').replace(/^\/+/, '');
  }

  private workPath(workId: string): string {
    if (!workId) return '/works/';
    if (workId.startsWith('/works/')) return workId;
    return `/works/${workId}`;
  }
}
