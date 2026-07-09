import type { HttpContext } from '../http/context';

export type Next = () => Promise<void>;

export type Middleware = (ctx: HttpContext, next: Next) => Promise<void>;

export type Handler = (ctx: HttpContext) => Promise<void> | void;

/**
 * Compose a chain of middlewares into a single handler that runs them in onion
 * order. Each middleware must call `next()` to continue the chain.
 */
export function compose(middlewares: Middleware[], terminal: Handler): Handler {
  return async (ctx: HttpContext) => {
    let index = -1;
    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) {
        throw new Error('next() called multiple times');
      }
      index = i;
      const mw = middlewares[i];
      if (!mw) {
        await terminal(ctx);
        return;
      }
      await mw(ctx, () => dispatch(i + 1));
    };
    await dispatch(0);
  };
}