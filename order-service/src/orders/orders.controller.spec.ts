/**
 * Tests unitaires de OrdersController
 *
 * OrdersService est mocké — on vérifie uniquement que le controller
 * délègue correctement les appels au service avec les bons arguments.
 * JwtAuthGuard est bypassé via .overrideGuard().
 * Pattern AAA : Arrange / Act / Assert.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt-payload.interface';

// ─────────────────────────────────────────────────────────────────
// Mock de OrdersService
// ─────────────────────────────────────────────────────────────────
const mockOrdersService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  remove: jest.fn(),
};

const mockJwtAuthGuard = { canActivate: jest.fn(() => true) };

const mockUser: JwtPayload = { sub: 'alice', exp: 0, type: 'access' };

describe('OrdersController', () => {
  let controller: OrdersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [{ provide: OrdersService, useValue: mockOrdersService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

    controller = module.get<OrdersController>(OrdersController);
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────
  // create()
  // ─────────────────────────────────────────────────────────────────
  describe('create()', () => {
    it("doit appeler ordersService.create avec le sub de l'utilisateur et le DTO", async () => {
      // Arrange
      const dto = { item: 'Laptop' };
      const expected = {
        id: 1,
        user: 'alice',
        item: 'Laptop',
        createdAt: new Date(),
      };
      mockOrdersService.create.mockResolvedValue(expected);

      // Act
      const result = await controller.create(mockUser, dto);

      // Assert
      expect(result).toEqual(expected);
      expect(mockOrdersService.create).toHaveBeenCalledWith('alice', dto);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // findAll()
  // ─────────────────────────────────────────────────────────────────
  describe('findAll()', () => {
    it("doit appeler ordersService.findAll avec le sub de l'utilisateur", async () => {
      // Arrange
      const expected = [
        { id: 1, user: 'alice', item: 'Laptop', createdAt: new Date() },
      ];
      mockOrdersService.findAll.mockResolvedValue(expected);

      // Act
      const result = await controller.findAll(mockUser);

      // Assert
      expect(result).toEqual(expected);
      expect(mockOrdersService.findAll).toHaveBeenCalledWith('alice');
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // findOne()
  // ─────────────────────────────────────────────────────────────────
  describe('findOne()', () => {
    it("doit appeler ordersService.findOne avec l'id et le sub", async () => {
      // Arrange
      const order = {
        id: 1,
        user: 'alice',
        item: 'Laptop',
        createdAt: new Date(),
      };
      mockOrdersService.findOne.mockResolvedValue(order);

      // Act
      const result = await controller.findOne(1, mockUser);

      // Assert
      expect(result).toEqual(order);
      expect(mockOrdersService.findOne).toHaveBeenCalledWith(1, 'alice');
    });

    it("doit retourner null si la commande n'existe pas", async () => {
      // Arrange
      mockOrdersService.findOne.mockResolvedValue(null);

      // Act
      const result = await controller.findOne(999, mockUser);

      // Assert
      expect(result).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // remove()
  // ─────────────────────────────────────────────────────────────────
  describe('remove()', () => {
    it("doit appeler ordersService.remove avec l'id et le sub", async () => {
      // Arrange
      mockOrdersService.remove.mockResolvedValue({ count: 1 });

      // Act
      const result = await controller.remove(1, mockUser);

      // Assert
      expect(result).toEqual({ count: 1 });
      expect(mockOrdersService.remove).toHaveBeenCalledWith(1, 'alice');
    });
  });
});
