# Codevia AI — Web & VS Code Feature Scope

**Document type:** Product feature scope and technical architecture  
**Platform:** React Web Application + VS Code Extension  
**Shared stack:** Netlify Functions + Supabase PostgreSQL/pgvector + OpenRouter  
**Architecture principle:** One AI platform, two clients, one shared AI Engine and one shared RAG Engine.

---

## 1. Product Overview

Codevia AI consists of two applications that share the same backend intelligence:

1. **Codevia AI Web Application** — the main platform for AI-assisted development, project management, knowledge management, RAG configuration and monitoring.
2. **Codevia AI VS Code Extension** — an IDE-integrated coding assistant that works with the developer's active file and workspace.
3. **Shared backend services** — authentication, project services, AI Engine, RAG Engine, indexing, retrieval, provider routing and usage monitoring.

The web application and VS Code extension should both provide core AI coding capabilities. The extension is not limited to being a client of a web-only AI feature set.

## 2. Web Application Functions

### 2.1 Authentication and Account Management

| # | Function | Description |
|---:|---|---|
| 1 | GitHub Login | Sign in using GitHub OAuth |
| 2 | User Profile | View and update account information |
| 3 | Session Management | Validate and manage login sessions |
| 4 | Sign Out | Securely end the current session |
| 5 | Account Settings | Manage personal preferences |

### 2.2 Dashboard and Project Management

| # | Function | Description |
|---:|---|---|
| 1 | Main Dashboard | Overview of projects, AI usage and recent activity |
| 2 | Create Project | Create a new coding project |
| 3 | Project List | Browse projects accessible to the user |
| 4 | Project Details | View project information and status |
| 5 | Project Configuration | Configure language, framework and project settings |
| 6 | Project History | View previous AI activities and project operations |
| 7 | GitHub Integration | Connect and access authorized repositories |
| 8 | Project Synchronization | Synchronize supported project information and source data |

### 2.3 AI Coding Assistant

| # | Function | Description |
|---:|---|---|
| 1 | AI Chat | Ask programming and software engineering questions |
| 2 | Project Generation | Generate project structures and starter files |
| 3 | Code Generation | Generate code from natural-language instructions |
| 4 | Code Review | Review selected code or uploaded files |
| 5 | Workspace/Repository Review | Review multiple files from an authorized project |
| 6 | Code Modification | Propose changes to existing source code |
| 7 | Explain Code | Explain source code, methods and logic |
| 8 | Test Generation | Generate unit and integration tests |
| 9 | Error Fixing | Analyze errors and propose fixes |
| 10 | Code Optimization | Suggest performance and maintainability improvements |
| 11 | Refactoring | Refactor existing code |
| 12 | Technical Guidance | Answer architecture and implementation questions |

### 2.4 AI Provider and Model Management

| # | Function | Description |
|---:|---|---|
| 1 | OpenRouter Integration | Connect to OpenRouter through secure backend configuration |
| 2 | Provider Configuration | Configure supported AI providers |
| 3 | Model Selection | Select from available configured models |
| 4 | Model Parameters | Configure supported parameters such as temperature and token limits |
| 5 | Provider/Model Fallback | Try an alternative configured model when appropriate |
| 6 | Embedding Configuration | Configure embedding provider and model |
| 7 | AI Usage Tracking | Monitor request and token usage where provider data is available |
| 8 | Provider Status | Display provider availability and errors |

### 2.5 RAG Knowledge Management

| # | Function | Description |
|---:|---|---|
| 1 | RAG Dashboard | Show indexed sources, files, chunks, jobs and usage |
| 2 | URL Importer | Import permitted documentation pages from URLs |
| 3 | GitHub Repository Importer | Import authorized repositories |
| 4 | File Importer | Upload supported ZIP, Markdown, PDF and source files |
| 5 | Folder Importer | Import local folders through an explicit upload/sync workflow |
| 6 | Manual Knowledge | Add reviewed questions, answers and technical notes |
| 7 | Knowledge Categories | Organize knowledge by technology or topic |
| 8 | Source Management | View, update and delete knowledge sources |
| 9 | Content Preview | Preview extracted content before indexing |
| 10 | Index Management | Start, monitor and retry indexing jobs |
| 11 | Incremental Indexing | Process changed content instead of re-indexing everything |
| 12 | Duplicate Detection | Avoid duplicate sources and unchanged chunks |
| 13 | Embedding Management | Manage embedding model configuration and index compatibility |
| 14 | RAG Search Explorer | Test vector, keyword and hybrid retrieval |
| 15 | RAG Playground | Ask questions against selected knowledge scopes |
| 16 | Source Citations | Return source URLs, file paths and relevant references |
| 17 | Knowledge Synchronization | Synchronize only with explicit user opt-in |
| 18 | Knowledge Deletion | Remove a source and its associated indexed content |

### 2.6 RAG Scope and Security

| # | Function | Description |
|---:|---|---|
| 1 | Public Knowledge | Approved shared technical documentation |
| 2 | Personal Knowledge | A user's private uploaded knowledge |
| 3 | Project Knowledge | Knowledge scoped to a particular project |
| 4 | Workspace Knowledge | Knowledge originating from a VS Code workspace |
| 5 | Access Control | Enforce user and project authorization before retrieval |
| 6 | Exclusion Rules | Exclude secrets, dependencies, build outputs and generated files |
| 7 | Sync Consent | Require explicit consent before uploading workspace content |
| 8 | Source Permissions | Restrict access to imported sources |

### 2.7 Administration and Monitoring

| # | Function | Description |
|---:|---|---|
| 1 | Usage Dashboard | Monitor AI, indexing and storage usage |
| 2 | Indexing Monitoring | Monitor job progress, retries and failures |
| 3 | API Monitoring | Track backend request health |
| 4 | Error Logs | Review application and provider errors |
| 5 | Storage Monitoring | Monitor database and storage consumption |
| 6 | Rate Limiting | Protect free-tier resources and prevent abuse |
| 7 | System Health | Check backend, database and AI provider status |

## 3. VS Code Extension Functions

### 3.1 Authentication and Connection

| # | Function | Description |
|---:|---|---|
| 1 | GitHub Sign In | Authenticate the user |
| 2 | Sign Out | Disconnect the current account |
| 3 | Hosted Backend Connection | Connect to the Codevia AI hosted backend |
| 4 | Local Backend Connection | Connect to a configured local Codevia backend when available |
| 5 | Connection Status | Show connected, disconnected, busy or error status |
| 6 | Account Information | Display the signed-in account |

### 3.2 AI Chat and Coding

| # | Function | Description |
|---:|---|---|
| 1 | AI Chat Panel | Chat with AI inside VS Code |
| 2 | Chat with Selected Code | Ask questions about selected source code |
| 3 | Explain Code | Explain selected code or the active file |
| 4 | Generate Code | Generate code from instructions |
| 5 | Modify Code | Propose modifications to existing source code |
| 6 | Review Current File | Review the active file |
| 7 | Review Workspace | Review selected or eligible workspace files |
| 8 | Generate Tests | Generate tests for selected code or files |
| 9 | Fix Errors | Analyze diagnostics or supplied errors and propose fixes |
| 10 | Refactor Code | Refactor selected code |
| 11 | Optimize Code | Suggest performance improvements |
| 12 | Project Generation | Generate project files and structures |

### 3.3 Code Change Workflow

| # | Function | Description |
|---:|---|---|
| 1 | Instruction Input | Enter natural-language coding instructions |
| 2 | Diff Preview | Preview proposed file changes |
| 3 | Approve Changes | Apply accepted changes |
| 4 | Reject Changes | Discard proposed changes |
| 5 | File-by-file Review | Inspect proposed changes individually |
| 6 | Multi-file Modification | Propose changes across multiple files |
| 7 | Error Feedback | Send errors back for another analysis/fix attempt |
| 8 | Regenerate Code | Request an alternative solution |

AI-generated changes should not silently overwrite source files. Use preview and explicit approval, with appropriate backups or undo support where practical.

### 3.4 Workspace Intelligence and RAG

| # | Function | Description |
|---:|---|---|
| 1 | Index Current Workspace | Index eligible files in the opened project |
| 2 | Workspace Index Status | Show indexing progress and results |
| 3 | Incremental Indexing | Re-index changed files only |
| 4 | Search Project Knowledge | Search indexed workspace content |
| 5 | Ask Project | Ask questions about the current project |
| 6 | Semantic Code Search | Find conceptually related code |
| 7 | Symbol Search | Find classes, methods, functions and other symbols |
| 8 | Context-aware Chat | Retrieve relevant project context for chat |
| 9 | Context-aware Code Review | Include relevant related files in review context |
| 10 | Context-aware Code Generation | Follow existing project conventions and patterns |
| 11 | Source References | Show file paths, symbols and line ranges |
| 12 | Open Source Location | Navigate to a referenced file and location |
| 13 | Workspace Sync | Upload workspace knowledge only with explicit consent |
| 14 | Retry/Cancel Indexing | Control supported indexing jobs |

### 3.5 Workspace Security

| # | Function | Description |
|---:|---|---|
| 1 | `.gitignore` Support | Respect Git ignore rules |
| 2 | Sensitive File Exclusion | Exclude `.env` files, credentials, private keys and certificates |
| 3 | Dependency Exclusion | Exclude `node_modules`, vendor and similar dependency folders |
| 4 | Build Output Exclusion | Exclude `dist`, `build`, `target` and generated outputs |
| 5 | Custom Exclusion Rules | Allow configurable file and folder exclusions |
| 6 | Upload Consent | Ask before synchronizing source code to the server |
| 7 | Workspace Isolation | Keep workspace knowledge separated by user and project |
| 8 | Index Deletion | Remove synchronized workspace knowledge from the server |

### 3.6 Extension Configuration

| # | Function | Description |
|---:|---|---|
| 1 | Backend URL | Configure hosted or local backend |
| 2 | Model Selection | Select an available model through backend-managed configuration |
| 3 | Provider Settings | Use secure backend-managed provider settings |
| 4 | RAG Settings | Enable or disable RAG context |
| 5 | Indexing Settings | Configure indexing scope and exclusions |
| 6 | Chat Settings | Configure chat behavior |
| 7 | Workspace Settings | Configure workspace-specific preferences |

## 4. Web and VS Code Feature Comparison

| Capability | Web Application | VS Code Extension |
|---|:---:|:---:|
| GitHub authentication | Yes | Yes |
| AI Chat | Yes | Yes |
| Project Generation | Yes | Yes |
| Code Generation | Yes | Yes |
| Code Review | Yes | Yes |
| Workspace/Repository Review | Yes | Yes |
| Code Modification | Yes | Yes |
| Explain Code | Yes | Yes |
| Test Generation | Yes | Yes |
| Error Fixing | Yes | Yes |
| Refactoring | Yes | Yes |
| AI Engine | Shared backend | Shared backend |
| OpenRouter integration | Shared backend | Shared backend |
| Model selection | Yes | Yes, through backend |
| Prompt management | Shared backend | Shared backend |
| Model fallback | Shared backend | Shared backend |
| Project management | Full interface | Workspace-focused |
| GitHub integration | Full interface | Connected workflow |
| URL knowledge importer | Yes | Not required initially |
| GitHub knowledge importer | Yes | Not required initially |
| File/ZIP knowledge importer | Yes | Workspace indexing |
| Manual knowledge manager | Yes | Not required initially |
| RAG dashboard | Yes | Progress/status view |
| RAG search explorer | Yes | Project search |
| RAG Playground | Yes | Ask Project |
| Workspace indexing | Yes | Yes |
| Incremental indexing | Yes | Yes |
| Source references | Yes | Yes |
| Index job monitoring | Full interface | Progress view |
| Knowledge synchronization | Yes | Yes, with consent |
| Security exclusions | Yes | Yes |
| Usage monitoring | Full interface | Basic status |

## 5. Recommended Web Application Navigation

```text
CODEVIA AI
│
├── Workspace
│   ├── Dashboard
│   ├── Projects
│   └── GitHub Repositories
│
├── AI Development
│   ├── AI Chat
│   ├── Project Generator
│   ├── Code Generation
│   ├── Code Review
│   ├── Code Modification
│   ├── Code Explanation
│   ├── Test Generation
│   └── Error Fixing
│
├── Knowledge & RAG
│   ├── Knowledge Dashboard
│   ├── Documentation URLs
│   ├── GitHub Sources
│   ├── File Imports
│   ├── Knowledge Manager
│   ├── Search Explorer
│   └── RAG Playground
│
├── Configuration
│   ├── AI Providers & Models
│   ├── Embedding Configuration
│   ├── Synchronization
│   └── Security & Exclusions
│
└── Monitoring
    ├── AI Usage
    ├── Indexing Jobs
    ├── System Health
    └── Activity Logs
```

For VS Code, use a Codevia AI Activity Bar view with Chat, Project and Knowledge/Indexing views. Provide common actions through the chat interface, editor context menus and command palette.

## 6. Shared Backend and AI Engine

The AI Engine is a **shared backend service**, not a web-only feature. Both the web application and VS Code extension call the same AI APIs.

### 6.1 Shared AI Engine Responsibilities

- OpenRouter integration and provider abstraction.
- Model discovery/configuration and model selection.
- Task-based model routing.
- Prompt templates and prompt versioning.
- Provider/model fallback and retry handling.
- Request validation and response normalization.
- Token and usage tracking where available.
- Timeouts, error handling and rate limiting.
- RAG context integration.
- Secure handling of provider credentials.

The clients may prepare different context (for example, browser-uploaded files versus VS Code workspace files), but actual provider calls and shared AI business logic should run on the backend.

### 6.2 Shared RAG Engine Responsibilities

- URL, GitHub, file and workspace ingestion.
- HTML, Markdown, document and source-code extraction.
- Tree-sitter parsing for supported programming languages.
- Semantic chunking with file, symbol and line metadata.
- Configurable embedding provider/model.
- Incremental indexing using content hashes.
- PostgreSQL full-text search and pgvector similarity search.
- Hybrid retrieval with Reciprocal Rank Fusion (RRF).
- Optional reranking.
- Source citations and reference construction.
- User/project authorization before retrieval.
- Source deletion and associated chunk/embedding cleanup.

## 7. Shared API Contract

Both applications should call the same authenticated backend APIs.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/chat` | AI conversation |
| POST | `/api/code/generate` | Generate code |
| POST | `/api/code/review` | Review code |
| POST | `/api/code/explain` | Explain code |
| POST | `/api/code/modify` | Propose code modifications |
| POST | `/api/code/tests` | Generate tests |
| POST | `/api/code/fix` | Analyze and fix errors |
| POST | `/api/code/refactor` | Refactor code |
| POST | `/api/projects/generate` | Generate project structures |
| POST | `/api/rag/sources` | Register a knowledge source |
| POST | `/api/rag/index` | Start an indexing job |
| GET | `/api/rag/index/:jobId` | Get indexing job status |
| GET | `/api/rag/projects/:id/stats` | Get RAG project statistics |
| POST | `/api/rag/search` | Search indexed knowledge |
| POST | `/api/rag/chat` | Ask a question using retrieved context |
| POST | `/api/rag/sync` | Start an explicitly authorized sync |
| DELETE | `/api/rag/sources/:id` | Delete a source and indexed content |

Endpoints are a proposed contract and should be reconciled with existing routes before implementation.

## 8. Recommended Development Releases

### Release 1 — Core AI Coding

- Authentication and backend connection.
- Shared AI Engine and OpenRouter integration.
- Model configuration and fallback.
- AI Chat, project generation and code generation.
- Code review and code modification.
- Code explanation, test generation and error fixing.
- GitHub integration.
- Preserve existing web and extension functionality.

### Release 2 — RAG Intelligence

- Supabase pgvector setup.
- URL, GitHub and file importers.
- Tree-sitter parsing and semantic chunking.
- Configurable embeddings.
- Incremental indexing and background jobs.
- Hybrid retrieval with RRF.
- Workspace indexing.
- Context-aware AI features and source citations.
- RAG dashboard and playground.

### Release 3 — Advanced Platform

- Advanced code intelligence.
- Multi-file refactoring and validation workflows.
- Automated test execution integrations where supported.
- Background synchronization.
- Advanced monitoring and analytics.
- Multi-user knowledge management.
- Advanced access control and quotas.

## 9. Target Project Structure

The following is the recommended target architecture. It is a logical structure for organizing the application; it does not require an immediate full monorepo migration. Existing web and extension projects can remain separate initially, with shared modules extracted gradually.

```text
codevia-ai/
│
├── apps/
│   ├── web/                              # React web application
│   │   ├── public/
│   │   │   ├── icons/
│   │   │   └── assets/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── App.tsx
│   │   │   │   ├── router.tsx
│   │   │   │   └── providers/
│   │   │   ├── components/
│   │   │   │   ├── common/
│   │   │   │   ├── layout/
│   │   │   │   ├── chat/
│   │   │   │   ├── editor/
│   │   │   │   └── rag/
│   │   │   ├── features/
│   │   │   │   ├── authentication/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── ai-chat/
│   │   │   │   ├── code-generation/
│   │   │   │   ├── code-review/
│   │   │   │   ├── code-modification/
│   │   │   │   ├── code-explanation/
│   │   │   │   ├── test-generation/
│   │   │   │   ├── error-fixing/
│   │   │   │   ├── project-management/
│   │   │   │   ├── knowledge-base/
│   │   │   │   ├── rag-dashboard/
│   │   │   │   └── settings/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   │   └── ai-client.ts          # Calls shared backend APIs
│   │   │   ├── stores/
│   │   │   ├── types/
│   │   │   └── utils/
│   │   ├── index.html
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   └── vscode-extension/                 # VS Code extension
│       ├── src/
│       │   ├── extension.ts
│       │   ├── commands/
│       │   ├── providers/
│       │   ├── panels/
│       │   ├── services/
│       │   │   ├── ai-client.ts          # Calls the same backend AI APIs
│       │   │   └── workspace-context.ts
│       │   ├── chat/
│       │   ├── rag/
│       │   ├── workspace/
│       │   ├── indexing/
│       │   ├── authentication/
│       │   ├── configuration/
│       │   ├── security/
│       │   └── types/
│       ├── resources/
│       ├── media/
│       ├── package.json
│       └── tsconfig.json
│
├── netlify/
│   └── functions/
│       └── api/
│           ├── auth/
│           ├── projects/
│           ├── chat/
│           ├── code/
│           ├── providers/
│           ├── github/
│           ├── rag/
│           │   ├── sources.ts
│           │   ├── index.ts
│           │   ├── jobs.ts
│           │   ├── search.ts
│           │   ├── chat.ts
│           │   ├── sync.ts
│           │   └── stats.ts
│           └── health.ts
│
├── packages/
│   ├── shared/                            # Shared types and API contracts
│   │   ├── types/
│   │   ├── schemas/
│   │   ├── constants/
│   │   └── api-contracts/
│   │
│   ├── ai-engine/                         # Shared server-side AI Engine
│   │   ├── providers/
│   │   │   └── openrouter/
│   │   ├── models/
│   │   ├── prompts/
│   │   ├── routing/
│   │   ├── fallback/
│   │   ├── tasks/
│   │   └── response/
│   │
│   └── rag-engine/                        # Shared server-side RAG Engine
│       ├── ingestion/
│       │   ├── url-importer/
│       │   ├── github-importer/
│       │   ├── file-importer/
│       │   └── document-extractor/
│       ├── parsing/
│       │   ├── tree-sitter/
│       │   ├── html/
│       │   └── markdown/
│       ├── chunking/
│       ├── embeddings/
│       ├── retrieval/
│       │   ├── vector-search/
│       │   ├── keyword-search/
│       │   ├── hybrid-search/
│       │   └── rrf/
│       ├── indexing/
│       ├── synchronization/
│       ├── security/
│       └── citations/
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── database/
│   ├── extensions/
│   │   └── vector.sql
│   ├── migrations/
│   ├── indexes/
│   ├── functions/
│   └── seed/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── rag/
│   ├── api/
│   └── security/
│
├── scripts/
│   ├── db-check.ts
│   ├── rag-reindex.ts
│   └── validate-env.ts
│
├── docs/
│   ├── architecture/
│   ├── api/
│   ├── rag/
│   ├── database/
│   └── deployment/
│
├── .env.example
├── .gitignore
├── netlify.toml
├── package.json
├── tsconfig.json
└── README.md
```

### 9.1 Important Architecture Rules

1. **One shared AI Engine:** The AI Engine is a backend package used by both Web and VS Code. It is not a web-only feature and should not be duplicated inside the extension.
2. **Two client adapters:** The web `ai-client.ts` and extension `ai-client.ts` call the same backend APIs. They prepare client-specific context and present results in their respective interfaces.
3. **One shared RAG Engine:** Both clients retrieve from the same authorized RAG services and knowledge store.
4. **No provider secrets in clients:** OpenRouter and embedding provider credentials remain server-side.
5. **Authorization before retrieval:** Every project/workspace search must validate the requesting user's access.
6. **Explicit workspace consent:** Do not upload workspace files or synchronize them without clear user approval.
7. **Preserve current deployments:** Do not move or rename all existing source files at once. Extract shared packages incrementally and keep current Netlify build/deployment behavior working.
8. **Background indexing:** Use bounded jobs and persisted progress rather than long-running HTTP requests.
9. **Embedding compatibility:** Keep dimensions/model configuration consistent within each searchable vector index; re-embed when changing incompatible embedding models.
10. **Graceful fallback:** If RAG is unavailable, existing AI features should still work without retrieved context where possible.

## 10. Security, Quality and Acceptance Criteria

### Security

- Authenticate every protected API request.
- Enforce user and project ownership on every read/write/search operation.
- Keep service-role and provider API keys on the server only.
- Respect `.gitignore` and additional sensitive-file exclusions.
- Exclude `.env*`, credentials, private keys, certificates, dependency folders, build outputs and generated artifacts by default.
- Treat retrieved code and documentation as untrusted input, not as system instructions.
- Require explicit consent for workspace synchronization.
- Delete chunks and embeddings when their source is deleted.
- Apply request limits, indexing quotas and bounded concurrency.

### Quality and Acceptance Tests

- Existing web and extension AI features continue working after shared-engine integration.
- Both clients use the same backend AI task services and provider configuration.
- Indexing the same unchanged source twice does not create duplicate chunks.
- A one-line file change triggers only the necessary incremental update.
- Deleted files and sources are removed from the index.
- Exact-symbol searches and semantic searches return useful results.
- Hybrid search combines keyword and vector results using RRF.
- Users cannot retrieve another user's private project or workspace content.
- No workspace content is uploaded before explicit consent.
- Failed jobs can be retried safely without duplicating indexed data.
- Provider failures and RAG failures are handled gracefully.
- Generated code changes are previewed and require user approval before application.

---

## 11. Final Product Direction

**Codevia AI = One AI Platform, Two Applications.**

- **Web:** Complete AI development platform, project management, knowledge ingestion and RAG administration.
- **VS Code:** IDE-integrated AI coding assistant, workspace intelligence and contextual coding workflows.
- **Shared AI Engine:** One server-side implementation for both clients, including OpenRouter integration, model routing, prompts, fallback and response processing.
- **Shared RAG Engine:** One implementation for ingestion, Tree-sitter parsing, embeddings, hybrid retrieval and citations.
- **Shared data layer:** Supabase PostgreSQL and pgvector with strict user/project isolation.

The target is a reliable, modular AI coding platform that can begin on the existing free-tier stack and scale by replacing or upgrading individual components when actual usage requires it.
