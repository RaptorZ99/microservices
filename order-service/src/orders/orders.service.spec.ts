import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';

describe('OrdersService', () => {
  let service: OrdersService;
  const prisma = {
    order: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
    },
  } as unknown as PrismaService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrdersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  it('create() should persist an order for the given user', async () => {
    const order = { id: 1, user: 'u1', item: 'book', createdAt: new Date() };
    prisma.order.create.mockResolvedValue(order);

    const result = await service.create('u1', { item: 'book' });

    expect(prisma.order.create).toHaveBeenCalledWith({
      data: { user: 'u1', item: 'book' },
    });
    expect(result).toEqual(order);
  });

  it('findAll() should return user orders sorted by date desc', async () => {
    const orders = [
      { id: 2, user: 'u1', item: 'pen', createdAt: new Date('2023-01-02') },
      { id: 1, user: 'u1', item: 'book', createdAt: new Date('2023-01-01') },
    ];
    prisma.order.findMany.mockResolvedValue(orders);

    const result = await service.findAll('u1');

    expect(prisma.order.findMany).toHaveBeenCalledWith({
      where: { user: 'u1' },
      orderBy: { createdAt: 'desc' },
    });
    expect(result).toEqual(orders);
  });

  it('findOne() should fetch a single order for the user', async () => {
    const order = { id: 3, user: 'u1', item: 'notebook', createdAt: new Date() };
    prisma.order.findFirst.mockResolvedValue(order);

    const result = await service.findOne(3, 'u1');

    expect(prisma.order.findFirst).toHaveBeenCalledWith({
      where: { id: 3, user: 'u1' },
    });
    expect(result).toEqual(order);
  });

  it('remove() should delete order scoped to user', async () => {
    prisma.order.deleteMany.mockResolvedValue({ count: 1 } as any);

    const result = await service.remove(5, 'u1');

    expect(prisma.order.deleteMany).toHaveBeenCalledWith({
      where: { id: 5, user: 'u1' },
    });
    expect(result).toEqual({ count: 1 });
  });
});
