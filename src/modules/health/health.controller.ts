import type { HttpContext } from '../../core/http/context';
import { ok } from '../../core/http/response';
import { HealthService } from './health.service';

export class HealthController {
  constructor(private readonly service: HealthService = new HealthService()) {}

  async health(ctx: HttpContext): Promise<void> {
    const summary = await this.service.getHealth();
    ok(ctx, summary);
  }
}