# Push-Helper

A web tool to push local folders to GitHub repositories via the browser — no git CLI required.

## Features

- Drag & drop or select folder via picker
- Preserves original folder structure (e.g. `src/components/Button.tsx`)
- Supports all file types (text, images, fonts, binaries)
- Auto-excludes `node_modules`, `.git`, `.env`, and other sensitive files
- PAT stored in memory only — never persisted to disk or localStorage

## Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript
- **GitHub integration**: Octokit REST API

## Usage

1. Generate a GitHub PAT with `repo` scope at [github.com/settings/tokens](https://github.com/settings/tokens)
2. Paste the token and click **Validate Token**
3. Enter the target owner, repo, branch, and commit message
4. Drop or select your folder
5. Click **Push to GitHub**

## Security Notes

- PAT is sent via `X-GitHub-Token` header — never logged or stored server-side
- Rate limited: 10 req/min for validation, 20 req/min for push (per IP)
- Files matching `.env*`, `*.pem`, `*.key`, etc. are automatically excluded
- Max 500 files / 100MB total per push
