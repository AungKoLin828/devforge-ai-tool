# Codevia AI

Codevia AI is an AI-assisted project workspace built around GitHub sign-in, PostgreSQL-backed project artifacts, and a separately run local agent. The web app generates and reviews projects with OpenRouter, OpenAI, or a user-configured OpenAI-compatible provider, sends generated projects to the local agent for build and test commands, and synchronizes local Git repositories with GitHub.

The public user guide is available at `/guide` and can be read without signing in. Creating or managing projects and using connected services still requires GitHub authentication.

## Use Codevia AI with VS Code

The Codevia AI VS Code extension can generate a project and copy its files directly into an open workspace or a local folder you select. Install and configure it using [the extension guide](./apps/vscode-extension/README.md). Project generation through the browser cannot write files directly to your PC; use the extension or download a ZIP and extract it.

You can also use VS Code as the editor for a project on your PC:

1. Sign in to Codevia AI, create or select a project, and generate its code.
2. To download without installing or pairing the Local Agent, select **Download ZIP** in the project workspace. Extract the downloaded archive to a folder on your PC.
3. To sync directly into the Codevia AI workspace instead, install and open the Codevia AI VS Code extension, then select **Connect agent**. The extension downloads and verifies the Local Agent, creates its workspace, starts it in the background, and pairs it with the browser. If the extension is unavailable, the Windows installer remains available as a one-time manual setup. Select **Sync files to PC** and confirm; generated files are copied to `<CODEVIA_WORKSPACE>\projects\<project-id>`.
4. Open the extracted ZIP folder or the synced agent folder in VS Code using **File → Open Folder**. For an agent-synced folder, you can also run `code "<CODEVIA_WORKSPACE>\projects\<project-id>"` from PowerShell; use the workspace root reported by the Local Agent for `<CODEVIA_WORKSPACE>`.
5. Edit the files in VS Code. Those local edits do not automatically update the code artifact stored in Codevia AI.

**Important:** Browser ZIP downloads do not need the Local Agent, but must be extracted manually. Codevia AI's **Sync files to PC**, **Build locally**, **Test locally**, and GitHub push workflows require the Local Agent. Sync and the standard build/test actions copy saved generated files onto the PC and can overwrite matching edits in the project folder. Build/test stream live stdout and stderr into the **Local terminal output** panel in Codevia AI; commands execute on your PC through the Local Agent, not in the VS Code integrated terminal. After editing files locally, run checks in the VS Code terminal and use Git in VS Code (or its terminal) to commit and push those changes if you want to preserve them. Do not run an operation that syncs generated files until you are ready for the saved Codevia AI version to overwrite matching local files.

## Important architecture

- Netlify hosts the browser and API functions.
- PostgreSQL stores metadata, plans, generated-code artifacts, project knowledge chunks and embeddings, jobs, audit logs and usage. Local working copies and synced repositories live on GitHub or the developer's PC.
- The Local Agent runs separately on the developer machine, is restricted to a workspace root, and runs generated project scripts only after user confirmation.
- AI credentials are server-side only.
- GitHub OAuth is the only authentication path in this baseline.
- Netlify Functions are not used as a shell executor.

## Project knowledge base (RAG)

Open **Knowledge Base** in a selected project's chat to add Markdown/text files, paste notes, import a public HTTPS page, import a repository accessible to your GitHub account, or index the latest saved project code. Project chat retrieves relevant passages using PostgreSQL full-text ranking and cosine similarity over provider embeddings, then returns source citations with its answer. The panel also lets you test retrieval and remove indexed sources.

Knowledge is private to the owning project. Importing a source sends its text to the selected AI provider for embeddings; chat sends retrieved passages to that provider. Import only content you are authorized to share, and check source text for credentials before indexing; secret-like paths are skipped but file contents are not automatically redacted. URL imports require HTTPS, reject private/local addresses and redirects, and are size-limited; query strings are removed from saved citation URLs. GitHub snapshots use the signed-in GitHub account, skip secret/build/dependency paths, and are refreshed by importing the same repository again. Each source is limited to 100 text files, 512 KB and 180 chunks; a project can contain up to 5,000 chunks.

Embeddings use an OpenAI-compatible `/embeddings` endpoint. `RAG_EMBEDDING_MODEL` defaults to `text-embedding-3-small` for OpenAI-compatible providers and `openai/text-embedding-3-small` for OpenRouter; set it in the server environment when your provider requires a different model. If the selected provider does not expose a compatible embeddings endpoint, indexing and RAG chat return an explicit provider error. Re-index sources after changing embedding provider/model. Semantic vectors are scanned in the application, so the 5,000-chunk project cap keeps retrieval bounded without requiring the PostgreSQL `vector` extension.

## Repository layout

- `apps/web` contains the React/Vite web application.
- `apps/vscode-extension` contains the separately packaged VS Code extension.
- `packages/shared` contains protocol contracts available for reuse across project components.
- `packages/rag-engine` contains reusable text chunking and hybrid rank fusion.
- `agent`, `netlify/functions`, and `src/server` retain the existing Local Agent and API implementation; the rest of the AI/RAG modules have not yet been split into separate packages.
- The root `package.json` continues to manage the web/backend build and deployment tooling.

## Local setup

1. Install Node.js 22 LTS, Git and PostgreSQL.
2. Copy `.env.example` to `.env` and replace `YOUR_POSTGRES_PASSWORD` in `DATABASE_URL` with the password for your local PostgreSQL `postgres` role. The default local URL targets `localhost:5432` and a database named `devforge`; URL-encode special characters in the password. The app, Prisma CLI, and database check all use this one variable.
3. Create a **separate GitHub OAuth App for local development**. Set its Homepage URL to `http://localhost:8888` and its Authorization callback URL to `http://localhost:8888/api/auth/github/callback`. Put its client ID and secret in `GITHUB_LOCAL_CLIENT_ID` and `GITHUB_LOCAL_CLIENT_SECRET` in your local `.env`. Keep production `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `GITHUB_CALLBACK_URL` configured in Netlify; the app selects OAuth credentials based on whether the sign-in request comes from localhost or the deployed host.
4. Run `npm install`.
5. Run `npm run db:setup`. This generates the Prisma client, creates the `devforge` database if it does not exist, and applies the checked-in migrations. The PostgreSQL role must be allowed to create databases.
6. If you already created the schema tables and enums manually, do not run `db:setup` against that database because the initial migration will try to create them again. Instead, point `DATABASE_URL` at that database and run `npm run db:check`; it reports the selected database/schema and checks whether `public."User"` has the columns required by Prisma.
   After at least one account has signed in, grant it the admin role with `npm run set-admin -- <githubUsername-or-email>`. Alternatively, set `ADMIN_GITHUB_USERNAME` in `.env` and run `npm run set-admin`; the command uses `DIRECT_URL` when configured, otherwise `DATABASE_URL`. Run `npm run set-admin` without either value to list existing users.
7. For a database that was already set up before adding new migrations, run `npm run prisma:deploy` against the intended database to apply them. Then run `npm run build`.
8. Start the local app at `http://localhost:8888` with `npm run dev:netlify`. This project uses standard Netlify Functions and no Edge Functions, so the development command skips Netlify's unused Deno Edge Functions runtime; this also avoids the runtime-bootstrap network fetch that can fail on restricted connections. The Node-backed API and background functions still load normally. Vite is pinned to Netlify's target port (5173) and will report an error rather than silently switching ports if another dev server is using it; stop any old dev-server terminals, then restart `npm run dev:netlify`. Always start GitHub sign-in from this same origin. Do not start sign-in on Netlify and then open the localhost callback, or start locally and return to the Netlify callback: the OAuth state cookie is intentionally restricted to the site where login began.
9. Install and open the Codevia AI VS Code extension before connecting. It provides the local setup helper, verifies downloaded files, creates the default workspace, and starts the agent in the background. Node.js 22 LTS or newer is required. If you are developing the Local Agent from source, run `npm run agent:dev` in a second terminal instead. The app retrieves the pairing token directly from the agent; there is no token to copy.
   For GitHub synchronization, install Git and sign in to GitHub on that PC using Git Credential Manager (or another Git credential helper). Codevia AI uses its encrypted GitHub OAuth token only for repository listing/creation; the token is never sent to the Local Agent.
10. In the signed-in project workspace, select **Connect agent**. The app pairs automatically. Selecting **Generate** also starts and connects the agent if it is not already connected. Generated files are written under `<CODEVIA_WORKSPACE>/projects/<project-id>`.
11. Select **Build locally** or **Test locally** to run the generated project's corresponding build/test command. The app asks for confirmation first because project scripts can execute code on your PC.
12. To bring in an existing local project, connect the Local Agent and choose a folder under its workspace in **Import a folder from this workspace**. Folders directly under the workspace and project folders under its `projects/` directory are listed. Review the confirmation before uploading: import skips dependency/build output directories, environment secret files, and common private-key files; it accepts up to 300 text files and 2 MB. Imported files are stored as a `CODE` artifact in PostgreSQL and can be AI-reviewed or copied to an isolated Codevia AI workspace folder for local build/test.
13. Use **Code Editor** to browse and edit text files under the agent workspace. The editor includes line numbers, source position, and build diagnostics that can open a reported generated source file at its error line. **Save to PC** writes to the selected existing file. For a synced Codevia AI project, use **Build edited files** after saving to compile the current local files without overwriting your changes. The standard **Build locally** and **Test locally** actions still sync saved generated files first. Hidden/secret files, dependency folders, symlinks, binary files and files larger than 1 MB are not available in the browser editor; edits are local and are not automatically uploaded into a Codevia AI project artifact.
14. Generated artifacts stay in your Codevia AI account until copied to your computer. Select **Sync files to PC** to copy them under `<CODEVIA_WORKSPACE>/projects/<project-id>` and open that folder in **Local workspace files**. **Build locally** and **Test locally** also sync the files before running project scripts.

When a Vite project has a conventional `main` or `index` source entry but is missing its root `index.html`, the updated Local Agent creates the standard HTML entry before building and reports that step in **Local terminal output**. It does not replace existing HTML files or projects with a custom `vite.config.*`. Vite packages are selected for builds only when they define a build script, so unrelated nested packages without build scripts are skipped.

## Create and start the Local Agent on Windows

You do **not** need to clone or download the application source repository, and you do **not** need to upload your local project source to Codevia AI to connect the agent. The installer downloads only the three Local Agent runtime files into `%LOCALAPPDATA%\DevForgeAgent`; it does not install or copy the web app.

1. Install Node.js 22 LTS or newer.
2. Open PowerShell and download the small installer script:

   ```powershell
   $installer = Join-Path $env:TEMP "install-codevia-agent.ps1"
   Invoke-WebRequest `
     -Uri "https://raw.githubusercontent.com/AungKoLin828/devforge-ai-tool/main/agent/install.ps1" `
     -OutFile $installer
   ```

3. Inspect the downloaded script, then run it:

   ```powershell
   Get-Content $installer
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installer
   ```

   To choose a different local workspace, pass a folder path:

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installer -WorkspacePath "$HOME\CodeviaAI"
   ```

   `-ExecutionPolicy Bypass` applies only to this installer process; it does not change the machine's PowerShell execution policy. If your organization enforces an execution policy through Group Policy and blocks this command, ask your administrator to approve the installer rather than changing system policy.
   Choose a folder your Windows account can create and write to. A path directly under another drive, such as `D:\CodeviaAI`, may be blocked by that drive's permissions; use `$HOME\CodeviaAI` or an existing writable folder on that drive instead. The installer checks workspace write access and prints a specific error if permission is denied.

4. The installer registers a per-user `devforge-agent:` link handler and starts the agent. In the signed-in Codevia AI app, select **Connect agent** or start project generation. If the browser asks whether to open Codevia AI Agent, approve it. The agent starts hidden and pairs automatically; no token copy is needed. Its runtime logs are saved under `%LOCALAPPDATA%\DevForgeAgent`.
5. To update the standalone agent, rerun the installer from step 2. If an older agent is already running, close its `node` process before using the updated one; the app reports when the running version does not support automatic pairing.
6. Select **Sync files to PC** to copy generated artifacts into `<workspace>\projects\<project-id>`. This direction transfers generated files from Codevia AI to your PC. Your other local project files are not uploaded unless you explicitly use **Import local project**.

When the VS Code extension is installed and open, **Connect agent** downloads and verifies the agent files, creates the default workspace, starts the agent in the background, and pairs automatically. Browsers do not allow websites to silently execute downloaded installers; if the extension is unavailable on Windows, the web app falls back to the standalone installer and asks you to run it once. The agent listens on `127.0.0.1` only and should be started on the same PC and browser you use to connect. Pairing is available only to explicitly allowed Codevia AI site origins, and the pairing token is not shown or stored by the standalone launcher. If the app cannot connect, make sure ports `45821` and `45822` are available. The source of the standalone installer is [agent/install.ps1](./agent/install.ps1); it fetches only the agent runtime files from this repository.

If Build/Test reports that only Node.js projects are supported or says the agent cannot stream output, the connected Local Agent is older than the web app. Stop that agent and start the updated source from the DevForge repository with `npm.cmd run agent:dev`, then select **Connect agent** again. For the standalone installation, rerun its installer after the updated runtime is available in the repository's published branch.

## Prisma setup

This starter is pinned to Prisma ORM **7.10.0**. `prisma`, `@prisma/client`, and `@prisma/adapter-pg` are intentionally kept on the same exact version. The generated Prisma Client is not committed; `npm run prisma:generate` creates it under `src/generated/prisma/`.

For local development, `npm run db:setup` creates the target database if needed and applies migrations with `prisma migrate dev`. Netlify production builds run `prisma migrate deploy` before building the app, so any committed, unapplied migration is applied automatically; deploy previews do not run production migrations. Set `DATABASE_URL` in Netlify for the running app and, preferably, set `DIRECT_URL` to a direct or session-pooler PostgreSQL connection for migrations. If `DIRECT_URL` is unset, migrations fall back to `DATABASE_URL`. Set both variables for the Production deploy context and ensure they point to the same database. For Supabase, copy the exact connection details from the project's Connect panel; do not combine a pooler hostname from one project with a username/project reference from another. A pooler error such as `tenant/user ... not found` means the configured endpoint cannot resolve that database tenant; migrations cannot fix the URL or activate a missing project. Keep production and local database URLs separate unless you intentionally want to modify production data.

To change the production schema, create a new Prisma migration locally with `npm run prisma:migrate`, review and commit the generated folder under `prisma/migrations`, then deploy. Do not edit migrations that have already been applied.

If you previously installed a broken Prisma package, remove `node_modules` and `package-lock.json`, then run `npm install` before running `npm run prisma:generate`. Do not install Prisma globally.

## Production notes

Use a managed Supabase PostgreSQL database, set production environment variables in Netlify, and never expose secrets through `VITE_*`. To grant the initial admin role without editing the database manually, set `ADMIN_GITHUB_USERNAME` in Netlify to the exact GitHub username (with or without a leading `@`), then redeploy and sign in with that GitHub account. The role is granted during sign-in once the database connection is working; removing the variable later does not demote that account. The included Local Agent binds to loopback only and uses a random pairing token; the updated agent reveals it only to allowlisted Codevia AI browser origins for automatic pairing. By default, it accepts browser requests only from localhost development and the production site; set `DEVFORGE_ALLOWED_ORIGINS` to a comma-separated allowlist for other trusted origins. Build/test supports Node.js `package.json` scripts, Python syntax/unit-test commands, Go modules, Rust Cargo projects, Maven and Gradle projects in the project root or nested application folders. Static projects containing `index.html` need no build step; unsupported/missing build configurations return an actionable result instead of an HTTP error. Local builds/tests can run for up to 12 minutes per command; the browser allows up to 25 minutes for a multi-stage operation. The authenticated AI Assistant chat accepts follow-up project questions using the latest saved project context. Before public release, add a signed native installer, OS credential storage, CSP/security headers, centralized rate limiting, error tracking and automated CI security scans.

## Phases

1. Foundation: React/Vite/Netlify/Prisma/GitHub OAuth.
2. Local Agent: workspace-restricted project import, generated-file sync and build/test execution for Node.js, Python, Go, Rust, Maven and Gradle projects.
3. Browser IDE foundation: explorer/editor-oriented shell and project workspace.
4. AI: provider abstraction, OpenRouter/OpenAI adapters and project generation.
5. Autonomous workflow: project runs, artifacts and agent jobs.
6. Production hardening: audit logging, encrypted provider credentials, RBAC-ready membership, sessions and safety boundaries.
7. Advanced foundation: AI usage tracking, GitHub repository metadata, protocol/event model and extensible provider/job architecture.

## API baseline

`GET /api/auth/github` · `GET /api/auth/github/callback` · `POST /api/auth/logout` · `GET /api/auth/me` · `GET /api/github/repositories` · `GET/POST /api/projects` · `POST /api/projects/import` · `GET/DELETE /api/projects/:id` · `POST /api/projects/:id/github/connect` · `POST /api/projects/:id/github/create` · `POST /api/projects/:id/github/status` · `POST /api/projects/:id/generate` · `POST /api/projects/:id/review` · `POST /api/projects/:id/chat` · `GET /api/projects/:id/runs/:runId` · `GET /api/projects/:id/history` · `POST /api/projects/:id/jobs` · `GET /api/agent` · `POST /api/agent/register` · `POST /api/agent/job/claim` · `POST /api/agent/job/result` · `GET /api/ai/providers` · `PUT/DELETE /api/ai/providers/:provider`.

## AI provider configuration

Choose OpenRouter, OpenAI, or **Custom OpenAI-compatible** in the AI Project Builder. Provider credentials and model settings are scoped to the signed-in account; API keys are encrypted at rest and are never returned to the browser after saving. The server's existing OpenRouter environment configuration remains available as the default when no account-specific key is saved.

For a custom provider, enter its HTTPS base URL, model identifier, and API key. The endpoint must use the OpenAI-compatible `/chat/completions` protocol and resolve to a public host. Native Gemini, Anthropic, or other provider protocols are not supported unless the provider exposes that compatible API. Generation, project modifications, reviews, and chat use the provider selected in the workspace.

Deleting a project permanently removes its database record and related artifacts, runs, and jobs. A confirmation prompt is shown in the workspace; copies already synced to a Local Agent workspace are not deleted.

Importing a local project requires an authenticated web session and the paired Local Agent. The agent reads only folders inside `CODEVIA_WORKSPACE`; symlinks are skipped, and imports are limited to 300 text files/2 MB. Environment files other than `.env.example` and `.env.sample`, common private-key files, and dependency/build output directories are excluded. Review files for credentials before confirming an upload. The imported snapshot is saved as a `CODE` artifact; edits made to a local build/test copy are not automatically synchronized back to PostgreSQL. Use **Remove imported project** to remove that imported snapshot and its Codevia AI history without changing or deleting the original files on your PC. The browser workspace editor reads and writes existing UTF-8 text files only within the configured workspace, omits common secret and generated paths, and refuses to overwrite a file changed on disk since it was opened.

After generating or importing project code, enter a requested change in the AI Project Builder and choose **Request modification**. Codevia AI sends the existing generated files with the request and saves the complete updated project files and plan when the background run succeeds. This is separate from project chat, which answers questions but does not edit project files.

GitHub synchronization is available from a project's workspace. Connect a writable repository or create a new private or public repository, then use the Local Agent to clone it, pull its default branch, or commit and push local changes. Use **Disconnect repository** to remove the GitHub link from Codevia AI without deleting the GitHub repository or local files. Use **Initialize & push** to publish an existing local folder without cloning; it initializes Git there or attaches the connected remote to an existing repository. Private repositories require Git credentials configured on the PC; pulls refuse to overwrite uncommitted changes. Before a push, review the confirmation: saved Codevia AI files are copied into the selected local folder and matching files can be overwritten, then all Git changes are committed with the supplied message. Common environment-secret and private-key files are blocked from pushes.

## Project generation lifecycle

Generation creates a PostgreSQL `ProjectRun` and runs in a Netlify Background Function. A successful run saves requirements, architecture, database design, API design, the implementation plan, and generated files as `Artifact` records in one transaction before marking the project `READY`. Invalid or empty generated file lists fail the run instead of reporting a ready project. `GET /api/projects/:id` returns those saved artifacts so they remain available when the project is opened again or the page is refreshed.

`POST /api/projects/:id/review` queues a review of the saved generated files using the selected provider. Review findings are validated and saved as a `REVIEW` artifact; the run and project transition through `REVIEWING` to `READY` on success or `FAILED` on error. Build, test, and Git commands run through the loopback-only Local Agent. Generated project files and command output remain on the developer's PC, and GitHub repository contents are transferred directly between that PC and GitHub.
