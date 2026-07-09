import type { HttpContext } from '../../core/http/context';
import { notImplemented } from '../../core/http/response';

/**
 * Generic controller used to register stub routes until each module's task is
 * implemented. Returns a 501 NOT_IMPLEMENTED envelope with the route label.
 */
export function stubController(label: string) {
  return async (ctx: HttpContext): Promise<void> => {
    notImplemented(ctx, label);
  };
}