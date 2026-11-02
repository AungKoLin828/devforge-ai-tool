# DevForge AI Developer Tools for VS Code

DevForge AI adds a custom chat panel and coding commands to VS Code. Requests to create a new project from chat use the project-generation workflow and copy the generated files into your open workspace. If no workspace is open, VS Code asks you to choose a local destination folder. You review the file list and confirm before files are written; existing files are skipped unless you explicitly choose to overwrite them.

The extension connects to the hosted DevForge backend by default and does not add or require an AI-provider API key inside the extension. The Local Agent is not required for the extension to save generated files to a folder on your PC.

## Choose local or Netlify backend

The extension supports both environments without changing the DevForge web app or Netlify Functions. Open **VS Code Settings** (`Ctrl+,`) and search for **DevForge AI**:

- `DevForge AI Developer Tools: Backend Environment` = `local` or `netlify` (default).
- `Local Backend Url` defaults to `http://localhost:8888`.
- `Netlify Backend Url` defaults to `https://devforge-ai-tool.netlify.app`.

### Local development

1. Start the DevForge web app from its project root using `npm run dev:netlify`.
2. Netlify CLI normally serves the app and functions at `http://localhost:8888`. Use that full origin in `Local Backend Url` if your port differs.
3. Set `Backend Environment` to `local`.
4. Run **DevForge AI: Sign In to Existing Account**. Sign in to the local app in the browser and copy the local `devforge_session` cookie value from browser DevTools. Local and hosted cookies are stored separately.

Do not use the Vite-only `http://localhost:5173` URL unless your local setup also routes `/api/*` to the Netlify Functions. The extension needs the backend routes, not just the frontend dev server. HTTP is permitted only for loopback local development.

### Hosted Netlify deployment

1. Keep `Backend Environment` set to `netlify` (the default).
2. Keep `Netlify Backend Url` set to your deployed site URL.
3. Run **DevForge AI: Sign In to Existing Account** and copy the `devforge_session` cookie from the hosted site's browser session.

When changing environments, sign in separately for each environment. The extension stores the two session cookie values separately. No AI provider API key is configured or stored by this extension; the selected backend must have a valid account session and AI provider configuration.

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
- A valid `devforge_session` session cookie from your own signed-in browser session.
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
code --install-extension .\devforge-ai-developer-tools-0.1.0.vsix --force
```

If the filename differs, use the actual `.vsix` file created by `npm run package`. Reload VS Code after installing.

## First-time setup: connect your existing DevForge account

This version uses the existing session-based API. Since the current web backend has a browser cookie session but no extension-specific OAuth callback/token-exchange endpoint, the extension uses a one-time session-cookie handoff. This avoids changing the web app/backend and avoids an AI-provider API key in the extension.

1. Open the DevForge website in your normal browser and sign in with GitHub.
2. In VS Code, press `Ctrl+Shift+P`.
3. Run **DevForge AI: Sign In to Existing Account**.
4. The browser opens to your configured DevForge site. Make sure you have completed GitHub sign-in there.
5. Open browser Developer Tools (`F12`). In Chrome/Edge, open **Application** → **Storage** → **Cookies** → your DevForge website. In Firefox, use **Storage** → **Cookies**.
6. Find the cookie named `devforge_session`. Copy its **Value** only. Do not copy `devforge_oauth`, and do not paste the cookie into chat, source files, settings JSON, or Git.
7. Return to VS Code and paste the `devforge_session` value into the password input. The extension validates it using `GET /api/auth/me` and stores it in VS Code SecretStorage.
8. When prompted, run **DevForge AI: Select Project** and select an existing project, or create a new project.

The extension does not read your browser cookies automatically. The cookie handoff is needed because the current backend does not provide a VS Code-specific sign-in callback. Session cookies are credentials: only use your own account, do not share them, and remove them from VS Code when finished on a shared computer.

### Change project or sign out

- Run **DevForge AI: Select Project** to change the DevForge project associated with extension requests.
- Run **DevForge AI: Sign Out** to delete the saved session cookie from VS Code SecretStorage and clear the selected project. This does not sign you out of the browser or revoke the server session; use the web app's sign-out flow if you also want to end that session.
- If your session expires, repeat the sign-in flow with a fresh cookie value.

## Features

Open the Command Palette with `Ctrl+Shift+P` and search for `DevForge AI`.

- **Open Chat** — send natural-language instructions to DevForge. Requests to create a new project use the project-generation workflow and save generated files into your workspace or a folder you select.
- **Generate Project** — request a project structure and source files, preview proposed paths, and confirm whether to skip or overwrite existing files.
- **Review Current File** — ask the hosted AI service to review the active source file; findings appear in VS Code's Problems panel.
- **Review Workspace** — review eligible files from the open workspace, subject to size limits.
- **Modify Current File** — request a change, inspect the diff, and approve or reject it.
- **Explain Code / Selection** — explain the selected code or the active file.
- **Generate Tests** — generate a test file and choose where to save it.
- **Fix Errors in Current File** — provide error details and review the proposed change before applying.
- **Clear Findings** — clear DevForge review diagnostics.

For code-changing operations, inspect the diff and test the result before committing or deploying. AI-generated code may be incorrect.

## Local file saving

- The backend generates and stores the project artifact; the extension performs the local file writes. A browser-only project request cannot write to your PC.
- If chat doesn't create a new project, run **DevForge AI: Generate Project** from the Command Palette to start the dedicated workflow directly.
- The extension writes only to the open workspace folder or the folder you select. It does not need the Local Agent for this.
- Files are applied only after you confirm. Existing files are protected unless you explicitly choose **Overwrite Existing**.

## Troubleshooting

### `Authentication required` or `session expired`

Run **DevForge AI: Sign In to Existing Account** again and paste the current `devforge_session` cookie value. Ensure the cookie came from the exact same DevForge domain configured in Settings.

### `AI provider is not configured`

Open the DevForge web app, configure a provider for your account using the web app's existing settings, and retry. No provider key should be entered into VS Code.

### `Project not found` or `Forbidden`

Run **DevForge AI: Select Project** and choose a project owned by the signed-in account.

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
- The session cookie is stored using VS Code SecretStorage. Treat it as a password.
- Source code and prompts sent through chat are processed by the DevForge backend and configured AI provider. Do not send confidential code unless permitted by your organization and provider policy.
- The extension skips common secret/config files and generated/dependency folders when scanning workspaces, but you should inspect included context before sending it.
- Never commit the session cookie, `.env` files, API keys, or other credentials.

## Scope of this package

This package modifies only the VS Code extension. It does not modify the DevForge web application, Netlify Functions, database schema, or local agent. The browser-cookie handoff is a compatibility workaround for the existing authentication design; a smoother GitHub sign-in inside VS Code would require backend support for an extension callback or token exchange, which this package intentionally does not add.
