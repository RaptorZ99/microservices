/**
 * Tests unitaires de OrdersService
 *
 * PrismaService est remplacé par un mock complet :
 * aucune connexion à la base de données n'est établie.
 * Pattern AAA : Arrange / Act / Assert.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';

// ─────────────────────────────────────────────────────────────────
// Mock de PrismaService
// ─────────────────────────────────────────────────────────────────
const mockPrismaService = {
  order: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    deleteMany: jest.fn(),
  },
};

describe('OrdersService', () => {
  let service: OrdersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────
  // create()
  // ─────────────────────────────────────────────────────────────────
  describe('create()', () => {
    it('doit créer une commande et la retourner', async () => {
      // Arrange
      const user = 'alice';
      const dto = { item: 'Laptop' };
      const expected = { id: 1, user, item: 'Laptop', createdAt: new Date() };
      mockPrismaService.order.create.mockResolvedValue(expected);

      // Act
      const result = await service.create(user, dto);

      // Assert — résultat correct
      expect(result).toEqual(expected);
      // Assert — Prisma appelé avec les bons arguments
      expect(mockPrismaService.order.create).toHaveBeenCalledWith({
        data: { user, item: dto.item },
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // findAll()
  // ─────────────────────────────────────────────────────────────────
  describe('findAll()', () => {
    it("doit retourner la liste des commandes de l'utilisateur", async () => {
      // Arrange
      const user = 'alice';
      const expected = [
        { id: 1, user, item: 'Laptop', createdAt: new Date() },
        { id: 2, user, item: 'Mouse', createdAt: new Date() },
      ];
      mockPrismaService.order.findMany.mockResolvedValue(expected);

      // Act
      const result = await service.findAll(user);

      // Assert
      expect(result).toEqual(expected);
      expect(mockPrismaService.order.findMany).toHaveBeenCalledWith({
        where: { user },
        orderBy: { createdAt: 'desc' },
      });
    });

    it("doit retourner un tableau vide si l'utilisateur n'a pas de commandes", async () => {
      // Arrange
      mockPrismaService.order.findMany.mockResolvedValue([]);

      // Act
      const result = await service.findAll('user-sans-commande');

      // Assert
      expect(result).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // findOne()
  // ─────────────────────────────────────────────────────────────────
  describe('findOne()', () => {
    it("doit retourner la commande si elle appartient à l'utilisateur", async () => {
      // Arrange
      const user = 'alice';
      const order = { id: 1, user, item: 'Laptop', createdAt: new Date() };
      mockPrismaService.order.findFirst.mockResolvedValue(order);

      // Act
      const result = await service.findOne(1, user);

      // Assert
      expect(result).toEqual(order);
      expect(mockPrismaService.order.findFirst).toHaveBeenCalledWith({
        where: { id: 1, user },
      });
    });

    it("doit retourner null si la commande n'existe pas", async () => {
      // Arrange
      mockPrismaService.order.findFirst.mockResolvedValue(null);

      // Act
      const result = await service.findOne(999, 'alice');

      // Assert
      expect(result).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // remove()
  // ─────────────────────────────────────────────────────────────────
  describe('remove()', () => {
    it('doit supprimer la commande et retourner le nombre de lignes supprimées', async () => {
      // Arrange
      mockPrismaService.order.deleteMany.mockResolvedValue({ count: 1 });

      // Act
      const result = await service.remove(1, 'alice');

      // Assert
      expect(result).toEqual({ count: 1 });
      expect(mockPrismaService.order.deleteMany).toHaveBeenCalledWith({
        where: { id: 1, user: 'alice' },
      });
    });

    it("doit retourner count: 0 si la commande n'appartient pas à l'utilisateur", async () => {
      // Arrange
      mockPrismaService.order.deleteMany.mockResolvedValue({ count: 0 });

      // Act
      const result = await service.remove(1, 'autre-user');

      // Assert
      expect(result).toEqual({ count: 0 });
    });
  });
});
