export interface FileUploadItem {
  file: File;
  targetPath: string;
  size: number;
  skipped?: boolean;
  skipReason?: string;
}

export interface FolderScanResult {
  files: FileUploadItem[];
  skippedCount: number;
  totalSize: number;
  warnings: string[];
}

export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  name: string | null;
}

export interface PushFileRequest {
  owner: string;
  repo: string;
  branch: string;
  message: string;
  files: Array<{ path: string; contentBase64: string }>;
}

export interface PushResult {
  success: boolean;
  pushedFiles: Array<{ path: string; sha: string; url: string }>;
  commitUrl?: string;
  errors: Array<{ path: string; message: string; statusCode?: number }>;
}
