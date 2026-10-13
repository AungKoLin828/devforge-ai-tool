# DevForge AI Tool

DevForge AI is an AI-assisted project workspace built around GitHub sign-in, PostgreSQL-backed project artifacts, and a separately run local agent. The web app generates and reviews projects with OpenRouter, and can send generated Node.js projects to the local agent for build and test commands. GitHub synchronization remains on the roadmap.

## Important architecture

- Netlify hosts the browser and API functions.
- PostgreSQL stores metadata, plans, generated-code artifacts, jobs, audit logs and usage. Local working copies and synced repositories live on GitHub or the developer's PC.
- The Local Agent runs separately on the developer machine, is restricted to a workspace root, and runs generated project scripts only after user confirmation.
- AI credentials are server-side only.
- GitHub OAuth is the only authentication path in this baseline.
- Netlify Functions are not used as a shell executor.

## Local setup

1. Install Node.js 22 LTS, Git and PostgreSQL.
2. Copy `.env.example` to `.env` and fill values.
3. Create a GitHub OAuth App. Local callback: `http://localhost:8888/api/auth/github/callback`.
4. `npm install`
5. `npm run prisma:generate`
6. `npx prisma migrate dev --name init`
7. `npm run build`
8. `npm run dev:netlify`
9. On your PC, open a second terminal in the DevForge repository folder and run `npm run agent:dev`. Keep the terminal open. If `DEVFORGE_AGENT_TOKEN` is unset, the agent prints a random pairing token in its terminal.
10. In the signed-in project workspace, paste that token into **Local agent pairing token** and select **Connect local agent**. The token is saved in this browser's local storage. Generated files are written under `<DEVFORGE_WORKSPACE>/projects/<project-id>`.
11. Select **Build locally** or **Test locally** to run the generated project's corresponding `package.json` script. The app asks for confirmation first because project install/build/test scripts can execute code on your PC.
12. To bring in an existing local project, connect the Local Agent and choose a folder under its workspace in **Import a folder from this workspace**. Folders directly under the workspace and project folders under its `projects/` directory are listed. Review the confirmation before uploading: import skips dependency/build output directories, environment secret files, and common private-key files; it accepts up to 300 text files and 2 MB. Imported files are stored as a `CODE` artifact in PostgreSQL and can be AI-reviewed or copied to an isolated DevForge workspace folder for local build/test.
13. Use **Local workspace files** to browse and edit text files under the agent workspace. **Save to PC** writes to the selected existing file. Hidden/secret files, dependency folders, symlinks, binary files and files larger than 1 MB are not available in the browser editor; edits are local and are not automatically uploaded into a DevForge project artifact.
14. Generated artifacts stay in your DevForge account until copied to your computer. Select **Sync files to PC** to copy them under `<DEVFORGE_WORKSPACE>/projects/<project-id>` and open that folder in **Local workspace files**. **Build locally** and **Test locally** also sync the files before running project scripts.

## Prisma setup

This starter is pinned to Prisma ORM **7.10.0**. `prisma`, `@prisma/client`, and `@prisma/adapter-pg` are intentionally kept on the same exact version. The generated Prisma Client is not committed; `npm run prisma:generate` creates it under `src/generated/prisma/`.

If you previously installed a broken Prisma package, remove `node_modules` and `package-lock.json`, then run `npm install` before running `npm run prisma:generate`. Do not install Prisma globally.

## Production notes

Use a managed Postgres database (including Netlify Database if available for the site), set production environment variables in Netlify, and never expose secrets through `VITE_*`. The included Local Agent binds to loopback only and uses a random pairing token unless explicitly configured. By default, it accepts browser requests only from localhost development and the production site; set `DEVFORGE_ALLOWED_ORIGINS` to a comma-separated allowlist for other trusted origins. Build and test are currently supported for generated Node.js projects with `build`, `test`, or `test:unit` scripts. Before public release, add a signed native installer, OS credential storage, CSP/security headers, centralized rate limiting, error tracking and automated CI security scans.

## Phases

1. Foundation: React/Vite/Netlify/Prisma/GitHub OAuth.
2. Local Agent: workspace-restricted project import, generated-file sync and Node.js build/test execution.
3. Browser IDE foundation: explorer/editor-oriented shell and project workspace.
4. AI: provider abstraction, OpenRouter/OpenAI adapters and project generation.
5. Autonomous workflow: project runs, artifacts and agent jobs.
6. Production hardening: audit logging, encrypted provider credentials, RBAC-ready membership, sessions and safety boundaries.
7. Advanced foundation: AI usage tracking, GitHub repository metadata, protocol/event model and extensible provider/job architecture.

## API baseline

`GET /api/auth/github` · `GET /api/auth/github/callback` · `POST /api/auth/logout` · `GET /api/auth/me` · `GET/POST /api/projects` · `POST /api/projects/import` · `GET/DELETE /api/projects/:id` · `POST /api/projects/:id/generate` · `POST /api/projects/:id/review` · `GET /api/projects/:id/runs/:runId` · `GET /api/projects/:id/history` · `POST /api/projects/:id/jobs` · `GET /api/agent` · `POST /api/agent/register` · `POST /api/agent/job/claim` · `POST /api/agent/job/result` · `GET /api/ai/providers`.

Deleting a project permanently removes its database record and related artifacts, runs, and jobs. A confirmation prompt is shown in the workspace; copies already synced to a Local Agent workspace are not deleted.

Importing a local project requires an authenticated web session and the paired Local Agent. The agent reads only folders inside `DEVFORGE_WORKSPACE`; symlinks are skipped, and imports are limited to 300 text files/2 MB. Environment files other than `.env.example` and `.env.sample`, common private-key files, and dependency/build output directories are excluded. Review files for credentials before confirming an upload. The imported snapshot is saved as a `CODE` artifact; edits made to a local build/test copy are not automatically synchronized back to PostgreSQL. The browser workspace editor reads and writes existing UTF-8 text files only within the configured workspace, omits common secret and generated paths, and refuses to overwrite a file changed on disk since it was opened.

## Project generation lifecycle

Generation creates a PostgreSQL `ProjectRun` and runs in a Netlify Background Function. A successful run saves requirements, architecture, database design, API design, the implementation plan, and generated files as `Artifact` records in one transaction before marking the project `READY`. Invalid or empty generated file lists fail the run instead of reporting a ready project. `GET /api/projects/:id` returns those saved artifacts so they remain available when the project is opened again or the page is refreshed.

`POST /api/projects/:id/review` queues an OpenRouter review of the saved generated files. Review findings are validated and saved as a `REVIEW` artifact; the run and project transition through `REVIEWING` to `READY` on success or `FAILED` on error. The local build/test workflow connects directly from the browser to the loopback-only Local Agent; generated Node.js project files and command output remain on the developer's PC. GitHub synchronization is not yet implemented end to end.
