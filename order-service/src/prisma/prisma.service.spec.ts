jest.mock('@prisma/adapter-better-sqlite3', () => ({
  PrismaBetterSqlite3: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@prisma/client', () => ({
  PrismaClient: class {
    $connect = jest.fn().mockResolvedValue(undefined);
    $disconnect = jest.fn().mockResolvedValue(undefined);
  },
}));

import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  it('connects on module init', async () => {
    const service = new PrismaService();
    await service.onModuleInit();
    expect(service.$connect).toHaveBeenCalled();
  });

  it('disconnects on module destroy', async () => {
    const service = new PrismaService();
    await service.onModuleDestroy();
    expect(service.$disconnect).toHaveBeenCalled();
  });
});
