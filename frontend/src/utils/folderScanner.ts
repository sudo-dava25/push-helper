import type { FileUploadItem, FolderScanResult } from "../types/index.js";

const BLACKLIST_DIRS = new Set([
  "node_modules", ".git", ".svn", ".hg",
  "dist", "build", ".next", ".nuxt",
  "__pycache__", ".pytest_cache",
  "venv", ".venv", "vendor", "target", ".gradle",
]);

const BLACKLIST_FILES = new Set([".DS_Store", "Thumbs.db", "desktop.ini"]);

const SECRET_FILE_PATTERNS = [
  /^\.env(\..+)?$/,
  /^\.npmrc$/,
  /^\.netrc$/,
  /\.pem$/,
  /\.key$/,
  /\.p12$/,
  /\.pfx$/,
  /id_rsa/,
  /id_ed25519/,
];

const MAX_FILES = 500;
const MAX_TOTAL_SIZE_BYTES = 100 * 1024 * 1024;
const MAX_SINGLE_FILE_BYTES = 50 * 1024 * 1024;

function isSecretFile(fileName: string): boolean {
  return SECRET_FILE_PATTERNS.some((pattern) => pattern.test(fileName));
}

function isBlacklistedDir(name: string): boolean {
  return BLACKLIST_DIRS.has(name);
}

function normalizePath(rawPath: string): string {
  return rawPath
    .replace(/\\/g, "/")
    .replace(/^\.?\/+/, "")
    .replace(/\/+/g, "/");
}

function hasBlacklistedSegment(filePath: string): string | null {
  const segments = filePath.split("/");
  for (const segment of segments) {
    if (isBlacklistedDir(segment)) return segment;
  }
  return null;
}

export function processWebkitFileList(
  fileList: FileList,
  stripRootFolder = true
): FolderScanResult {
  const files: FileUploadItem[] = [];
  const warnings: string[] = [];
  let skippedCount = 0;
  let totalSize = 0;

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    const rawPath = file.webkitRelativePath || file.name;
    const segments = rawPath.split("/");

    const pathSegments =
      stripRootFolder && segments.length > 1 ? segments.slice(1) : segments;

    const targetPath = normalizePath(pathSegments.join("/"));
    const fileName = segments[segments.length - 1];

    if (hasBlacklistedSegment(targetPath)) {
      skippedCount++;
      continue;
    }

    if (BLACKLIST_FILES.has(fileName)) {
      skippedCount++;
      continue;
    }

    if (isSecretFile(fileName)) {
      skippedCount++;
      warnings.push(`⚠️ "${fileName}" was skipped — detected as a sensitive file.`);
      continue;
    }

    if (file.size > MAX_SINGLE_FILE_BYTES) {
      skippedCount++;
      warnings.push(
        `⚠️ "${targetPath}" was skipped (${(file.size / 1024 / 1024).toFixed(1)}MB > 50MB limit).`
      );
      continue;
    }

    if (files.length >= MAX_FILES) {
      warnings.push(`⚠️ Only the first ${MAX_FILES} files were processed.`);
      break;
    }

    if (totalSize + file.size > MAX_TOTAL_SIZE_BYTES) {
      warnings.push(`⚠️ Total size exceeded 100MB. Remaining files were skipped.`);
      break;
    }

    totalSize += file.size;
    files.push({ file, targetPath, size: file.size });
  }

  return { files, skippedCount, totalSize, warnings };
}

export async function readDirectoryHandle(
  dirHandle: FileSystemDirectoryHandle,
  currentPath = "",
  result: FolderScanResult = { files: [], skippedCount: 0, totalSize: 0, warnings: [] }
): Promise<FolderScanResult> {
  for await (const [name, handle] of dirHandle) {
    if (handle.kind === "directory" && isBlacklistedDir(name)) {
      result.skippedCount++;
      continue;
    }

    const entryPath = currentPath ? `${currentPath}/${name}` : name;

    if (handle.kind === "directory") {
      await readDirectoryHandle(handle as FileSystemDirectoryHandle, entryPath, result);
    } else {
      const fileHandle = handle as FileSystemFileHandle;
      const file = await fileHandle.getFile();

      if (BLACKLIST_FILES.has(name) || isSecretFile(name)) {
        result.skippedCount++;
        if (isSecretFile(name)) {
          result.warnings.push(`⚠️ "${entryPath}" was skipped — detected as a sensitive file.`);
        }
        continue;
      }

      if (file.size > MAX_SINGLE_FILE_BYTES) {
        result.skippedCount++;
        result.warnings.push(
          `⚠️ "${entryPath}" was skipped (${(file.size / 1024 / 1024).toFixed(1)}MB > 50MB).`
        );
        continue;
      }

      if (result.files.length >= MAX_FILES) {
        result.warnings.push(`⚠️ File limit of ${MAX_FILES} reached.`);
        return result;
      }

      if (result.totalSize + file.size > MAX_TOTAL_SIZE_BYTES) {
        result.warnings.push(`⚠️ 100MB total limit reached. Push will be partial.`);
        return result;
      }

      result.totalSize += file.size;
      result.files.push({ file, targetPath: normalizePath(entryPath), size: file.size });
    }
  }

  return result;
}

export async function handleDropEvent(event: DragEvent): Promise<FolderScanResult> {
  event.preventDefault();

  const items = event.dataTransfer?.items;
  if (!items || items.length === 0) {
    return { files: [], skippedCount: 0, totalSize: 0, warnings: [] };
  }

  const firstItem = items[0];

  if (typeof firstItem.getAsFileSystemHandle === "function") {
    const result: FolderScanResult = { files: [], skippedCount: 0, totalSize: 0, warnings: [] };

    for (let i = 0; i < items.length; i++) {
      const handle = await items[i].getAsFileSystemHandle();
      if (!handle) continue;

      if (handle.kind === "directory") {
        await readDirectoryHandle(handle as FileSystemDirectoryHandle, "", result);
      } else {
        const file = await (handle as FileSystemFileHandle).getFile();
        if (!isSecretFile(file.name) && file.size <= MAX_SINGLE_FILE_BYTES) {
          result.files.push({ file, targetPath: file.name, size: file.size });
          result.totalSize += file.size;
        }
      }
    }

    return result;
  }

  return processWebkitEntries(items);
}

async function processWebkitEntries(items: DataTransferItemList): Promise<FolderScanResult> {
  const result: FolderScanResult = { files: [], skippedCount: 0, totalSize: 0, warnings: [] };

  const traverseEntry = async (entry: FileSystemEntry, path = ""): Promise<void> => {
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry;
      await new Promise<void>((resolve) => {
        fileEntry.file((file) => {
          const targetPath = normalizePath(path ? `${path}/${file.name}` : file.name);
          if (!isSecretFile(file.name) && !BLACKLIST_FILES.has(file.name)) {
            if (file.size <= MAX_SINGLE_FILE_BYTES && result.files.length < MAX_FILES) {
              result.files.push({ file, targetPath, size: file.size });
              result.totalSize += file.size;
            }
          } else {
            result.skippedCount++;
          }
          resolve();
        });
      });
    } else if (entry.isDirectory) {
      const dirEntry = entry as FileSystemDirectoryEntry;
      if (isBlacklistedDir(entry.name)) {
        result.skippedCount++;
        return;
      }

      const reader = dirEntry.createReader();
      const entries = await new Promise<FileSystemEntry[]>((resolve) => {
        reader.readEntries(resolve);
      });

      for (const childEntry of entries) {
        await traverseEntry(
          childEntry,
          path ? `${path}/${entry.name}` : entry.name
        );
      }
    }
  };

  for (let i = 0; i < items.length; i++) {
    const entry = items[i].webkitGetAsEntry?.();
    if (entry) await traverseEntry(entry);
  }

  return result;
}
