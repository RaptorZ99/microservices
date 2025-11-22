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

  it('configures validation, CORS and listens on provided PORT', async () => {
    const useGlobalPipes = jest.fn();
    const enableCors = jest.fn();
    const listen = jest.fn().mockResolvedValue(undefined);

    createMock.mockResolvedValue({ useGlobalPipes, enableCors, listen });
    process.env.PORT = '9100';
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
    expect(listen).toHaveBeenCalledWith(9100);
    expect(logSpy).toHaveBeenCalled();

    logSpy.mockRestore();
  });

  it('falls back to default port 9000 when PORT is missing', async () => {
    const useGlobalPipes = jest.fn();
    const enableCors = jest.fn();
    const listen = jest.fn().mockResolvedValue(undefined);

    createMock.mockResolvedValue({ useGlobalPipes, enableCors, listen });

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    jest.isolateModules(() => {
      import('./main.js');
    });
    await new Promise(setImmediate);

    expect(listen).toHaveBeenCalledWith(9000);

    logSpy.mockRestore();
  });
});
