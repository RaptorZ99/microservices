import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddBookDto } from './dto/add-book.dto';
import {
  BookDetail,
  BookPreview,
  OpenLibraryService,
} from './open-library.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class BooksService {
  constructor(
    private prisma: PrismaService,
    private openLibrary: OpenLibraryService,
  ) {}

  async search(
    query: string,
    scope: 'title' | 'author',
  ): Promise<BookPreview[]> {
    if (!query || !query.trim()) {
      throw new BadRequestException('query is required');
    }

    try {
      return await this.openLibrary.search(query.trim(), scope);
    } catch (error) {
      throw new InternalServerErrorException(
        'OpenLibrary search is unavailable',
        { cause: error },
      );
    }
  }

  async addBook(user: string, dto: AddBookDto) {
    const workId = this.normalizeWork(dto.workId);

    try {
      const entry = await this.prisma.libraryEntry.create({
        data: {
          user,
          workId,
        },
      });

      const preview = await this.safeSummary(workId);
      return { entryId: entry.id, addedAt: entry.createdAt, ...preview };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Book already stored for this user');
      }
      throw error;
    }
  }

  async listLibrary(user: string) {
    const entries = await this.prisma.libraryEntry.findMany({
      where: { user },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(
      entries.map(async (entry) => {
        const preview = await this.safeSummary(entry.workId);
        return {
          entryId: entry.id,
          addedAt: entry.createdAt,
          ...preview,
        };
      }),
    );
  }

  async remove(user: string, workId: string) {
    const normalized = this.normalizeWork(workId);
    const res = await this.prisma.libraryEntry.deleteMany({
      where: { user, workId: normalized },
    });
    return { deleted: res.count > 0 };
  }

  async details(workId: string): Promise<BookDetail> {
    const normalized = this.normalizeWork(workId);
    try {
      return await this.openLibrary.workDetails(normalized);
    } catch (error: any) {
      if (error?.message?.includes('404')) {
        throw new NotFoundException('Book not found');
      }

      throw new InternalServerErrorException('Cannot fetch book details', {
        cause: error,
      });
    }
  }

  private async safeSummary(workId: string): Promise<BookPreview> {
    try {
      return await this.openLibrary.workSummary(workId);
    } catch {
      return {
        workId,
        title: 'OpenLibrary data unavailable',
        authors: [],
        editionTitle: null,
        publishYear: null,
        publishDate: null,
        coverUrl: null,
      };
    }
  }

  private normalizeWork(workId: string) {
    return workId.replace('/works/', '').replace(/^\/+/, '').trim();
  }
}
