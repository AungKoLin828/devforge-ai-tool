# DevForge AI Tool

DevForge AI is an AI-assisted project workspace built around GitHub sign-in, PostgreSQL-backed project artifacts, and a separately run local agent. The web app generates and reviews projects with OpenRouter, sends generated Node.js projects to the local agent for build and test commands, and synchronizes local Git repositories with GitHub.

## Important architecture

- Netlify hosts the browser and API functions.
- PostgreSQL stores metadata, plans, generated-code artifacts, jobs, audit logs and usage. Local working copies and synced repositories live on GitHub or the developer's PC.
- The Local Agent runs separately on the developer machine, is restricted to a workspace root, and runs generated project scripts only after user confirmation.
- AI credentials are server-side only.
- GitHub OAuth is the only authentication path in this baseline.
- Netlify Functions are not used as a shell executor.

## Local setup

1. Install Node.js 22 LTS, Git and PostgreSQL.
2. Copy `.env.example` to `.env` and set `DATABASE_URL` to the PostgreSQL connection string from **Supabase Dashboard → Connect**. For local development, use Supabase's session pooler connection string if a direct connection is not reachable. The app, Prisma CLI, and database check all use this one variable.
3. Create a **separate GitHub OAuth App for local development**. Set its Homepage URL to `http://localhost:8888` and its Authorization callback URL to `http://localhost:8888/api/auth/github/callback`. Put its client ID and secret in `GITHUB_LOCAL_CLIENT_ID` and `GITHUB_LOCAL_CLIENT_SECRET` in your local `.env`. Keep production `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `GITHUB_CALLBACK_URL` configured in Netlify; the app selects OAuth credentials based on whether the sign-in request comes from localhost or the deployed host.
4. Run `npm install`.
5. Run `npm run prisma:generate`.
6. If the database is new, apply the checked-in PostgreSQL schema migration with `npm run prisma:deploy`. If you already created the schema manually, make sure the `DATABASE_URL` in `.env` points to that exact database and verify `"User"` exists there before signing in. Do not apply the initial migration to a database where you already manually created its enums and tables; it will try to create those objects again.
   To verify the exact database selected by the local app without displaying credentials, run `npm run db:check`. It reports the connected database/schema and whether `public."User"` has the columns required by Prisma.
7. Run `npm run build`.
8. Start the local app at `http://localhost:8888` with `npm run dev:netlify`. Always start GitHub sign-in from this same origin. Do not start sign-in on Netlify and then open the localhost callback, or start locally and return to the Netlify callback: the OAuth state cookie is intentionally restricted to the site where login began.
9. On your PC, open a second terminal in the DevForge repository folder and run `npm run agent:dev`. Keep the terminal open. If `DEVFORGE_AGENT_TOKEN` is unset, the agent prints a random pairing token in its terminal.
   For GitHub synchronization, install Git and sign in to GitHub on that PC using Git Credential Manager (or another Git credential helper). DevForge uses its encrypted GitHub OAuth token only for repository listing/creation; the token is never sent to the Local Agent.
10. In the signed-in project workspace, paste that token into **Local agent pairing token** and select **Connect local agent**. The token is saved in this browser's local storage. Generated files are written under `<DEVFORGE_WORKSPACE>/projects/<project-id>`.
11. Select **Build locally** or **Test locally** to run the generated project's corresponding build/test command. The app asks for confirmation first because project scripts can execute code on your PC.
12. To bring in an existing local project, connect the Local Agent and choose a folder under its workspace in **Import a folder from this workspace**. Folders directly under the workspace and project folders under its `projects/` directory are listed. Review the confirmation before uploading: import skips dependency/build output directories, environment secret files, and common private-key files; it accepts up to 300 text files and 2 MB. Imported files are stored as a `CODE` artifact in PostgreSQL and can be AI-reviewed or copied to an isolated DevForge workspace folder for local build/test.
13. Use **Local workspace files** to browse and edit text files under the agent workspace. **Save to PC** writes to the selected existing file. Hidden/secret files, dependency folders, symlinks, binary files and files larger than 1 MB are not available in the browser editor; edits are local and are not automatically uploaded into a DevForge project artifact.
14. Generated artifacts stay in your DevForge account until copied to your computer. Select **Sync files to PC** to copy them under `<DEVFORGE_WORKSPACE>/projects/<project-id>` and open that folder in **Local workspace files**. **Build locally** and **Test locally** also sync the files before running project scripts.

## Create and start the Local Agent on Windows

You do **not** need to clone or download the DevForge application repository, and you do **not** need to upload your local project source to DevForge to connect the agent. The installer downloads only the three Local Agent runtime files into `%LOCALAPPDATA%\DevForgeAgent`; it does not install or copy the web app.

1. Install Node.js 22 LTS or newer.
2. Open PowerShell and download the small installer script:

   ```powershell
   $installer = Join-Path $env:TEMP "install-devforge-agent.ps1"
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
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installer -WorkspacePath "$HOME\DevForge"
   ```

   `-ExecutionPolicy Bypass` applies only to this installer process; it does not change the machine's PowerShell execution policy. If your organization enforces an execution policy through Group Policy and blocks this command, ask your administrator to approve the installer rather than changing system policy.
   Choose a folder your Windows account can create and write to. A path directly under another drive, such as `D:\DevForge`, may be blocked by that drive's permissions; use `$HOME\DevForge` or an existing writable folder on that drive instead. The installer checks workspace write access and prints a specific error if permission is denied.

4. Start the agent by running this command in PowerShell (do not type the `...` placeholder literally):

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\DevForgeAgent\Start-DevForgeAgent.ps1"
   ```

   If you installed the agent to a custom location, replace the path with the full path to `Start-DevForgeAgent.ps1` printed by the installer. To update an existing standalone agent, stop its running PowerShell window, rerun the installer from step 2, then start it again. This process-only bypass also lets the generated launcher run without changing the machine's execution policy. Keep its PowerShell window open. The agent prints a random **Pairing token** when it starts.
5. In the signed-in DevForge web app, paste the token into **Local agent pairing token** and select **Connect local agent**.
6. Select **Sync files to PC** to copy generated artifacts into `<workspace>\projects\<project-id>`. This direction transfers generated files from DevForge to your PC. Your other local project files are not uploaded unless you explicitly use **Import local project**.

The agent listens on `127.0.0.1` only and should be started on the same PC and browser you use to connect. If the app cannot connect, check that the agent terminal is still running, the token matches, and port `45821` is available. The source of the standalone installer is [agent/install.ps1](./agent/install.ps1); it fetches only the agent runtime files from this repository.

## Prisma setup

This starter is pinned to Prisma ORM **7.10.0**. `prisma`, `@prisma/client`, and `@prisma/adapter-pg` are intentionally kept on the same exact version. The generated Prisma Client is not committed; `npm run prisma:generate` creates it under `src/generated/prisma/`.

Apply database changes with `npm run prisma:deploy` before starting the app against a new Supabase database. Configure the same Supabase PostgreSQL connection string as `DATABASE_URL` in the environment where the app or Prisma CLI runs. Keep production and local Supabase project URLs separate unless you intentionally want to modify production data.

If you previously installed a broken Prisma package, remove `node_modules` and `package-lock.json`, then run `npm install` before running `npm run prisma:generate`. Do not install Prisma globally.

## Production notes

Use a managed Postgres database (including Netlify Database if available for the site), set production environment variables in Netlify, and never expose secrets through `VITE_*`. The included Local Agent binds to loopback only and uses a random pairing token unless explicitly configured. By default, it accepts browser requests only from localhost development and the production site; set `DEVFORGE_ALLOWED_ORIGINS` to a comma-separated allowlist for other trusted origins. Build/test supports Node.js `package.json` scripts, Python syntax/unit-test commands, Go modules, Rust Cargo projects, Maven and Gradle projects. Static projects containing `index.html` need no build step; unsupported/missing build configurations now return an actionable result instead of an HTTP error. Local builds/tests can run for up to 12 minutes per command; the browser allows up to 25 minutes for a multi-stage operation. The authenticated AI Assistant chat accepts follow-up project questions using the latest saved project context. Before public release, add a signed native installer, OS credential storage, CSP/security headers, centralized rate limiting, error tracking and automated CI security scans.

## Phases

1. Foundation: React/Vite/Netlify/Prisma/GitHub OAuth.
2. Local Agent: workspace-restricted project import, generated-file sync and Node.js build/test execution.
3. Browser IDE foundation: explorer/editor-oriented shell and project workspace.
4. AI: provider abstraction, OpenRouter/OpenAI adapters and project generation.
5. Autonomous workflow: project runs, artifacts and agent jobs.
6. Production hardening: audit logging, encrypted provider credentials, RBAC-ready membership, sessions and safety boundaries.
7. Advanced foundation: AI usage tracking, GitHub repository metadata, protocol/event model and extensible provider/job architecture.

## API baseline

`GET /api/auth/github` · `GET /api/auth/github/callback` · `POST /api/auth/logout` · `GET /api/auth/me` · `GET /api/github/repositories` · `GET/POST /api/projects` · `POST /api/projects/import` · `GET/DELETE /api/projects/:id` · `POST /api/projects/:id/github/connect` · `POST /api/projects/:id/github/create` · `POST /api/projects/:id/github/status` · `POST /api/projects/:id/generate` · `POST /api/projects/:id/review` · `POST /api/projects/:id/chat` · `GET /api/projects/:id/runs/:runId` · `GET /api/projects/:id/history` · `POST /api/projects/:id/jobs` · `GET /api/agent` · `POST /api/agent/register` · `POST /api/agent/job/claim` · `POST /api/agent/job/result` · `GET /api/ai/providers`.

Deleting a project permanently removes its database record and related artifacts, runs, and jobs. A confirmation prompt is shown in the workspace; copies already synced to a Local Agent workspace are not deleted.

Importing a local project requires an authenticated web session and the paired Local Agent. The agent reads only folders inside `DEVFORGE_WORKSPACE`; symlinks are skipped, and imports are limited to 300 text files/2 MB. Environment files other than `.env.example` and `.env.sample`, common private-key files, and dependency/build output directories are excluded. Review files for credentials before confirming an upload. The imported snapshot is saved as a `CODE` artifact; edits made to a local build/test copy are not automatically synchronized back to PostgreSQL. Use **Remove imported project** to remove that imported snapshot and its DevForge history without changing or deleting the original files on your PC. The browser workspace editor reads and writes existing UTF-8 text files only within the configured workspace, omits common secret and generated paths, and refuses to overwrite a file changed on disk since it was opened.

After generating or importing project code, enter a requested change in the AI Project Builder and choose **Request modification**. DevForge sends the existing generated files with the request and saves the complete updated project files and plan when the background run succeeds. This is separate from project chat, which answers questions but does not edit project files.

GitHub synchronization is available from a project's workspace. Connect a writable repository or create a new private or public repository, then use the Local Agent to clone it, pull its default branch, or commit and push local changes. Use **Disconnect repository** to remove the GitHub link from DevForge without deleting the GitHub repository or local files. Use **Initialize & push** to publish an existing local folder without cloning; it initializes Git there or attaches the connected remote to an existing repository. Private repositories require Git credentials configured on the PC; pulls refuse to overwrite uncommitted changes. Before a push, review the confirmation: saved DevForge files are copied into the selected local folder and matching files can be overwritten, then all Git changes are committed with the supplied message. Common environment-secret and private-key files are blocked from pushes.

## Project generation lifecycle

Generation creates a PostgreSQL `ProjectRun` and runs in a Netlify Background Function. A successful run saves requirements, architecture, database design, API design, the implementation plan, and generated files as `Artifact` records in one transaction before marking the project `READY`. Invalid or empty generated file lists fail the run instead of reporting a ready project. `GET /api/projects/:id` returns those saved artifacts so they remain available when the project is opened again or the page is refreshed.

`POST /api/projects/:id/review` queues an OpenRouter review of the saved generated files. Review findings are validated and saved as a `REVIEW` artifact; the run and project transition through `REVIEWING` to `READY` on success or `FAILED` on error. Build, test, and Git commands run through the loopback-only Local Agent. Generated Node.js project files and command output remain on the developer's PC, and GitHub repository contents are transferred directly between that PC and GitHub.
