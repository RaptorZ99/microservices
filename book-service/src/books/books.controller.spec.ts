import { Test, TestingModule } from '@nestjs/testing';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';

describe('BooksController', () => {
  let controller: BooksController;
  const service = {
    search: jest.fn(),
    listLibrary: jest.fn(),
    addBook: jest.fn(),
    remove: jest.fn(),
    details: jest.fn(),
  } as unknown as BooksService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BooksController],
      providers: [{ provide: BooksService, useValue: service }],
    }).compile();

    controller = module.get<BooksController>(BooksController);
  });

  const user = { sub: 'user-1' };

  it('search defaults to title scope', async () => {
    service.search.mockResolvedValue([{ workId: 'W1' }]);
    const res = await controller.search('dune', undefined as any);

    expect(service.search).toHaveBeenCalledWith('dune', 'title');
    expect(res).toEqual([{ workId: 'W1' }]);
  });

  it('search uses author scope when provided', async () => {
    service.search.mockResolvedValue([{ workId: 'W2' }]);
    await controller.search('herbert', 'author');
    expect(service.search).toHaveBeenCalledWith('herbert', 'author');
  });

  it('library returns user library', async () => {
    const lib = [{ workId: 'W1' }];
    service.listLibrary.mockResolvedValue(lib);

    const res = await controller.library(user);

    expect(service.listLibrary).toHaveBeenCalledWith('user-1');
    expect(res).toEqual(lib);
  });

  it('add stores a book for user', async () => {
    service.addBook.mockResolvedValue({ entryId: 1 });
    const res = await controller.add(user, { workId: 'W1' });

    expect(service.addBook).toHaveBeenCalledWith('user-1', { workId: 'W1' });
    expect(res).toEqual({ entryId: 1 });
  });

  it('remove deletes a book for user', async () => {
    service.remove.mockResolvedValue({ deleted: true });

    const res = await controller.remove(user, 'W1');

    expect(service.remove).toHaveBeenCalledWith('user-1', 'W1');
    expect(res).toEqual({ deleted: true });
  });

  it('details fetches book details', async () => {
    service.details.mockResolvedValue({ workId: 'W1' });
    const res = await controller.details('W1');

    expect(service.details).toHaveBeenCalledWith('W1');
    expect(res).toEqual({ workId: 'W1' });
  });
});
