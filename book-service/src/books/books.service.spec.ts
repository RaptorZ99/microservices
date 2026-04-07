/**
 * Tests unitaires de BooksService
 *
 * PrismaService et OpenLibraryService sont remplacés par des mocks :
 * aucune connexion DB ni appel réseau.
 * Pattern AAA : Arrange / Act / Assert.
 */

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

// ─────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────
const mockPrisma = {
  libraryEntry: {
    create: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
} as unknown as PrismaService;

const mockOpenLibrary = {
  search: jest.fn(),
  workSummary: jest.fn(),
  workDetails: jest.fn(),
} as unknown as OpenLibraryService;

describe('BooksService', () => {
  let service: BooksService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BooksService(mockPrisma, mockOpenLibrary);
  });

  // ─────────────────────────────────────────────────────────────────
  // search()
  // ─────────────────────────────────────────────────────────────────
  describe('search()', () => {
    it('doit rejeter une query vide avec BadRequestException', async () => {
      // Act & Assert
      await expect(service.search('   ', 'title')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('doit déléguer à OpenLibrary avec la query trimmée', async () => {
      // Arrange
      const previews = [{ workId: 'W1', title: 'Dune' } as any];
      (mockOpenLibrary.search as jest.Mock).mockResolvedValue(previews);

      // Act
      const result = await service.search('  dune ', 'title');

      // Assert
      expect(mockOpenLibrary.search).toHaveBeenCalledWith('dune', 'title');
      expect(result).toEqual(previews);
    });

    it('doit supporter le scope author', async () => {
      // Arrange
      (mockOpenLibrary.search as jest.Mock).mockResolvedValue([]);

      // Act
      await service.search('herbert', 'author');

      // Assert
      expect(mockOpenLibrary.search).toHaveBeenCalledWith('herbert', 'author');
    });

    it('doit wrapper les erreurs OpenLibrary en InternalServerErrorException', async () => {
      // Arrange
      (mockOpenLibrary.search as jest.Mock).mockRejectedValue(
        new Error('down'),
      );

      // Act & Assert
      await expect(service.search('dune', 'author')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // addBook()
  // ─────────────────────────────────────────────────────────────────
  describe('addBook()', () => {
    it('doit créer une entrée et retourner le résumé', async () => {
      // Arrange
      const now = new Date();
      (mockPrisma.libraryEntry.create as jest.Mock).mockResolvedValue({
        id: 10,
        createdAt: now,
      });
      (mockOpenLibrary.workSummary as jest.Mock).mockResolvedValue({
        workId: 'W1',
        title: 'Dune',
        authors: ['Frank Herbert'],
      });

      // Act
      const result = await service.addBook('user1', { workId: '/works/W1' });

      // Assert
      expect(mockPrisma.libraryEntry.create).toHaveBeenCalledWith({
        data: { user: 'user1', workId: 'W1' },
      });
      expect(mockOpenLibrary.workSummary).toHaveBeenCalledWith('W1');
      expect(result).toMatchObject({
        entryId: 10,
        addedAt: now,
        title: 'Dune',
      });
    });

    it('doit normaliser le workId en retirant /works/', async () => {
      // Arrange
      (mockPrisma.libraryEntry.create as jest.Mock).mockResolvedValue({
        id: 1,
        createdAt: new Date(),
      });
      (mockOpenLibrary.workSummary as jest.Mock).mockResolvedValue({
        workId: 'OL123W',
        title: 'Test',
        authors: [],
      });

      // Act
      await service.addBook('u1', { workId: '/works/OL123W' });

      // Assert
      expect(mockPrisma.libraryEntry.create).toHaveBeenCalledWith({
        data: { user: 'u1', workId: 'OL123W' },
      });
    });

    it('doit lever ConflictException en cas de doublon (P2002)', async () => {
      // Arrange
      const duplicateErr = Object.assign(new Error('dup'), { code: 'P2002' });
      Object.setPrototypeOf(
        duplicateErr,
        Prisma.PrismaClientKnownRequestError.prototype,
      );
      (mockPrisma.libraryEntry.create as jest.Mock).mockRejectedValue(
        duplicateErr,
      );

      // Act & Assert
      await expect(
        service.addBook('u1', { workId: 'W1' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // listLibrary()
  // ─────────────────────────────────────────────────────────────────
  describe('listLibrary()', () => {
    it('doit retourner les previews avec fallback quand le summary échoue', async () => {
      // Arrange
      const entries = [
        { id: 1, workId: 'W1', createdAt: new Date('2023-01-01') },
        { id: 2, workId: 'W2', createdAt: new Date('2023-01-02') },
      ];
      (mockPrisma.libraryEntry.findMany as jest.Mock).mockResolvedValue(
        entries,
      );
      (mockOpenLibrary.workSummary as jest.Mock)
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

      // Act
      const result = await service.listLibrary('u1');

      // Assert
      expect(mockPrisma.libraryEntry.findMany).toHaveBeenCalledWith({
        where: { user: 'u1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual([
        expect.objectContaining({ entryId: 1, title: 'Dune', workId: 'W1' }),
        expect.objectContaining({
          entryId: 2,
          title: 'OpenLibrary data unavailable',
          workId: 'W2',
        }),
      ]);
    });

    it('doit retourner un tableau vide si la bibliothèque est vide', async () => {
      // Arrange
      (mockPrisma.libraryEntry.findMany as jest.Mock).mockResolvedValue([]);

      // Act
      const result = await service.listLibrary('user-vide');

      // Assert
      expect(result).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // remove()
  // ─────────────────────────────────────────────────────────────────
  describe('remove()', () => {
    it('doit retourner deleted: true quand une entrée est supprimée', async () => {
      // Arrange
      (mockPrisma.libraryEntry.deleteMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      // Act
      const result = await service.remove('u1', 'W1');

      // Assert
      expect(mockPrisma.libraryEntry.deleteMany).toHaveBeenCalledWith({
        where: { user: 'u1', workId: 'W1' },
      });
      expect(result).toEqual({ deleted: true });
    });

    it("doit retourner deleted: false si l'entrée n'existe pas", async () => {
      // Arrange
      (mockPrisma.libraryEntry.deleteMany as jest.Mock).mockResolvedValue({
        count: 0,
      });

      // Act
      const result = await service.remove('u1', 'INEXISTANT');

      // Assert
      expect(result).toEqual({ deleted: false });
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // details()
  // ─────────────────────────────────────────────────────────────────
  describe('details()', () => {
    it('doit retourner les détails depuis OpenLibrary', async () => {
      // Arrange
      const detail = { workId: 'W1', title: 'Dune', authors: [] } as any;
      (mockOpenLibrary.workDetails as jest.Mock).mockResolvedValue(detail);

      // Act
      const result = await service.details('W1');

      // Assert
      expect(mockOpenLibrary.workDetails).toHaveBeenCalledWith('W1');
      expect(result).toEqual(detail);
    });

    it('doit lever NotFoundException sur une erreur 404', async () => {
      // Arrange
      (mockOpenLibrary.workDetails as jest.Mock).mockRejectedValue(
        new Error('404 Not Found'),
      );

      // Act & Assert
      await expect(service.details('W1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('doit wrapper les autres erreurs en InternalServerErrorException', async () => {
      // Arrange
      (mockOpenLibrary.workDetails as jest.Mock).mockRejectedValue(
        new Error('timeout'),
      );

      // Act & Assert
      await expect(service.details('W1')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });
});
