import { Router } from 'express';

// Express 4 does not forward rejected promises from async route handlers to the
// error middleware. This router wraps async handlers so every route is covered
// without rewriting each handler. Error-handling middleware (4 arguments) is
// left untouched.
const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'all', 'use'];

export function createRouter(options) {
  const router = Router(options);

  for (const method of METHODS) {
    const original = router[method].bind(router);
    router[method] = (...args) =>
      original(
        ...args.map((arg) => {
          if (typeof arg !== 'function' || arg.length >= 4) return arg;
          return (req, res, next) => {
            try {
              const result = arg(req, res, next);
              if (result && typeof result.then === 'function') {
                result.catch(next);
              }
            } catch (err) {
              next(err);
            }
          };
        })
      );
  }

  return router;
}
