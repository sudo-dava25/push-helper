import { useState, useRef, useCallback } from "react";
import { handleDropEvent, processWebkitFileList } from "../utils/folderScanner.js";
import type { FolderScanResult, FileUploadItem } from "../types/index.js";

interface FolderDropZoneProps {
  onFilesScanned: (result: FolderScanResult) => void;
  disabled?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function FileTree({ files }: { files: FileUploadItem[] }) {
  const grouped = files.reduce<Record<string, FileUploadItem[]>>((acc, item) => {
    const parts = item.targetPath.split("/");
    const key = parts.length > 1 ? parts[0] : "__root__";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <div style={{ fontFamily: "monospace", fontSize: 12, maxHeight: 300, overflowY: "auto" }}>
      {Object.entries(grouped).map(([dir, items]) => (
        <div key={dir}>
          {dir !== "__root__" && (
            <div style={{ color: "#666", marginTop: 4 }}>
              📁 {dir}/ ({items.length} files)
            </div>
          )}
          {items.slice(0, 5).map((item) => (
            <div
              key={item.targetPath}
              style={{ paddingLeft: dir !== "__root__" ? 16 : 0, color: "#333" }}
            >
              📄 {item.targetPath.split("/").pop()} — {formatBytes(item.size)}
            </div>
          ))}
          {items.length > 5 && (
            <div style={{ paddingLeft: 16, color: "#999" }}>
              ... and {items.length - 5} more files
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function FolderDropZone({ onFilesScanned, disabled = false }: FolderDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [scanResult, setScanResult] = useState<FolderScanResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleScanResult = useCallback(
    (result: FolderScanResult) => {
      setScanResult(result);
      onFilesScanned(result);
    },
    [onFilesScanned]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = async (e: React.DragEvent) => {
    setIsDragOver(false);
    if (disabled) return;
    const result = await handleDropEvent(e.nativeEvent);
    handleScanResult(result);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const result = processWebkitFileList(e.target.files, true);
    handleScanResult(result);
    e.target.value = "";
  };

  const dropZoneStyle: React.CSSProperties = {
    border: `2px dashed ${isDragOver ? "#2ea44f" : "#ccc"}`,
    borderRadius: 8,
    padding: 32,
    textAlign: "center",
    backgroundColor: isDragOver ? "#f0fff4" : "#fafafa",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "all 0.2s ease",
    opacity: disabled ? 0.5 : 1,
  };

  return (
    <div>
      <div
        style={dropZoneStyle}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        role="button"
        aria-label="Drop folder or click to select"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && !disabled && inputRef.current?.click()}
      >
        <div style={{ fontSize: 40 }}>📂</div>
        <p style={{ margin: "8px 0", fontWeight: "bold" }}>Drag & drop folder here</p>
        <p style={{ color: "#666", fontSize: 14, margin: 0 }}>or click to select a folder</p>
        <p style={{ color: "#999", fontSize: 12, marginTop: 8 }}>
          node_modules, .git, and .env files are automatically excluded
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        // @ts-expect-error -- webkitdirectory is not a standard HTML attribute
        webkitdirectory=""
        multiple
        style={{ display: "none" }}
        onChange={handleInputChange}
        aria-hidden="true"
      />

      {scanResult && (
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              padding: 12,
              backgroundColor: "#f6f8fa",
              borderRadius: 6,
              border: "1px solid #e1e4e8",
            }}
          >
            <strong>✅ {scanResult.files.length} files ready to push</strong>
            {" · "}
            <span style={{ color: "#666" }}>Total: {formatBytes(scanResult.totalSize)}</span>
            {scanResult.skippedCount > 0 && (
              <span style={{ color: "#e36209", marginLeft: 8 }}>
                · {scanResult.skippedCount} files skipped
              </span>
            )}
          </div>

          {scanResult.warnings.length > 0 && (
            <div
              style={{
                marginTop: 8,
                padding: 10,
                backgroundColor: "#fffbdd",
                borderRadius: 6,
                border: "1px solid #f0b429",
                fontSize: 13,
              }}
            >
              {scanResult.warnings.map((w, i) => (
                <div key={i}>{w}</div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 8 }}>
            <FileTree files={scanResult.files} />
          </div>
        </div>
      )}
    </div>
  );
}
