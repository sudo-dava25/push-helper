import { useState } from "react";
import { useGithubPush } from "./hooks/useGithubPush.js";
import { FolderDropZone } from "./components/FolderDropZone.js";
import type { FileUploadItem, FolderScanResult } from "./types/index.js";

export default function App() {
  const {
    pat, setPAT, validatedUser, validateToken,
    pushFiles, status, result, error, reset,
  } = useGithubPush();

  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<FileUploadItem[]>([]);

  const handleFilesScanned = (scanResult: FolderScanResult) => {
    setFiles(scanResult.files);
  };

  const handlePush = async () => {
    await pushFiles(owner, repo, branch, message, files);
  };

  const isLoading = status === "validating" || status === "pushing";

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: 8,
    marginBottom: 8,
    boxSizing: "border-box",
    border: "1px solid #d1d5da",
    borderRadius: 6,
    fontSize: 14,
  };

  return (
    <main style={{ maxWidth: 640, margin: "40px auto", fontFamily: "sans-serif", padding: "0 16px" }}>
      <h1>🚀 GitHub Push Tool</h1>

      <section>
        <h2>1. Personal Access Token</h2>
        <input
          type="password"
          placeholder="ghp_xxxxxxxxxxxx"
          value={pat}
          onChange={(e) => setPAT(e.target.value)}
          style={inputStyle}
          autoComplete="off"
        />
        <button onClick={validateToken} disabled={isLoading || !pat}>
          {status === "validating" ? "Validating..." : "Validate Token"}
        </button>
        {validatedUser && (
          <p style={{ color: "green", margin: "8px 0" }}>
            ✅ Signed in as: <strong>{validatedUser.login}</strong>
          </p>
        )}
      </section>

      {validatedUser && (
        <>
          <section style={{ marginTop: 24 }}>
            <h2>2. Target Repository</h2>
            <input
              placeholder="Owner / Username"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              style={inputStyle}
            />
            <input
              placeholder="Repository Name"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              style={inputStyle}
            />
            <input
              placeholder="Branch (default: main)"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              style={inputStyle}
            />
            <input
              placeholder="Commit message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              style={inputStyle}
            />
          </section>

          <section style={{ marginTop: 24 }}>
            <h2>3. Select Folder</h2>
            <FolderDropZone onFilesScanned={handleFilesScanned} disabled={isLoading} />
          </section>

          <button
            onClick={handlePush}
            disabled={isLoading || files.length === 0 || !owner || !repo || !message}
            style={{
              marginTop: 24,
              padding: "12px 24px",
              backgroundColor: isLoading ? "#ccc" : "#2ea44f",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: isLoading ? "not-allowed" : "pointer",
              fontSize: 16,
              width: "100%",
            }}
          >
            {status === "pushing"
              ? `Pushing ${files.length} files...`
              : `🚀 Push ${files.length} Files to GitHub`}
          </button>
        </>
      )}

      {error && (
        <div style={{ marginTop: 16, padding: 12, backgroundColor: "#fee", borderRadius: 6 }}>
          ❌ {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 16, padding: 12, backgroundColor: "#efe", borderRadius: 6 }}>
          <h3>{result.success ? "✅ Push Successful!" : "⚠️ Partial Push"}</h3>
          <p>
            {result.pushedFiles.length} file(s) pushed · {result.errors.length} failed
          </p>
          {result.errors.map((e) => (
            <div key={e.path} style={{ color: "red", fontSize: 13 }}>
              ❌ {e.path}: {e.message}
            </div>
          ))}
          <button onClick={reset} style={{ marginTop: 8 }}>
            Push another folder
          </button>
        </div>
      )}
    </main>
  );
}
