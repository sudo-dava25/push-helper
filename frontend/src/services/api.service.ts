import type { PushFileRequest, PushResult, GitHubUser } from "../types/index.js";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

async function apiFetch<T>(
  endpoint: string,
  pat: string,
  options: RequestInit = {}
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-GitHub-Token": pat,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error ?? `HTTP ${response.status}: ${response.statusText}`
      );
    }

    return response.json() as Promise<T>;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const githubApi = {
  async validateToken(pat: string): Promise<GitHubUser> {
    const result = await apiFetch<{ valid: boolean; user: GitHubUser; error?: string }>(
      "/api/github/validate",
      pat,
      { method: "POST" }
    );

    if (!result.valid) throw new Error(result.error ?? "Invalid token");
    return result.user;
  },

  async pushFiles(pat: string, request: PushFileRequest): Promise<PushResult> {
    return apiFetch<PushResult>("/api/github/push", pat, {
      method: "POST",
      body: JSON.stringify(request),
    });
  },
};
