import type { Request, Response, NextFunction, RequestHandler } from 'express';

// Encaminha rejeições de handlers async para o middleware de erro do Express 4.
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
