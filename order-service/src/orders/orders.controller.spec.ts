import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

describe('OrdersController', () => {
  let controller: OrdersController;
  const service = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  } as unknown as OrdersService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [{ provide: OrdersService, useValue: service }],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
  });

  const user = { sub: 'user-1' };

  it('POST /orders should delegate to service with user sub', async () => {
    service.create.mockResolvedValue({ id: 1, item: 'book' });

    const result = await controller.create(user, { item: 'book' });

    expect(service.create).toHaveBeenCalledWith('user-1', { item: 'book' });
    expect(result).toEqual({ id: 1, item: 'book' });
  });

  it('GET /orders should return all user orders', async () => {
    const list = [{ id: 1, item: 'pen' }];
    service.findAll.mockResolvedValue(list);

    const result = await controller.findAll(user);

    expect(service.findAll).toHaveBeenCalledWith('user-1');
    expect(result).toEqual(list);
  });

  it('GET /orders/:id should fetch specific order for user', async () => {
    const order = { id: 7, item: 'notebook' };
    service.findOne.mockResolvedValue(order);

    const result = await controller.findOne(7, user);

    expect(service.findOne).toHaveBeenCalledWith(7, 'user-1');
    expect(result).toEqual(order);
  });

  it('DELETE /orders/:id should delete order for user', async () => {
    service.remove.mockResolvedValue({ count: 1 } as any);

    const result = await controller.remove(3, user);

    expect(service.remove).toHaveBeenCalledWith(3, 'user-1');
    expect(result).toEqual({ count: 1 });
  });
});
