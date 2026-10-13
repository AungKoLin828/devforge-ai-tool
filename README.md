# DevForge AI Tool

DevForge AI is an AI-assisted project workspace built around GitHub sign-in, PostgreSQL-backed project artifacts, and a separately run local agent. The web app generates project plans and code and reviews generated code with OpenRouter; the end-to-end local build workflow and GitHub synchronization remain on the roadmap.

## Important architecture

- Netlify hosts the browser and API functions.
- PostgreSQL stores metadata, plans, generated-code artifacts, jobs, audit logs and usage. Local working copies and synced repositories live on GitHub or the developer's PC.
- The Local Agent runs separately on the developer machine and is restricted to a workspace root.
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
9. Run the local agent separately with `npm run agent:dev`.

## Prisma setup

This starter is pinned to Prisma ORM **7.10.0**. `prisma`, `@prisma/client`, and `@prisma/adapter-pg` are intentionally kept on the same exact version. The generated Prisma Client is not committed; `npm run prisma:generate` creates it under `src/generated/prisma/`.

If you previously installed a broken Prisma package, remove `node_modules` and `package-lock.json`, then run `npm install` before running `npm run prisma:generate`. Do not install Prisma globally.

## Production notes

Use a managed Postgres database (including Netlify Database if available for the site), set production environment variables in Netlify, and never expose secrets through `VITE_*`. The included Local Agent binds to loopback only. Before public release, add a signed native installer, OS credential storage, device pairing UX, CSP/security headers, centralized rate limiting, error tracking and automated CI security scans.

## Phases

1. Foundation: React/Vite/Netlify/Prisma/GitHub OAuth.
2. Local Agent: workspace restriction, command policy, local execution.
3. Browser IDE foundation: explorer/editor-oriented shell and project workspace.
4. AI: provider abstraction, OpenRouter/OpenAI adapters and project generation.
5. Autonomous workflow: project runs, artifacts and agent jobs.
6. Production hardening: audit logging, encrypted provider credentials, RBAC-ready membership, sessions and safety boundaries.
7. Advanced foundation: AI usage tracking, GitHub repository metadata, protocol/event model and extensible provider/job architecture.

## API baseline

`GET /api/auth/github` · `GET /api/auth/github/callback` · `POST /api/auth/logout` · `GET /api/auth/me` · `GET/POST /api/projects` · `GET /api/projects/:id` · `POST /api/projects/:id/generate` · `POST /api/projects/:id/review` · `GET /api/projects/:id/runs/:runId` · `GET /api/projects/:id/history` · `POST /api/projects/:id/jobs` · `GET /api/agent` · `POST /api/agent/register` · `POST /api/agent/job/claim` · `POST /api/agent/job/result` · `GET /api/ai/providers`.

## Project generation lifecycle

Generation creates a PostgreSQL `ProjectRun` and runs in a Netlify Background Function. A successful run saves requirements, architecture, database design, API design, the implementation plan, and generated files as `Artifact` records in one transaction before marking the project `READY`. Invalid or empty generated file lists fail the run instead of reporting a ready project. `GET /api/projects/:id` returns those saved artifacts so they remain available when the project is opened again or the page is refreshed.

`POST /api/projects/:id/review` queues an OpenRouter review of the saved generated files. Review findings are validated and saved as a `REVIEW` artifact; the run and project transition through `REVIEWING` to `READY` on success or `FAILED` on error. The signed-out homepage distinguishes available capabilities from roadmap work. A complete web-to-local-agent build/test experience and GitHub synchronization are not yet implemented end to end.
