import { Octokit } from "@octokit/rest";
import { RequestError } from "@octokit/request-error";
import {
  PushFileRequest,
  PushResult,
  PushedFileInfo,
  PushError,
  GitHubUser,
} from "../types/github.types.js";

const GITHUB_API_TIMEOUT_MS = 15_000;
const MAX_FILES_PER_PUSH = 50;

function createOctokitClient(pat: string): Octokit {
  return new Octokit({
    auth: pat,
    request: { timeout: GITHUB_API_TIMEOUT_MS },
    retry: { enabled: false },
    throttle: { enabled: false },
  });
}

export async function validatePAT(pat: string): Promise<GitHubUser> {
  const octokit = createOctokitClient(pat);

  try {
    const { data } = await octokit.rest.users.getAuthenticated();
    return {
      login: data.login,
      id: data.id,
      avatar_url: data.avatar_url,
      name: data.name,
    };
  } catch (error) {
    if (error instanceof RequestError) {
      if (error.status === 401) throw new Error("PAT is invalid or expired.");
      if (error.status === 403) throw new Error("PAT does not have sufficient permissions.");
    }
    throw new Error(`Failed to validate PAT: ${(error as Error).message}`);
  }
}

async function getExistingFileSHA(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string,
  branch: string
): Promise<string | null> {
  try {
    const { data } = await octokit.rest.repos.getContent({ owner, repo, path, ref: branch });

    if (Array.isArray(data)) {
      throw new Error(`Path "${path}" is a directory, not a file.`);
    }

    return data.type === "file" ? data.sha : null;
  } catch (error) {
    if (error instanceof RequestError && error.status === 404) return null;
    throw error;
  }
}

async function pushSingleFile(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string,
  filePath: string,
  contentBase64: string,
  commitMessage: string
): Promise<PushedFileInfo> {
  const sanitizedPath = filePath
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\.\.\/|\/\.\./g, "");

  if (sanitizedPath !== filePath.replace(/\\/g, "/").replace(/^\/+/, "")) {
    throw new Error(`Invalid path: "${filePath}" contains dangerous characters.`);
  }

  const existingSHA = await getExistingFileSHA(octokit, owner, repo, sanitizedPath, branch);

  const { data } = await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: sanitizedPath,
    message: commitMessage,
    content: contentBase64,
    branch,
    ...(existingSHA ? { sha: existingSHA } : {}),
  });

  return {
    path: sanitizedPath,
    sha: data.content?.sha ?? "",
    url: data.content?.html_url ?? "",
  };
}

export async function pushFilesToGitHub(
  pat: string,
  request: PushFileRequest
): Promise<PushResult> {
  const octokit = createOctokitClient(pat);
  const pushedFiles: PushedFileInfo[] = [];
  const errors: PushError[] = [];
  let lastCommitUrl: string | undefined;

  if (request.files.length === 0) {
    throw new Error("At least one file must be included.");
  }

  if (request.files.length > MAX_FILES_PER_PUSH) {
    throw new Error(
      `Maximum ${MAX_FILES_PER_PUSH} files per push. You sent ${request.files.length} files.`
    );
  }

  for (const file of request.files) {
    try {
      const result = await pushSingleFile(
        octokit,
        request.owner,
        request.repo,
        request.branch,
        file.path,
        file.contentBase64,
        request.message
      );
      pushedFiles.push(result);
      lastCommitUrl = result.url;
    } catch (error) {
      const errorMessage =
        error instanceof RequestError
          ? `GitHub API error ${error.status}: ${error.message}`
          : (error as Error).message;

      errors.push({
        path: file.path,
        message: errorMessage,
        statusCode: error instanceof RequestError ? error.status : undefined,
      });
    }
  }

  return {
    success: errors.length === 0,
    pushedFiles,
    commitUrl: lastCommitUrl,
    errors,
  };
}
