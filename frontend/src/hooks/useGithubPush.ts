import { useState, useCallback } from "react";
import { githubApi } from "../services/api.service.js";
import type { GitHubUser, PushResult, FileUploadItem } from "../types/index.js";

type PushStatus = "idle" | "validating" | "pushing" | "success" | "error";

interface UseGithubPushState {
  pat: string;
  validatedUser: GitHubUser | null;
  status: PushStatus;
  result: PushResult | null;
  error: string | null;
}

interface UseGithubPushActions {
  setPAT: (token: string) => void;
  validateToken: () => Promise<void>;
  pushFiles: (
    owner: string,
    repo: string,
    branch: string,
    message: string,
    files: FileUploadItem[]
  ) => Promise<void>;
  reset: () => void;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      if (!base64) {
        reject(new Error(`Failed to convert ${file.name} to base64`));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error(`Failed to read file ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export function useGithubPush(): UseGithubPushState & UseGithubPushActions {
  const [pat, setPATInternal] = useState<string>("");
  const [validatedUser, setValidatedUser] = useState<GitHubUser | null>(null);
  const [status, setStatus] = useState<PushStatus>("idle");
  const [result, setResult] = useState<PushResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setPAT = useCallback((token: string) => {
    setValidatedUser(null);
    setError(null);
    setPATInternal(token);
  }, []);

  const validateToken = useCallback(async (): Promise<void> => {
    if (!pat.trim()) {
      setError("Token cannot be empty.");
      return;
    }

    setStatus("validating");
    setError(null);

    try {
      const user = await githubApi.validateToken(pat);
      setValidatedUser(user);
      setStatus("idle");
    } catch (err) {
      setError((err as Error).message);
      setStatus("error");
      setValidatedUser(null);
    }
  }, [pat]);

  const pushFiles = useCallback(
    async (
      owner: string,
      repo: string,
      branch: string,
      message: string,
      files: FileUploadItem[]
    ): Promise<void> => {
      if (!validatedUser) {
        setError("Please validate your token first.");
        return;
      }

      setStatus("pushing");
      setError(null);
      setResult(null);

      try {
        const fileEntries = await Promise.all(
          files.map(async (item) => ({
            path: item.targetPath,
            contentBase64: await fileToBase64(item.file),
          }))
        );

        const pushResult = await githubApi.pushFiles(pat, {
          owner,
          repo,
          branch,
          message,
          files: fileEntries,
        });

        setResult(pushResult);
        setStatus(pushResult.success ? "success" : "error");

        if (!pushResult.success && pushResult.errors.length > 0) {
          setError(`${pushResult.errors.length} file(s) failed to push. See details below.`);
        }
      } catch (err) {
        setError((err as Error).message);
        setStatus("error");
      }
    },
    [pat, validatedUser]
  );

  const reset = useCallback((): void => {
    setStatus("idle");
    setResult(null);
    setError(null);
  }, []);

  return { pat, validatedUser, status, result, error, setPAT, validateToken, pushFiles, reset };
}
