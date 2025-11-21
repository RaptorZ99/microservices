import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BooksService } from './books.service';
import { PrismaService } from '../prisma/prisma.service';
import { OpenLibraryService } from './open-library.service';

describe('BooksService', () => {
  let service: BooksService;

  const prisma = {
    libraryEntry: {
      create: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  } as unknown as PrismaService;

  const openLibrary = {
    search: jest.fn(),
    workSummary: jest.fn(),
    workDetails: jest.fn(),
  } as unknown as OpenLibraryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BooksService(prisma, openLibrary);
  });

  describe('search', () => {
    it('rejects empty query', async () => {
      await expect(service.search('   ', 'title')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('delegates to OpenLibrary with trimmed query and default scope', async () => {
      const previews = [{ workId: 'w1' } as any];
      (openLibrary.search as jest.Mock).mockResolvedValue(previews);

      const result = await service.search('  dune ', 'title');

      expect(openLibrary.search).toHaveBeenCalledWith('dune', 'title');
      expect(result).toEqual(previews);
    });

    it('wraps OpenLibrary errors in InternalServerErrorException', async () => {
      (openLibrary.search as jest.Mock).mockRejectedValue(new Error('down'));

      await expect(service.search('dune', 'author')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('addBook', () => {
    it('creates entry and returns summary', async () => {
      const now = new Date();
      (prisma.libraryEntry.create as jest.Mock).mockResolvedValue({
        id: 10,
        createdAt: now,
      });
      (openLibrary.workSummary as jest.Mock).mockResolvedValue({
        workId: 'W1',
        title: 'Dune',
        authors: ['Frank Herbert'],
      });

      const result = await service.addBook('user1', { workId: '/works/W1' });

      expect(prisma.libraryEntry.create).toHaveBeenCalledWith({
        data: { user: 'user1', workId: 'W1' },
      });
      expect(openLibrary.workSummary).toHaveBeenCalledWith('W1');
      expect(result).toMatchObject({
        entryId: 10,
        addedAt: now,
        title: 'Dune',
      });
    });

    it('throws ConflictException on duplicate (P2002)', async () => {
      const duplicateErr = Object.assign(new Error('dup'), { code: 'P2002' });
      Object.setPrototypeOf(
        duplicateErr,
        Prisma.PrismaClientKnownRequestError.prototype,
      );
      (prisma.libraryEntry.create as jest.Mock).mockRejectedValue(duplicateErr);

      await expect(service.addBook('u1', { workId: 'W1' })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('listLibrary', () => {
    it('returns previews with fallback when summary fails', async () => {
      const entries = [
        { id: 1, workId: 'W1', createdAt: new Date('2023-01-01') },
        { id: 2, workId: 'W2', createdAt: new Date('2023-01-02') },
      ];
      (prisma.libraryEntry.findMany as jest.Mock).mockResolvedValue(entries);
      (openLibrary.workSummary as jest.Mock)
        .mockResolvedValueOnce({
          workId: 'W1',
          title: 'Dune',
          authors: ['Frank Herbert'],
          editionTitle: null,
          publishYear: null,
          publishDate: null,
          coverUrl: null,
        })
        .mockRejectedValueOnce(new Error('OpenLibrary down'));

      const result = await service.listLibrary('u1');

      expect(prisma.libraryEntry.findMany).toHaveBeenCalledWith({
        where: { user: 'u1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual([
        expect.objectContaining({
          entryId: 1,
          title: 'Dune',
          workId: 'W1',
        }),
        expect.objectContaining({
          entryId: 2,
          title: 'OpenLibrary data unavailable',
          workId: 'W2',
        }),
      ]);
    });
  });

  describe('remove', () => {
    it('returns deleted boolean', async () => {
      (prisma.libraryEntry.deleteMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      const res = await service.remove('u1', 'W1');
      expect(prisma.libraryEntry.deleteMany).toHaveBeenCalledWith({
        where: { user: 'u1', workId: 'W1' },
      });
      expect(res).toEqual({ deleted: true });
    });
  });

  describe('details', () => {
    it('returns details from OpenLibrary', async () => {
      const detail = { workId: 'W1', title: 'Dune', authors: [] } as any;
      (openLibrary.workDetails as jest.Mock).mockResolvedValue(detail);

      const res = await service.details('W1');
      expect(openLibrary.workDetails).toHaveBeenCalledWith('W1');
      expect(res).toEqual(detail);
    });

    it('throws NotFoundException on 404 message', async () => {
      (openLibrary.workDetails as jest.Mock).mockRejectedValue(
        new Error('404 Not Found'),
      );

      await expect(service.details('W1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('wraps other errors as InternalServerErrorException', async () => {
      (openLibrary.workDetails as jest.Mock).mockRejectedValue(
        new Error('timeout'),
      );

      await expect(service.details('W1')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });
});
