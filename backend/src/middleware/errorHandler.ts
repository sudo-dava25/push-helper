import type { Request, Response, NextFunction } from "express";

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export function globalErrorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode ?? 500;
  const isDev = process.env.NODE_ENV === "development";

  const safeMessage = err.isOperational
    ? err.message
    : "An internal error occurred. Please try again.";

  console.error({
    level: "error",
    message: err.message,
    statusCode,
    path: req.path,
    method: req.method,
    ...(isDev ? { stack: err.stack } : {}),
  });

  res.status(statusCode).json({
    error: safeMessage,
    ...(isDev ? { detail: err.message } : {}),
  });
}
