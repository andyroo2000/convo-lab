/* eslint-disable no-console */
// Console logging is necessary for request monitoring
import { Request, Response, NextFunction } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);

    // Warn about slow requests (5s for signup, 2s for others)
    const slowThreshold = req.path.includes('/auth/signup') ? 5000 : 2000;
    if (duration > slowThreshold) {
      console.warn(`[SLOW] ${req.method} ${req.path} took ${duration}ms`);
    }
  });

  next();
}
