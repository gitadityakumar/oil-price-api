import type { HttpContext, HttpMethod } from '../http/context';
import { compilePattern, matchPattern } from './path-pattern';
import { AppError } from '../errors/app-error';

export type RouteHandler = (ctx: HttpContext) => Promise<void> | void;
export type RouteOptions = { auth?: boolean; rateLimit?: boolean };

interface Route {
  method: HttpMethod;
  pattern: string;
  compiled: ReturnType<typeof compilePattern>;
  handler: RouteHandler;
  options: RouteOptions;
}

const ALL_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

export class Router {
  private routes: Route[] = [];

  register(method: HttpMethod, pattern: string, handler: RouteHandler, options: RouteOptions = {}): void {
    this.routes.push({ method, pattern, compiled: compilePattern(pattern), handler, options });
  }

  get(pattern: string, handler: RouteHandler, options?: RouteOptions): void {
    this.register('GET', pattern, handler, options ?? {});
  }
  post(pattern: string, handler: RouteHandler, options?: RouteOptions): void {
    this.register('POST', pattern, handler, options ?? {});
  }
  put(pattern: string, handler: RouteHandler, options?: RouteOptions): void {
    this.register('PUT', pattern, handler, options ?? {});
  }
  patch(pattern: string, handler: RouteHandler, options?: RouteOptions): void {
    this.register('PATCH', pattern, handler, options ?? {});
  }
  delete(pattern: string, handler: RouteHandler, options?: RouteOptions): void {
    this.register('DELETE', pattern, handler, options ?? {});
  }

  /**
   * Resolve and dispatch the request. Throws AppError(NOT_FOUND) or
   * AppError(METHOD_NOT_ALLOWED) when no route matches.
   */
  async handle(ctx: HttpContext): Promise<void> {
    const method = ctx.method.toUpperCase() as HttpMethod;
    let pathMatched = false;

    for (const route of this.routes) {
      const { matched, params } = matchPattern(route.compiled, ctx.path);
      if (!matched) continue;
      pathMatched = true;
      if (route.method !== method) continue;
      ctx.params = params;
      await route.handler(ctx);
      return;
    }

    if (pathMatched) {
      const allowed = uniqueMethods(this.routes, ctx.path);
      throw new AppError(
        'METHOD_NOT_ALLOWED',
        `Method ${method} not allowed for ${ctx.path}`,
        405,
        { allowed },
      );
    }
    throw new AppError('NOT_FOUND', `Route not found: ${method} ${ctx.path}`, 404);
  }
}

function uniqueMethods(routes: Route[], path: string): HttpMethod[] {
  const set = new Set<HttpMethod>();
  for (const r of routes) {
    if (matchPattern(r.compiled, path).matched) set.add(r.method);
  }
  return ALL_METHODS.filter((m) => set.has(m));
}