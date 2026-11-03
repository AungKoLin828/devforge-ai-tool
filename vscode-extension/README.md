# Codevia AI Developer Tools for VS Code

Codevia AI adds a custom chat panel and coding commands to VS Code. Requests to create a new project from chat use the project-generation workflow and copy the generated files into your open workspace. If no workspace is open, VS Code asks you to choose a local destination folder. You review the file list and confirm before files are written; existing files are skipped unless you explicitly choose to overwrite them.

The extension connects to the hosted DevForge backend by default and does not add or require an AI-provider API key inside the extension. It can keep separate sign-ins for both the hosted server and your local development server; use **Codevia AI: Select Backend** to choose which one to use. The Local Agent is not required for the extension to save generated files to a folder on your PC.

The Marketplace extension ID is `CodeviaAI.codevia-ai`. Publishing requires access to a VS Code Marketplace publisher named `CodeviaAI`.

## Choose local or Netlify backend

The extension supports both environments without changing the DevForge web app or Netlify Functions. Use **Codevia AI: Select Backend** from the Command Palette, or open **VS Code Settings** (`Ctrl+,`) and search for **Codevia AI**:

- `Codevia AI Developer Tools: Backend Environment` = `local` or `netlify` (default).
- `Local Backend Url` defaults to `http://localhost:8888`.
- `Netlify Backend Url` defaults to `https://devforge-ai-tool.netlify.app`.

### Local development

1. Start the DevForge web app from its project root using `npm run dev:netlify`.
2. Netlify CLI normally serves the app and functions at `http://localhost:8888`. Use that full origin in `Local Backend Url` if your port differs.
3. Set `Backend Environment` to `local`.
4. Run **Codevia AI: Sign In to Local Backend** and complete GitHub sign-in in the browser. This stores a local session separately from the hosted session. To use it, run **Codevia AI: Select Backend** and choose **Local development server**.

Do not use the Vite-only `http://localhost:5173` URL unless your local setup also routes `/api/*` to the Netlify Functions. The extension needs the backend routes, not just the frontend dev server. HTTP is permitted only for loopback local development.

### Hosted Netlify deployment

1. Keep `Backend Environment` set to `netlify` (the default).
2. Keep `Netlify Backend Url` set to your deployed site URL.
3. Run **Codevia AI: Sign In to Hosted Backend** and complete GitHub sign-in in the browser. To use it, run **Codevia AI: Select Backend** and choose **Hosted server (Netlify)**.

You can sign in to both backends once and switch between them without signing in again. The extension stores their sessions, selected projects, and provider choices separately. **Codevia AI: Sign In (Choose Backend)** asks which server to connect to, regardless of which backend is currently selected. The direct local and hosted sign-in commands are also available. No AI provider API key is configured or stored by this extension; each selected backend must have an AI provider configured for your account.

## How the connection works

The extension uses existing routes from the DevForge application:

- `GET /api/auth/me` — verify your existing DevForge session.
- `GET /api/projects` — list projects in your account.
- `POST /api/projects` — create a DevForge project if you choose to.
- `POST /api/assistant/chat` — send general chat prompts.
- `POST /api/projects/:projectId/generate` and the project run/artifact routes — generate project files and retrieve the saved artifact before copying files to your selected local folder.

It does **not** call a new `/api/vscode/assistant` endpoint. AI provider credentials remain managed by your existing DevForge account/backend. Your account must have an AI provider configured; if no provider is configured, the backend will report that error.

## Requirements

- VS Code 1.85 or later.
- Node.js 20 or later recommended for building.
- An account on the selected local or hosted DevForge site.
- A GitHub account on the selected backend.
- At least one DevForge project, or permission to create one.
- An AI provider configured for your account in the existing DevForge web app.
- A writable local folder to use as the project destination. Open it in VS Code first, or select one when prompted.

## Build and install on Windows

Open PowerShell:

```powershell
cd C:\devforge-ai-tool\vscode-extension
npm install
npm run compile
npm run package
```

Install the `.vsix` file produced by `npm run package`:

```powershell
code --install-extension .\codevia-ai-1.0.4.vsix --force
```

If the filename differs, use the actual `.vsix` file created by `npm run package`. Reload VS Code after installing.

## First-time setup: connect your existing DevForge account

The extension uses one-time browser pairing to sign in, so you don't need to copy browser cookies into VS Code. Hosted and local sessions are stored separately.

1. In VS Code, press `Ctrl+Shift+P`.
2. Run **Codevia AI: Sign In (Choose Backend)** and select Local or Hosted, or use one of the direct backend sign-in commands. You can connect both environments independently.
3. In the browser opened for that backend, sign in with GitHub and approve the one-time Codevia AI connection.
4. Return to VS Code; the extension stores each session separately in VS Code SecretStorage.
5. Run **Codevia AI: Select Backend** to choose which signed-in backend to use, then run **Codevia AI: Select Project** for that backend.

The pairing code expires after a short time and can only be used once. The local and hosted sessions are independent; signing into one does not replace the other.

### Change project or sign out

- Run **Codevia AI: Select Project** to change the DevForge project associated with extension requests.
- Run **Codevia AI: Sign Out** to delete the saved session token for the currently selected backend and clear its selected project. The other backend's session remains connected. This does not sign you out of the browser or revoke the server session; use the web app's sign-out flow if you also want to end that session.
- If your session expires, repeat browser pairing for the selected backend.

## Features

Open the Command Palette with `Ctrl+Shift+P` and search for `Codevia AI`.

- **Open Chat** — send natural-language instructions to DevForge. Requests to create a new project use the project-generation workflow and save generated files into your workspace or a folder you select.
- **Generate Project** — request a project structure and source files, preview proposed paths, and confirm whether to skip or overwrite existing files.
- **Review Current File** — ask the hosted AI service to review the active source file; findings appear in VS Code's Problems panel.
- **Review Workspace** — review eligible files from the open workspace, subject to size limits.
- **Modify Current File** — request a change, inspect the diff, and approve or reject it.
- **Explain Code / Selection** — explain the selected code or the active file.
- **Generate Tests** — generate a test file and choose where to save it.
- **Fix Errors in Current File** — provide error details and review the proposed change before applying.
- **Clear Findings** — clear DevForge review diagnostics.
- **Chat file changes** — see assistant progress, save generated files to the open workspace or a folder you choose, verify each saved file, select changed files to review, and retry a failed project workflow.

For code-changing operations, inspect the diff and test the result before committing or deploying. AI-generated code may be incorrect.

## Local file saving

- The backend generates and stores the project artifact; the extension performs the local file writes. A browser-only project request cannot write to your PC.
- If chat doesn't create a new project, run **Codevia AI: Generate Project** from the Command Palette to start the dedicated workflow directly.
- The extension writes only to the open workspace folder or the folder you select. It does not need the Local Agent for this.
- Chat-generated files are written to the selected destination. Existing files are skipped unless you choose **Overwrite Existing**; each successful write is read back and verified.
- The dedicated **Generate Project** command shows a preview and asks before creating the files. Both workflows list every changed file and let you open files to review them.

## Troubleshooting

### `Could not connect to the Codevia backend`

Run **Codevia AI: Select Backend** and confirm the correct server is selected. For the local backend, start the app with `npm run dev:netlify` and check `Local Backend Url`. For the hosted backend, check `Netlify Backend Url` and confirm your PC can reach the site.

### `Authentication required` or `session expired`

Run **Codevia AI: Sign In (Choose Backend)** and complete browser pairing for the backend you want to reconnect.

### `AI provider is not configured`

Open the DevForge web app, configure a provider for your account using the web app's existing settings, and retry. No provider key should be entered into VS Code.

### `Project not found` or `Forbidden`

Run **Codevia AI: Select Project** and choose a project owned by the signed-in account.

### `Request too large`

Review fewer workspace files or reduce the active file's size. Do not include `.env`, credentials, private keys, or other secrets in prompts.

### Compilation errors

```powershell
cd C:\devforge-ai-tool\vscode-extension
npm install
npm run compile
```

Fix reported TypeScript errors before packaging. Use the filename actually produced by `npm run package`.

## Privacy and security

- No AI-provider API key is bundled or requested by the extension.
- The session token is stored using VS Code SecretStorage. Treat it as a password.
- Source code and prompts sent through chat are processed by the DevForge backend and configured AI provider. Do not send confidential code unless permitted by your organization and provider policy.
- The extension skips common secret/config files and generated/dependency folders when scanning workspaces, but you should inspect included context before sending it.
- Never commit session tokens, `.env` files, API keys, or other credentials.

## Scope of this package

This package modifies only the VS Code extension. It does not modify the DevForge web application, Netlify Functions, database schema, or local agent. Sign-in uses one-time browser pairing supported by the selected backend.
