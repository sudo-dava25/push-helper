import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { validatePAT, pushFilesToGitHub } from "../services/github.service.js";
import { validateRateLimiter, pushRateLimiter } from "../middleware/rateLimiter.js";

export const githubRouter = Router();

const FileEntrySchema = z.object({
  path: z
    .string()
    .min(1)
    .max(500)
    .regex(/^[^<>:"|?*\x00-\x1f]+$/, "Path contains invalid characters"),
  contentBase64: z
    .string()
    .min(1)
    .max(10 * 1024 * 1024)
    .regex(/^[A-Za-z0-9+/=]+$/, "Content must be valid base64"),
});

const PushRequestSchema = z.object({
  owner: z
    .string()
    .min(1)
    .max(39)
    .regex(/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/, "Invalid owner"),
  repo: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9._-]+$/, "Invalid repo name"),
  branch: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[^\x00-\x1f ~^:?*[\\]+$/, "Invalid branch name"),
  message: z.string().min(1).max(72),
  files: z.array(FileEntrySchema).min(1).max(50),
});

function extractPAT(req: Request): string | null {
  const token = req.headers["x-github-token"];
  if (typeof token !== "string" || token.trim() === "") return null;
  return token.trim();
}

githubRouter.post(
  "/validate",
  validateRateLimiter,
  async (req: Request, res: Response): Promise<void> => {
    const pat = extractPAT(req);

    if (!pat) {
      res.status(400).json({ error: "X-GitHub-Token header is required." });
      return;
    }

    try {
      const user = await validatePAT(pat);
      res.json({ valid: true, user });
    } catch (error) {
      res.status(401).json({ valid: false, error: (error as Error).message });
    }
  }
);

githubRouter.post(
  "/push",
  pushRateLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const pat = extractPAT(req);

    if (!pat) {
      res.status(400).json({ error: "X-GitHub-Token header is required." });
      return;
    }

    const parseResult = PushRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: "Invalid input.",
        details: parseResult.error.flatten().fieldErrors,
      });
      return;
    }

    try {
      const result = await pushFilesToGitHub(pat, parseResult.data);
      const statusCode = result.success ? 200 : 207;
      res.status(statusCode).json(result);
    } catch (error) {
      next(error);
    }
  }
);
