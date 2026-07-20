/* eslint-disable no-console */
// Console logging is necessary for request monitoring
import { Request, Response, NextFunction } from 'express';

import { buildBackendRouteUsageEvent } from '../migration/backendRouteUsage.js';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const requestPath = req.originalUrl
    ? new URL(req.originalUrl, 'http://localhost').pathname
    : req.path;

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${requestPath} ${res.statusCode} - ${duration}ms`);

    const routeUsage = buildBackendRouteUsageEvent(
      req.method,
      requestPath,
      res.statusCode,
      duration
    );
    if (routeUsage) {
      console.log(JSON.stringify(routeUsage));
    }

    // Warn about slow requests (5s for signup, 2s for others)
    const slowThreshold = requestPath.includes('/auth/signup') ? 5000 : 2000;
    if (duration > slowThreshold) {
      console.warn(`[SLOW] ${req.method} ${requestPath} took ${duration}ms`);
    }
  });

  next();
}
