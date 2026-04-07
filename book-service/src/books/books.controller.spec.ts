/**
 * Tests unitaires de BooksController
 *
 * BooksService est mocké — on vérifie uniquement que le controller
 * délègue correctement les appels au service avec les bons arguments.
 * JwtAuthGuard est bypassé via .overrideGuard().
 * Pattern AAA : Arrange / Act / Assert.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt-payload.interface';

// ─────────────────────────────────────────────────────────────────
// Mock de BooksService
// ─────────────────────────────────────────────────────────────────
const mockBooksService = {
  search: jest.fn(),
  listLibrary: jest.fn(),
  addBook: jest.fn(),
  remove: jest.fn(),
  details: jest.fn(),
};

const mockJwtAuthGuard = { canActivate: jest.fn(() => true) };

const mockUser: JwtPayload = { sub: 'user-1', exp: 0, type: 'access' };

describe('BooksController', () => {
  let controller: BooksController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BooksController],
      providers: [{ provide: BooksService, useValue: mockBooksService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

    controller = module.get<BooksController>(BooksController);
  });

  // ─────────────────────────────────────────────────────────────────
  // search()
  // ─────────────────────────────────────────────────────────────────
  describe('search()', () => {
    it('doit utiliser le scope title par défaut', async () => {
      // Arrange
      mockBooksService.search.mockResolvedValue([{ workId: 'W1' }]);

      // Act
      const result = await controller.search('dune', undefined as any);

      // Assert
      expect(mockBooksService.search).toHaveBeenCalledWith('dune', 'title');
      expect(result).toEqual([{ workId: 'W1' }]);
    });

    it('doit utiliser le scope author quand fourni', async () => {
      // Arrange
      mockBooksService.search.mockResolvedValue([{ workId: 'W2' }]);

      // Act
      await controller.search('herbert', 'author');

      // Assert
      expect(mockBooksService.search).toHaveBeenCalledWith('herbert', 'author');
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // library()
  // ─────────────────────────────────────────────────────────────────
  describe('library()', () => {
    it("doit retourner la bibliothèque de l'utilisateur", async () => {
      // Arrange
      const lib = [{ workId: 'W1', title: 'Dune' }];
      mockBooksService.listLibrary.mockResolvedValue(lib);

      // Act
      const result = await controller.library(mockUser);

      // Assert
      expect(mockBooksService.listLibrary).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(lib);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // add()
  // ─────────────────────────────────────────────────────────────────
  describe('add()', () => {
    it("doit ajouter un livre pour l'utilisateur", async () => {
      // Arrange
      mockBooksService.addBook.mockResolvedValue({ entryId: 1 });

      // Act
      const result = await controller.add(mockUser, { workId: 'W1' });

      // Assert
      expect(mockBooksService.addBook).toHaveBeenCalledWith('user-1', {
        workId: 'W1',
      });
      expect(result).toEqual({ entryId: 1 });
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // remove()
  // ─────────────────────────────────────────────────────────────────
  describe('remove()', () => {
    it("doit supprimer un livre pour l'utilisateur", async () => {
      // Arrange
      mockBooksService.remove.mockResolvedValue({ deleted: true });

      // Act
      const result = await controller.remove(mockUser, 'W1');

      // Assert
      expect(mockBooksService.remove).toHaveBeenCalledWith('user-1', 'W1');
      expect(result).toEqual({ deleted: true });
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // details()
  // ─────────────────────────────────────────────────────────────────
  describe('details()', () => {
    it('doit retourner les détails du livre', async () => {
      // Arrange
      const detail = { workId: 'W1', title: 'Dune' };
      mockBooksService.details.mockResolvedValue(detail);

      // Act
      const result = await controller.details('W1');

      // Assert
      expect(mockBooksService.details).toHaveBeenCalledWith('W1');
      expect(result).toEqual(detail);
    });
  });
});
