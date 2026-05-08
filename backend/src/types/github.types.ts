export interface PushFileRequest {
  owner: string;
  repo: string;
  branch: string;
  message: string;
  files: FileEntry[];
}

export interface FileEntry {
  path: string;
  contentBase64: string;
}

export interface GitHubFileResponse {
  sha: string;
  content: {
    name: string;
    path: string;
    sha: string;
    html_url: string;
  };
  commit: {
    sha: string;
    html_url: string;
  };
}

export interface PushResult {
  success: boolean;
  pushedFiles: PushedFileInfo[];
  commitUrl?: string;
  errors: PushError[];
}

export interface PushedFileInfo {
  path: string;
  sha: string;
  url: string;
}

export interface PushError {
  path: string;
  message: string;
  statusCode?: number;
}

export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  name: string | null;
}
