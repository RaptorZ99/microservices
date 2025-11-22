describe('main bootstrap', () => {
  let createMock: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    createMock = jest.fn();
    jest.doMock('@nestjs/core', () => ({
      NestFactory: { create: createMock },
    }));
    delete process.env.PORT;
  });

  it('configures global pipes, CORS and listens on explicit PORT', async () => {
    const useGlobalPipes = jest.fn();
    const enableCors = jest.fn();
    const listen = jest.fn().mockResolvedValue(undefined);

    createMock.mockResolvedValue({
      useGlobalPipes,
      enableCors,
      listen,
    });

    process.env.PORT = '5000';
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    jest.isolateModules(() => {
      import('./main.js');
    });
    await new Promise(setImmediate);

    expect(createMock).toHaveBeenCalledWith(expect.any(Function));
    expect(useGlobalPipes).toHaveBeenCalledTimes(1);
    expect(enableCors).toHaveBeenCalledWith({
      origin: true,
      credentials: true,
    });
    expect(listen).toHaveBeenCalledWith('5000');
    expect(logSpy).toHaveBeenCalled();

    logSpy.mockRestore();
  });

  it('falls back to default port when PORT env is absent', async () => {
    const useGlobalPipes = jest.fn();
    const enableCors = jest.fn();
    const listen = jest.fn().mockResolvedValue(undefined);

    createMock.mockResolvedValue({
      useGlobalPipes,
      enableCors,
      listen,
    });

    delete process.env.PORT;
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    jest.isolateModules(() => {
      import('./main.js');
    });
    await new Promise(setImmediate);

    expect(Number(listen.mock.calls[0][0])).toBe(4000);

    logSpy.mockRestore();
  });
});
