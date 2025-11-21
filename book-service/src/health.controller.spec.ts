import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns ok status', () => {
    const controller = new HealthController();
    const res = controller.check();

    expect(res.status).toBe('ok');
    expect(res.service).toBe('book-service');
    expect(() => new Date(res.timestamp)).not.toThrow();
  });
});
