
# Admin RAG Configuration and AI Quality Improvements

**Document type:** Functional requirements and technical architecture  
**Product:** Codevia AI  
**Module:** Administration, RAG Configuration and AI Quality Management  
**Clients:** React Web Application and VS Code Extension  
**Backend:** Netlify Functions  
**Database:** Supabase PostgreSQL + pgvector  
**AI Provider:** OpenRouter and configurable embedding providers  
**Code Parser:** Tree-sitter  
**Architecture:** Shared AI Engine + Shared RAG Engine

---

# 1. Module Overview

## 1.1 Purpose

Codevia AI must provide a centralized Admin RAG Configuration module to control how the platform collects, indexes, retrieves, evaluates and uses knowledge when generating AI responses.

The module should allow administrators to improve AI response quality without changing application source code or redeploying the application for ordinary configuration updates.

The main objectives are:

1. Improve AI answer relevance using project and documentation knowledge.
2. Improve code generation using existing project conventions and patterns.
3. Improve code review using related source code and technical documentation.
4. Improve code explanation using relevant project context.
5. Improve error fixing using existing implementation patterns and documentation.
6. Improve test generation using project architecture and existing tests.
7. Reduce irrelevant context sent to AI models.
8. Control embedding and retrieval costs.
9. Measure whether RAG actually improves AI response quality.
10. Provide consistent RAG behavior across Web and VS Code Extension.

## 1.2 Architecture Principles

- One centralized Admin RAG Configuration.
- One shared backend AI Engine.
- One shared backend RAG Engine.
- Two independent clients: Web and VS Code Extension.
- One shared Supabase knowledge database.
- Configurable embedding providers and models.
- Configurable retrieval and context strategies.
- Background and incremental indexing.
- Hybrid vector and keyword search.
- Optional reranking.
- Source citations and traceability.
- Strict user, project and organization authorization.
- Explicit workspace synchronization consent.
- Graceful fallback when RAG is unavailable.

**Important:** Admin configuration must control the shared backend services. It must not implement separate RAG configurations or duplicate AI business logic inside the Web application and VS Code extension.

---

# 2. Admin Module Structure

Create a dedicated Administration section in the Web application.

## 2.1 Recommended Navigation

```text
ADMINISTRATION
│
├── Overview
│   ├── System Overview
│   ├── AI Usage Summary
│   ├── RAG Statistics
│   └── System Health
│
├── AI Configuration
│   ├── AI Providers
│   ├── Model Management
│   ├── Model Routing
│   ├── Fallback Configuration
│   └── AI Task Configuration
│
├── RAG Configuration
│   ├── General Settings
│   ├── Embedding Configuration
│   ├── Retrieval Configuration
│   ├── Ranking Configuration
│   ├── Context Configuration
│   └── Prompt Templates
│
├── Knowledge Management
│   ├── Knowledge Sources
│   ├── Knowledge Categories
│   ├── Source Permissions
│   ├── Indexing Management
│   └── Synchronization Settings
│
├── AI Quality
│   ├── RAG Playground
│   ├── Search Explorer
│   ├── Evaluation Datasets
│   ├── Evaluation Results
│   ├── AI Feedback
│   └── Quality Analytics
│
├── Security
│   ├── Access Control
│   ├── Workspace Exclusions
│   ├── Source Permissions
│   ├── Usage Limits
│   └── Audit Logs
│
└── Monitoring
    ├── API Monitoring
    ├── Indexing Jobs
    ├── Provider Status
    ├── Database Usage
    ├── Error Logs
    └── Performance Metrics
```

## 2.2 Administrator Roles

Support role-based access control.

| Role | Permissions |
|---|---|
| Super Admin | Full platform and configuration management |
| Admin | Manage approved AI/RAG configuration |
| Knowledge Manager | Manage knowledge sources and indexing |
| Developer | Use AI and authorized project knowledge |
| User | Use permitted AI and knowledge features |

Recommended permission separation:

- Only Super Admin and authorized Admin users can modify global AI/RAG settings.
- Knowledge Managers can manage permitted knowledge sources.
- Developers can manage their own authorized project/workspace knowledge.
- Normal users cannot modify provider credentials or global security policies.
- All administrative configuration changes must be audited.

---

# 3. General RAG Configuration

## 3.1 General Settings

Administrators can enable or disable RAG globally and control the default retrieval behavior.

| Setting | Recommended Default | Description |
|---|---|---|
| Enable RAG | true | Enable RAG functionality |
| Default Retrieval Strategy | hybrid | Vector + keyword search |
| Enable Global Knowledge | true | Retrieve approved shared documentation |
| Enable Personal Knowledge | true | Retrieve authorized personal knowledge |
| Enable Project Knowledge | true | Retrieve project-specific knowledge |
| Enable Workspace Knowledge | true | Retrieve indexed workspace knowledge |
| Enable Citations | true | Include source references |
| Enable RAG Logging | true | Record retrieval diagnostics |
| Enable Retrieval Cache | Optional | Cache eligible retrieval results |
| Fallback Without RAG | true | Continue existing AI workflow when retrieval fails |
| Enable RAG Evaluation | true | Collect evaluation and quality metrics |

These are recommended starting values, not universal optimal values. Administrators should be able to change them after testing.

## 3.2 Knowledge Scope

Support the following knowledge scopes:

| Scope | Description | Access |
|---|---|---|
| Global | Approved shared technical documentation | Authorized platform users |
| Organization | Organization-specific knowledge | Organization members |
| Personal | User-owned knowledge | Owner only |
| Project | Project-specific knowledge | Authorized project members |
| Workspace | Knowledge from a connected workspace | Authorized workspace owner/project members |

Organization scope can be introduced when multi-organization management is implemented.

## 3.3 Configuration Hierarchy

Use a controlled configuration hierarchy.

Recommended precedence:

1. System defaults.
2. Administrator global configuration.
3. Organization configuration, if enabled.
4. Project-specific overrides.
5. User preferences, where permitted.
6. Request-specific context.

### Configuration Restrictions

Some settings must remain administrator-controlled.

| Configuration | User Override |
|---|---|
| Global RAG enablement | No |
| Provider API credentials | No |
| Security and access policies | No |
| Maximum context token limit | No |
| Maximum indexing limits | No |
| Allowed embedding models | No |
| Project retrieval preferences | Optional |
| Personal knowledge selection | Yes |
| Chat context preferences | Yes |
| Preferred AI model | Only from allowed models |

The backend must validate the effective configuration for every request.

---

# 4. Embedding Configuration

## 4.1 Purpose

Embedding configuration controls how documents, code chunks and user queries are converted into vectors for semantic retrieval.

Embedding models must be independently configurable from AI chat models.

## 4.2 Configuration Settings

| Setting | Description |
|---|---|
| Embedding Provider | Provider used for embedding generation |
| Embedding Model | Selected embedding model |
| Embedding Dimensions | Expected vector dimensions |
| Batch Size | Number of chunks per request |
| Request Timeout | Maximum embedding request duration |
| Retry Count | Number of retries after failures |
| Retry Delay | Delay between retry attempts |
| Rate Limit | Provider request limits |
| Enable Embedding Cache | Reuse valid embeddings when content and model match |
| Enable Query Embedding | Generate embeddings for retrieval queries |
| Re-index Policy | Define behavior after incompatible model changes |
| Model Status | Available, disabled or error |

## 4.3 Supported Provider Architecture

Implement an embedding provider abstraction.

```text
Embedding Engine
│
├── Provider Interface
│   ├── generateEmbedding()
│   ├── generateBatchEmbeddings()
│   ├── getDimensions()
│   └── validateModel()
│
├── OpenAI Embedding Provider
│
├── OpenRouter-Compatible Provider
│
└── Future Providers
```

Only integrate providers that expose the required embedding capabilities. Do not assume every chat provider or OpenRouter model supports embeddings.

## 4.4 Embedding Compatibility

This is a critical requirement.

- Every vector index must have a defined embedding model and dimension.
- Query embeddings must be compatible with the indexed document embeddings.
- Incompatible dimensions must never be mixed in the same vector index.
- Store embedding provider, model and version metadata.
- Validate model compatibility before accepting configuration changes.
- Require controlled re-embedding when a model change invalidates existing vectors.
- Support re-indexing progress and failure recovery.

### Model Change Workflow

1. Administrator selects a new embedding model.
2. Backend validates provider availability.
3. Backend validates vector dimensions.
4. System checks existing index compatibility.
5. System estimates re-embedding work.
6. Administrator confirms the change if re-indexing is required.
7. New indexing jobs are created.
8. Existing usable indexes remain available during migration where the architecture supports versioned indexes.
9. The system validates the new index.
10. The active index is switched only after successful validation.

Never silently replace a working embedding configuration with an incompatible model.

---

# 5. Retrieval Configuration

## 5.1 Retrieval Strategy

Support three retrieval strategies.

| Strategy | Description |
|---|---|
| Vector Search | Semantic similarity using embeddings |
| Keyword Search | PostgreSQL full-text search |
| Hybrid Search | Combines vector and keyword results |

Recommended default: Hybrid Search.

## 5.2 Retrieval Settings

| Setting | Recommended Default | Description |
|---|---:|---|
| Retrieval Strategy | hybrid | Retrieval method |
| Vector Search | Enabled | Semantic retrieval |
| Keyword Search | Enabled | Keyword/full-text retrieval |
| Top K | 8 | Initial number of candidates per retrieval strategy |
| Minimum Similarity | 0.65 | Optional vector relevance threshold |
| Maximum Context Chunks | 8 | Maximum chunks included in final context |
| Maximum Context Tokens | 8,000 | Context budget |
| Enable Metadata Filtering | true | Filter by scope, project and source |
| Enable RRF | true | Combine vector and keyword rankings |
| Enable Reranking | Optional | Reorder retrieved candidates |
| Search Timeout | Configurable | Limit retrieval execution time |

The Top K candidate count and final context chunk limit are different settings.

For example:

- Vector search retrieves 20 candidates.
- Keyword search retrieves 20 candidates.
- RRF combines the results.
- Reranking optionally reorders the combined candidates.
- The context builder selects the best 8 chunks within the token budget.

This allows better candidate discovery without sending every result to the AI model.

## 5.3 Hybrid Search Workflow

```text
User Query
    |
    v
Query Processing
    |
    +----------------------+
    |                      |
    v                      v
Query Embedding       Keyword Search
    |                      |
    v                      v
Vector Search         Full-Text Search
    |                      |
    +----------+-----------+
               |
               v
          RRF Fusion
               |
               v
      Authorization and
       Metadata Filtering
               |
               v
       Optional Reranking
               |
               v
       Relevance Filtering
               |
               v
        Context Builder
               |
               v
       AI Engine Context
```

## 5.4 Reciprocal Rank Fusion

Use Reciprocal Rank Fusion to combine vector and keyword search rankings.

A configurable RRF parameter can be provided.

Recommended starting value:

```text
RRF_K = 60
```

The exact ranking implementation should be evaluated using the RAG evaluation dataset.

Do not treat raw vector similarity and keyword search scores as directly comparable without an appropriate normalization or ranking strategy.

## 5.5 Metadata Filtering

Support filters for:

- User ID
- Organization ID
- Project ID
- Workspace ID
- Knowledge scope
- Source ID
- Source type
- Programming language
- File extension
- File path
- Symbol name
- Document category
- Index version

Authorization filtering must happen before any retrieved content is exposed to the AI Engine.

---

# 6. Ranking and Reranking Configuration

## 6.1 Purpose

Ranking determines which retrieved chunks are most relevant to a user query.

Reranking is optional and should be configurable because it can introduce additional cost and latency.

## 6.2 Settings

| Setting | Description |
|---|---|
| Enable RRF | Combine retrieval rankings |
| RRF Parameter | Configure RRF ranking behavior |
| Enable Reranking | Enable a second-stage ranking process |
| Reranking Provider | Select supported reranking provider |
| Reranking Model | Select configured reranking model |
| Candidate Limit | Maximum candidates submitted for reranking |
| Final Result Limit | Maximum results returned |
| Reranking Timeout | Maximum processing time |
| Reranking Fallback | Continue without reranking when unavailable |

## 6.3 Requirements

- Reranking must be optional.
- Reranking failure must not necessarily fail the entire AI request.
- Limit candidates to control cost.
- Record reranking latency and outcomes.
- Compare quality with and without reranking.
- Do not introduce a reranking provider unless its API is actually supported.

---

# 7. AI Context Configuration

## 7.1 Purpose

The Context Builder combines the user's question, editor/workspace information and authorized RAG results before sending the final request to the AI model.

## 7.2 Context Settings

| Setting | Description |
|---|---|
| Context Template | Format of supplied context |
| Maximum Context Tokens | Maximum RAG context token budget |
| Maximum Context Chunks | Maximum number of included chunks |
| Include Source Metadata | Include source details |
| Include File Path | Include source file path |
| Include Line Numbers | Include source line references |
| Include Code Symbols | Include classes, methods and functions |
| Include Content Hash | Optional traceability metadata |
| Enable Citations | Include source references |
| Require Citations | Require citations for claims based on retrieved knowledge |
| Context Deduplication | Remove duplicate or overlapping chunks |
| Context Priority | Configure context source precedence |
| No-Result Behavior | Define behavior when useful results are unavailable |

## 7.3 Context Priority

Recommended default:

1. Current user request.
2. Selected code and active editor context.
3. Relevant current workspace context.
4. Project-specific RAG knowledge.
5. Personal knowledge selected by the user.
6. Authorized shared documentation.
7. General model knowledge.

The priority must be configurable within administrator-defined security and token limits.

## 7.4 Context Construction

```text
AI Request
   |
   v
User Question
   |
   v
Client Context
   |
   +-- Selected Code
   +-- Active File
   +-- Workspace Information
   |
   v
RAG Retrieval
   |
   +-- Project Knowledge
   +-- Personal Knowledge
   +-- Shared Documentation
   |
   v
Context Validation
   |
   v
Deduplication and Token Budget
   |
   v
Context Template
   |
   v
Final AI Prompt
```

## 7.5 Prompt Injection Protection

Retrieved code, documents and URLs are untrusted data.

Requirements:

- Never treat retrieved text as system instructions.
- Clearly separate system instructions, user requests and retrieved content.
- Do not allow indexed documents to override security policies.
- Do not allow retrieved content to request unauthorized tool actions.
- Apply appropriate prompt-injection defenses.
- Preserve source metadata for auditing.

---

# 8. Prompt Template Management

Administrators should be able to manage prompts for different AI operations.

## 8.1 Supported Prompt Categories

| Category | Purpose |
|---|---|
| General AI Chat | General programming assistance |
| RAG System Instructions | Instructions for using retrieved knowledge |
| Code Generation | Generate code |
| Code Review | Analyze code quality and defects |
| Code Explanation | Explain source code |
| Code Modification | Propose code changes |
| Test Generation | Generate tests |
| Error Fixing | Analyze and fix errors |
| Refactoring | Improve code structure |
| Project Generation | Generate project structures |
| Context Builder | Format retrieved knowledge |

## 8.2 Prompt Management Features

- Create prompt template.
- Edit prompt template.
- Preview prompt.
- Version prompt.
- Activate/deactivate prompt.
- Roll back to an earlier version.
- Test prompt against evaluation questions.
- Associate prompt templates with AI tasks.
- Record prompt version used for each request.

## 8.3 Prompt Safety

- Do not expose provider secrets.
- Do not permit ordinary users to change protected system instructions.
- Validate template variables.
- Prevent missing required variables.
- Keep prompt version history.
- Test important prompt changes before global activation.

---

# 9. Knowledge Source and Indexing Configuration

## 9.1 Supported Sources

| Source | Description |
|---|---|
| Documentation URL | Import permitted documentation |
| GitHub Repository | Import authorized repositories |
| File Upload | PDF, Markdown, TXT and supported source files |
| ZIP Upload | Import supported project archives |
| Workspace Indexing | Index eligible VS Code workspace files |
| Manual Knowledge | Add reviewed technical notes and Q&A |

## 9.2 URL Import Configuration

- Allowed domains.
- Maximum pages per import.
- Maximum crawl depth.
- Sitemap discovery.
- URL include patterns.
- URL exclude patterns.
- Request timeout.
- Content extraction rules.
- Duplicate detection.
- Content change detection.
- Re-index policy.

Respect robots.txt where applicable, website terms and source permissions. Do not bypass authentication or crawl restrictions.

## 9.3 File Import Configuration

- Maximum file size.
- Maximum files per import.
- Supported extensions.
- Supported programming languages.
- ZIP extraction limits.
- Binary file exclusion.
- Duplicate detection.
- Content hashing.
- Extraction error handling.

## 9.4 Code Parsing

Use Tree-sitter for supported source languages.

Extract:

- Language.
- File path.
- Class name.
- Function/method name.
- Symbol type.
- Parent symbol.
- Start line.
- End line.
- Content hash.
- Parser version.

Use language-aware chunking where possible.

For documentation, use structure-aware chunking based on headings, paragraphs, sections and document metadata.

## 9.5 Indexing Configuration

| Setting | Description |
|---|---|
| Batch Size | Chunks processed per batch |
| Maximum Concurrent Jobs | Maximum simultaneous indexing tasks |
| Job Timeout | Maximum job duration |
| Retry Count | Retry failed operations |
| Retry Delay | Delay between attempts |
| Incremental Indexing | Process changed content only |
| Content Hashing | Detect unchanged content |
| Duplicate Detection | Avoid duplicate chunks |
| Scheduled Synchronization | Optional scheduled updates |
| Job Cancellation | Stop supported indexing jobs |

## 9.6 Indexing Workflow

1. Register source.
2. Validate user permissions.
3. Validate source ownership and access.
4. Extract content.
5. Parse documents or source code.
6. Create semantic chunks.
7. Calculate content hashes.
8. Skip unchanged chunks.
9. Generate embeddings.
10. Store chunks and vectors.
11. Update indexing status.
12. Record metrics and errors.

Long-running indexing must use persistent background-job state and bounded processing. Do not depend on a single long-running Netlify HTTP request.

---

# 10. RAG Playground and Search Explorer

## 10.1 RAG Playground

Provide an administrator testing environment to evaluate RAG behavior before changing global settings.

### Features

- Enter test questions.
- Select a project.
- Select knowledge scope.
- Select retrieval strategy.
- Change Top K for testing.
- Change similarity thresholds.
- Enable or disable reranking.
- Preview retrieved chunks.
- Preview ranking results.
- Preview final AI context.
- Execute AI generation.
- View source citations.
- Compare configurations.
- Save test results.

### Example Test

Question:

"How does this project implement JWT authentication?"

Expected results:

- Relevant authentication implementation files.
- Related security configuration.
- JWT utility classes.
- Relevant project documentation.
- Source paths and line ranges.

The playground should show exactly which chunks were selected and why they were included.

## 10.2 Search Explorer

Allow administrators to test retrieval independently of AI generation.

Search modes:

- Vector search.
- Keyword search.
- Hybrid search.

Display:

- Source name.
- Source type.
- File path or URL.
- Symbol name.
- Line range.
- Similarity score, where applicable.
- Keyword rank.
- RRF rank.
- Reranking score, where applicable.
- Content preview.
- Access scope.

This separates retrieval problems from AI model generation problems.

---

# 11. AI Quality Evaluation

## 11.1 Purpose

The platform must measure whether RAG improves AI response quality rather than assuming that more retrieved context produces better results.

Evaluate retrieval and answer generation separately.

## 11.2 Evaluation Categories

### A. Retrieval Quality

| Metric | Description |
|---|---|
| Precision@K | Proportion of retrieved results that are relevant |
| Recall@K | Proportion of relevant expected results retrieved |
| MRR | Ranking quality of the first relevant result |
| NDCG@K | Ranking quality considering relevance and position |
| No-Result Rate | Percentage of queries without useful retrieval |
| Retrieval Latency | Time spent retrieving knowledge |

### B. Answer Quality

| Metric | Description |
|---|---|
| Correctness | Whether the answer is factually and technically correct |
| Relevance | Whether the response answers the user's question |
| Groundedness | Whether knowledge-based claims are supported by context |
| Citation Accuracy | Whether citations point to supporting sources |
| Completeness | Whether important parts of the question are addressed |
| Instruction Following | Whether the model follows the requested task |
| Code Quality | Whether generated code follows expected standards |

### C. Operational Quality

| Metric | Description |
|---|---|
| Total Response Latency | Total time from request to response |
| Retrieval Latency | Retrieval processing time |
| AI Generation Latency | Provider response time |
| Prompt Tokens | Input token usage |
| Completion Tokens | Output token usage |
| Embedding Usage | Embedding requests and usage |
| Error Rate | Failed request percentage |
| Cost Estimate | Usage-based estimated cost where available |

## 11.3 Evaluation Dataset

Allow administrators to create and maintain test datasets.

Each evaluation case should include:

- Question.
- Expected answer or evaluation criteria.
- Expected relevant sources.
- Expected project or knowledge scope.
- Relevant keywords.
- Expected citation references.
- Optional expected code behavior.
- Evaluation category.

Example:

```text
Question:
How does the project validate GitHub OAuth sessions?

Expected Sources:
- auth/session.ts
- auth/github.ts
- Session database model

Expected Scope:
Project knowledge

Evaluation Category:
Code understanding
```

## 11.4 Evaluation Workflow

1. Select evaluation dataset.
2. Select RAG configuration version.
3. Execute retrieval.
4. Generate AI responses.
5. Evaluate retrieval metrics.
6. Evaluate answer quality.
7. Validate citations.
8. Record token usage and latency.
9. Compare against baseline.
10. Generate evaluation report.

## 11.5 Evaluation Methods

Support multiple evaluation methods:

- Exact expected-source comparison.
- Keyword and reference matching.
- Rule-based checks.
- Human administrator review.
- Optional model-assisted evaluation.

Model-assisted evaluation must be treated as an estimate, not absolute proof of correctness.

For important quality comparisons, use human-reviewed reference answers and a consistent evaluation dataset.

## 11.6 Baseline Comparison

Allow administrators to compare:

- AI without RAG.
- Vector search.
- Keyword search.
- Hybrid search.
- Hybrid search with reranking.
- Different embedding configurations.
- Different prompt versions.
- Different context limits.

Show differences in answer quality, retrieval quality, latency and usage.

---

# 12. AI Feedback and Continuous Improvement

## 12.1 User Feedback

Allow users to provide feedback on AI responses.

Supported feedback:

- Helpful.
- Not helpful.
- Incorrect answer.
- Irrelevant context.
- Incorrect citation.
- Incomplete answer.
- Generated code does not work.
- Other.

Optional comments can provide additional context.

## 12.2 Feedback Management

Administrators can:

- View feedback.
- Filter by AI task.
- Filter by project.
- Filter by model.
- Filter by RAG configuration.
- Identify repeated retrieval problems.
- Identify poor prompt behavior.
- Identify source quality problems.
- Add problematic cases to evaluation datasets.

## 12.3 Improvement Workflow

```text
User AI Interaction
        |
        v
    User Feedback
        |
        v
 Feedback Analysis
        |
        v
 Identify Problem
        |
        +--------------------+
        |          |         |
        v          v         v
   Retrieval    Context    Prompt
    Problem     Problem    Problem
        |          |         |
        +----------+---------+
                   |
                   v
            Configuration Test
                   |
                   v
            Evaluation Dataset
                   |
                   v
             Compare Results
                   |
                   v
           Admin Approval
                   |
                   v
          Apply Configuration
```

Do not automatically modify production prompts or retrieval settings based only on user feedback. Require testing and administrator approval for global changes.

---

# 13. AI Task-Specific RAG Configuration

Different AI operations need different context strategies.

A single global Top K value may not be optimal for every task.

Provide configurable task profiles.

| AI Task | Context Strategy | Recommended Behavior |
|---|---|---|
| AI Chat | Balanced | Retrieve relevant project and documentation knowledge |
| Project Generation | Architecture-focused | Retrieve project templates and approved architecture guidance |
| Code Generation | Code-focused | Retrieve similar implementations and conventions |
| Code Review | Dependency-aware | Retrieve related files, interfaces and tests |
| Workspace Review | Bounded workspace context | Retrieve relevant files without loading the entire project |
| Code Modification | Implementation-focused | Retrieve target code and dependent implementations |
| Code Explanation | Symbol-focused | Retrieve related methods, classes and dependencies |
| Test Generation | Test-focused | Retrieve existing tests and project testing conventions |
| Error Fixing | Diagnostic-focused | Retrieve related implementations and error documentation |
| Refactoring | Dependency-aware | Retrieve related symbols and affected code |

## 13.1 Task Profile Settings

Each profile may configure:

- Enable RAG for task.
- Retrieval scope.
- Retrieval strategy.
- Top K candidate limit.
- Final context chunk limit.
- Similarity threshold.
- Context token budget.
- Reranking.
- Citation behavior.
- Context priority.
- Fallback behavior.

All task profiles must respect global security restrictions and token limits.

---

# 14. Security and Access Control

## 14.1 Authentication and Authorization

- Authenticate all protected requests.
- Validate administrator roles on the server.
- Validate user and project permissions before retrieval.
- Enforce source ownership.
- Enforce workspace ownership.
- Enforce organization permissions when enabled.
- Prevent cross-user and cross-project data leakage.

Do not rely on client-side visibility or UI restrictions as the authorization mechanism.

## 14.2 Sensitive File Exclusions

Default exclusions should include:

```text
.env
.env.*
*.pem
*.key
*.p12
*.pfx
*.crt
id_rsa
id_ed25519
node_modules/
vendor/
dist/
build/
target/
coverage/
.next/
.git/
```

Also:

- Respect `.gitignore`.
- Exclude dependency folders.
- Exclude generated files.
- Exclude binary files.
- Support administrator-managed exclusion patterns.
- Support project-specific exclusions.
- Allow workspace owners to review exclusions before indexing.

## 14.3 Workspace Consent

Before uploading workspace files:

1. Explain what content will be uploaded.
2. Show the indexing scope.
3. Show default exclusions.
4. Request explicit user approval.
5. Start indexing only after approval.
6. Provide an option to cancel.
7. Provide an option to delete synchronized workspace knowledge.

Local-only processing should be clearly distinguished from server-side synchronization.

## 14.4 Data Deletion

When a source is deleted:

- Remove its documents.
- Remove its chunks.
- Remove associated vectors.
- Remove related search metadata.
- Update indexing statistics.
- Invalidate relevant caches.
- Preserve necessary audit records without retaining deleted source content unnecessarily.

---

# 15. AI Provider and Model Management

Admin RAG Configuration should integrate with the shared AI Provider and Model Management module.

## 15.1 AI Model Configuration

Support:

- Provider configuration.
- Model availability.
- Default model.
- Task-specific model selection.
- Temperature.
- Maximum completion tokens.
- Request timeout.
- Retry configuration.
- Provider fallback.
- Usage tracking.

## 15.2 Model Routing

Allow administrators to define model profiles for different AI operations.

Example:

| Task | Model Profile |
|---|---|
| General Chat | General-purpose model |
| Code Generation | Code-capable model |
| Code Review | Reasoning-capable model |
| Error Fixing | Code/reasoning model |
| Embeddings | Embedding model |
| Reranking | Reranking model, if supported |

Model names should be configurable and validated against actual provider capabilities.

## 15.3 Fallback Behavior

- Use configured fallback models.
- Retry only when appropriate.
- Respect provider rate limits.
- Avoid uncontrolled repeated retries.
- Record provider errors.
- Record which model generated the response.
- Return a clear error when no fallback is available.

Provider credentials must remain server-side.

---

# 16. Usage, Cost and Performance Management

## 16.1 Usage Dashboard

Display:

- Total AI requests.
- Requests by AI task.
- Requests by user.
- Requests by project.
- Requests by model.
- Prompt tokens.
- Completion tokens.
- Embedding requests.
- Indexing jobs.
- Indexed documents.
- Indexed chunks.
- Storage consumption.
- Provider errors.
- Average response latency.

## 16.2 Resource Controls

Administrators can configure:

- Maximum AI requests per user.
- Maximum indexing jobs per user.
- Maximum concurrent indexing jobs.
- Maximum files per workspace.
- Maximum file size.
- Maximum URL pages.
- Maximum context tokens.
- Maximum retrieval candidates.
- Maximum request duration.
- Provider request rate limits.

These controls are important when using free or limited service tiers.

## 16.3 Performance Improvements

- Incremental indexing.
- Content-hash-based change detection.
- Embedding cache.
- Bounded concurrent jobs.
- Bounded retrieval candidates.
- Context deduplication.
- Configuration caching.
- Database indexes.
- Query timeout controls.
- Retry with exponential backoff.
- Persistent indexing job state.
- Supabase Realtime for suitable job-status updates.
- Avoid unnecessary repeated polling.

Configuration caching must support invalidation when administrators update settings.

---

# 17. Admin Database Design

Use Supabase PostgreSQL.

The following is a logical data model. Reuse existing project, user, source and indexing tables wherever they already exist instead of creating duplicate tables.

## 17.1 Configuration Tables

| Table | Purpose |
|---|---|
| ai_provider_configs | Supported provider configuration |
| ai_model_configs | Available and approved AI models |
| ai_task_profiles | Model and AI task settings |
| rag_settings | Global RAG settings |
| rag_embedding_settings | Embedding configuration |
| rag_retrieval_settings | Retrieval configuration |
| rag_context_settings | Context builder configuration |
| rag_prompt_templates | Prompt templates |
| rag_prompt_versions | Prompt history |
| rag_task_profiles | Task-specific RAG configuration |
| rag_config_versions | Configuration snapshots and rollback |

## 17.2 Knowledge Tables

| Table | Purpose |
|---|---|
| rag_sources | Registered knowledge sources |
| rag_documents | Extracted documents |
| rag_chunks | Indexed content chunks |
| rag_indexing_jobs | Indexing jobs |
| rag_sync_records | Synchronization history |
| rag_source_permissions | Source access permissions |
| rag_embedding_indexes | Embedding model/index metadata |

## 17.3 Quality and Monitoring Tables

| Table | Purpose |
|---|---|
| rag_query_logs | Retrieval diagnostics |
| ai_request_logs | AI request metadata |
| ai_usage_records | Token and usage information |
| rag_evaluation_datasets | Evaluation datasets |
| rag_evaluation_cases | Individual test cases |
| rag_evaluation_runs | Evaluation executions |
| rag_evaluation_results | Evaluation results |
| ai_feedback | User feedback |
| rag_audit_logs | Configuration change history |

## 17.4 Database Requirements

- Use UUID primary keys where appropriate.
- Use foreign keys and appropriate deletion rules.
- Add created_at and updated_at.
- Add indexes for frequent queries.
- Use Row Level Security where appropriate.
- Keep provider secrets outside browser-accessible tables.
- Separate global and scoped configuration.
- Maintain prompt and configuration versions.
- Maintain embedding model and dimension metadata.
- Support source deletion and associated chunk cleanup.
- Store only necessary diagnostic information.
- Apply retention policies to request logs and feedback.

Do not duplicate existing application tables simply to match this proposed design.

---

# 18. Admin Configuration APIs

All endpoints are proposed contracts. Reconcile them with the current Netlify Functions API structure before implementation.

All administrator endpoints must enforce server-side role checks.

## 18.1 General Configuration

```http
GET    /api/admin/rag/settings
PUT    /api/admin/rag/settings
```

## 18.2 Embedding Configuration

```http
GET    /api/admin/rag/embeddings
PUT    /api/admin/rag/embeddings
POST   /api/admin/rag/embeddings/test
POST   /api/admin/rag/embeddings/estimate-reindex
```

## 18.3 Retrieval Configuration

```http
GET    /api/admin/rag/retrieval
PUT    /api/admin/rag/retrieval
```

## 18.4 Context Configuration

```http
GET    /api/admin/rag/context
PUT    /api/admin/rag/context
```

## 18.5 Prompt Management

```http
GET    /api/admin/rag/prompts
POST   /api/admin/rag/prompts
PUT    /api/admin/rag/prompts/:id
GET    /api/admin/rag/prompts/:id/versions
POST   /api/admin/rag/prompts/:id/activate
POST   /api/admin/rag/prompts/:id/rollback
```

## 18.6 Task Profiles

```http
GET    /api/admin/rag/task-profiles
PUT    /api/admin/rag/task-profiles/:task
```

## 18.7 Indexing Management

```http
GET    /api/admin/rag/jobs
GET    /api/admin/rag/jobs/:jobId
POST   /api/admin/rag/jobs/:jobId/retry
POST   /api/admin/rag/jobs/:jobId/cancel
POST   /api/admin/rag/reindex
```

## 18.8 Playground and Evaluation

```http
POST   /api/admin/rag/test-query
POST   /api/admin/rag/test-answer
GET    /api/admin/rag/analytics

GET    /api/admin/rag/evaluations/datasets
POST   /api/admin/rag/evaluations/datasets

POST   /api/admin/rag/evaluations/run
GET    /api/admin/rag/evaluations/runs
GET    /api/admin/rag/evaluations/runs/:runId
```

## 18.9 Feedback and Monitoring

```http
GET    /api/admin/ai/feedback
GET    /api/admin/ai/usage
GET    /api/admin/ai/providers/status
GET    /api/admin/system/health
GET    /api/admin/audit-logs
```

---

# 19. Shared Backend Architecture

Both Web and VS Code Extension must use the same configuration and backend processing.

```text
                  ADMIN WEB DASHBOARD
                           |
                           v
                 ADMIN CONFIGURATION API
                           |
                           v
                    SUPABASE DATABASE
                           |
               +-----------+-----------+
               |                       |
               v                       v
          SHARED AI ENGINE        SHARED RAG ENGINE
               |                       |
               |                 +-----+------+
               |                 |     |      |
               |                 v     v      v
               |               Parse Embed Retrieve
               |                              |
               |                              v
               |                       Hybrid Search
               |                              |
               +------------------------------+
                              |
                              v
                       CONTEXT BUILDER
                              |
                              v
                       AI MODEL PROVIDER
                           OpenRouter
                              |
                    +---------+---------+
                    |                   |
                    v                   v
               WEB CLIENT          VS CODE CLIENT
```

## 19.1 Shared AI Engine Responsibilities

- Provider abstraction.
- OpenRouter integration.
- Model selection and routing.
- Task profiles.
- Prompt management.
- Fallback and retry.
- Request validation.
- Response normalization.
- RAG context integration.
- Token usage tracking.
- Error handling.
- Timeouts.
- Request diagnostics.

## 19.2 Shared RAG Engine Responsibilities

- Source ingestion.
- Document extraction.
- Tree-sitter parsing.
- Semantic chunking.
- Embedding generation.
- Incremental indexing.
- Hybrid retrieval.
- RRF ranking.
- Optional reranking.
- Context construction.
- Citation generation.
- Source permissions.
- Data deletion.

## 19.3 Client Responsibilities

### Web

- Admin configuration interface.
- Knowledge source management.
- RAG Playground.
- Evaluation dashboard.
- Project management.
- AI development interface.

### VS Code

- Active file and selection context.
- Workspace indexing.
- Workspace consent.
- Workspace exclusions.
- Project knowledge search.
- AI chat and coding interface.
- Diff preview and code application.

Neither client should implement a separate AI provider integration or duplicate backend RAG retrieval logic.

---

# 20. Configuration Update and Deployment Workflow

Ordinary configuration changes should not require a new application deployment.

## 20.1 Configuration Update

```text
Administrator Changes Setting
             |
             v
       Configuration API
             |
             v
      Server-side Validation
             |
             v
       Permission Validation
             |
             v
       Save to Supabase
             |
             v
       Write Audit Log
             |
             v
      Invalidate Config Cache
             |
             v
      Shared AI/RAG Engine
             |
             v
       Both Clients Updated
```

## 20.2 Configuration Versioning

Support:

- Current active version.
- Previous versions.
- Administrator who made the change.
- Timestamp.
- Configuration differences.
- Test results.
- Rollback operation.

For high-impact changes, provide a test or preview step before global activation.

## 20.3 Safe Configuration Changes

Changes to these settings may require background migration:

- Embedding model.
- Embedding dimensions.
- Chunking strategy.
- Parser version.
- Vector index structure.

Do not treat every configuration change as a simple database update. Validate whether existing indexed content remains compatible.

---

# 21. Implementation Roadmap

## Release 1 — Admin Configuration Foundation

Priority: High

- [ ] Admin role validation.
- [ ] Admin navigation and dashboard.
- [ ] General RAG settings.
- [ ] Embedding configuration.
- [ ] Retrieval configuration.
- [ ] Context configuration.
- [ ] Supabase configuration tables.
- [ ] Configuration validation.
- [ ] Configuration API.
- [ ] Audit logs.
- [ ] Shared backend configuration loading.
- [ ] Configuration caching and invalidation.

Expected result:

Administrators can control the main RAG behavior for both Web and VS Code Extension.

## Release 2 — Retrieval and AI Context Improvements

Priority: High

- [ ] Vector search.
- [ ] PostgreSQL full-text search.
- [ ] Hybrid search.
- [ ] RRF.
- [ ] Configurable Top K.
- [ ] Similarity thresholds.
- [ ] Metadata filtering.
- [ ] Context builder.
- [ ] Context token limits.
- [ ] Context deduplication.
- [ ] Citation generation.
- [ ] Task-specific RAG profiles.
- [ ] AI Engine integration.

Expected result:

Both clients can use relevant knowledge when generating AI responses.

## Release 3 — Knowledge and Indexing Management

Priority: High

- [ ] URL importer.
- [ ] GitHub repository importer.
- [ ] File and ZIP importer.
- [ ] Workspace indexing.
- [ ] Tree-sitter integration.
- [ ] Semantic chunking.
- [ ] Configurable embeddings.
- [ ] Background indexing.
- [ ] Incremental indexing.
- [ ] Content hashing.
- [ ] Indexing dashboard.
- [ ] Source management.
- [ ] Source deletion.

Expected result:

Administrators and authorized users can maintain a reliable knowledge base.

## Release 4 — RAG Playground and Evaluation

Priority: Medium-High

- [ ] RAG Playground.
- [ ] Search Explorer.
- [ ] Evaluation datasets.
- [ ] Retrieval evaluation.
- [ ] AI answer evaluation.
- [ ] Citation evaluation.
- [ ] Configuration comparison.
- [ ] Baseline evaluation.
- [ ] User feedback.
- [ ] Quality analytics.

Expected result:

Administrators can identify and measure the actual impact of RAG configuration changes.

## Release 5 — Advanced AI Quality and Optimization

Priority: Medium

- [ ] Optional reranking.
- [ ] Advanced model routing.
- [ ] Advanced task profiles.
- [ ] Prompt versioning.
- [ ] Configuration rollback.
- [ ] Advanced analytics.
- [ ] Resource and usage quotas.
- [ ] Advanced caching.
- [ ] Configuration recommendations.
- [ ] Organization-level knowledge management.

Expected result:

Codevia AI can improve quality, cost efficiency and maintainability as usage increases.

---

# 22. Acceptance Criteria

## 22.1 Administration

- [ ] Only authorized administrators can update global RAG settings.
- [ ] Configuration changes are validated on the server.
- [ ] Configuration updates are audited.
- [ ] Previous configurations can be inspected.
- [ ] Supported settings can be rolled back.
- [ ] Changes take effect without redeployment when no migration is required.

## 22.2 Embeddings

- [ ] Embedding provider and model are configurable.
- [ ] Model compatibility is validated.
- [ ] Dimensions are validated.
- [ ] Incompatible vectors are not mixed.
- [ ] Re-indexing can be estimated and monitored.
- [ ] Embedding errors can be retried safely.

## 22.3 Retrieval

- [ ] Vector search works.
- [ ] Keyword search works.
- [ ] Hybrid search works.
- [ ] RRF ranking is implemented.
- [ ] Top K is configurable.
- [ ] Context chunk limits are configurable.
- [ ] Metadata filters are enforced.
- [ ] Unauthorized content is never returned.
- [ ] Retrieval results can be inspected in the Search Explorer.

## 22.4 AI Context

- [ ] Context is built centrally in the backend.
- [ ] Context size is bounded.
- [ ] Duplicate content is reduced.
- [ ] Source references are preserved.
- [ ] Retrieved content is treated as untrusted input.
- [ ] Task-specific RAG settings are supported.
- [ ] RAG failure does not unnecessarily disable existing AI features.

## 22.5 AI Quality

- [ ] Evaluation datasets can be created.
- [ ] Retrieval metrics can be calculated.
- [ ] Answer quality can be evaluated.
- [ ] Citations can be checked.
- [ ] Configurations can be compared.
- [ ] User feedback can be collected.
- [ ] Quality changes can be measured against a baseline.

## 22.6 Shared Clients

- [ ] Web uses the shared backend AI Engine.
- [ ] VS Code uses the same shared backend AI Engine.
- [ ] Both clients use the shared RAG Engine.
- [ ] Both clients use authorized knowledge scopes.
- [ ] Admin configuration changes affect both clients.
- [ ] No provider secrets are exposed in either client.

## 22.7 Performance and Security

- [ ] Indexing uses bounded background processing.
- [ ] Incremental indexing avoids unnecessary reprocessing.
- [ ] Workspace uploads require consent.
- [ ] Sensitive files are excluded.
- [ ] User/project data isolation is enforced.
- [ ] Request and indexing limits are enforced.
- [ ] Retrieval and provider failures are observable.
- [ ] Source deletion removes associated indexed content.

---

# 23. Final Architecture and Product Decisions

Codevia AI should use the following design:

1. **One Admin Configuration:** Centralized management of AI, RAG, embedding, retrieval, context and quality settings.
2. **One Shared AI Engine:** All AI provider calls, routing, prompts, fallback and response processing are handled by the backend.
3. **One Shared RAG Engine:** All ingestion, parsing, chunking, embedding, retrieval, ranking and citation processing are handled centrally.
4. **One Knowledge Database:** Supabase PostgreSQL and pgvector store authorized knowledge and metadata.
5. **Two Clients:** Web and VS Code have separate user interfaces but share the same backend intelligence.
6. **Configurable Models:** Chat, embedding and optional reranking models can be managed independently.
7. **Measurable Quality:** Use evaluation datasets, feedback and analytics to verify improvements.
8. **Secure Retrieval:** Validate permissions before retrieving and using knowledge.
9. **Controlled Indexing:** Use incremental indexing, background jobs and resource limits.
10. **Incremental Implementation:** Preserve existing Codevia AI functionality and deployment configuration.

## Final Product Direction

**Codevia AI = One AI Platform + Two Applications + One Shared AI Engine + One Shared RAG Engine + Centralized Administration.**

The Admin RAG Configuration module should not simply provide more switches. It should provide a controlled, measurable and secure way to improve AI responses across the entire Codevia AI platform.

The primary success measure is not the number of indexed documents or retrieved chunks. It is whether Codevia AI consistently produces more relevant, correct, useful and verifiable answers while keeping latency, token consumption and operating costs under control.
