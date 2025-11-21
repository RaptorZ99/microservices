import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('should expose health payload with timestamp', () => {
    const controller = new HealthController();
    const response = controller.check();

    expect(response.status).toBe('ok');
    expect(response.service).toBe('order-service');
    expect(() => new Date(response.timestamp)).not.toThrow();
  });
});
