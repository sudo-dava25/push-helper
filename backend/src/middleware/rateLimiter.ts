import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";

const rateLimitResponse = (_req: Request, res: Response): void => {
  res.status(429).json({
    error: "Too Many Requests",
    message: "Too many requests. Please try again in a few minutes.",
    retryAfter: res.getHeader("Retry-After"),
  });
};

export const validateRateLimiter = rateLimit({
  windowMs: 60 * 1_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitResponse,
});

export const pushRateLimiter = rateLimit({
  windowMs: 60 * 1_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitResponse,
});
