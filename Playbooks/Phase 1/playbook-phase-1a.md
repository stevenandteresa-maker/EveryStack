# Phase 1A — Monorepo, CI Pipeline, Dev Environment

## Phase Context

### What Has Been Built

Nothing. This is the first sub-phase. The repository is an empty directory.

### What This Phase Delivers

A runnable monorepo shell with four application/package scaffolds (`apps/web`, `apps/worker`, `apps/realtime`, `packages/shared`), Docker Compose dev services (PostgreSQL 16, PgBouncer, Redis 7), a fully configured GitHub Actions CI pipeline with all 9 pre-merge gates, and standardized tooling (ESLint, Prettier, TypeScript strict mode). When complete, `pnpm install && pnpm dev` starts the dev environment, `pnpm turbo lint && pnpm turbo typecheck && pnpm turbo test` all pass green, and pushing to GitHub triggers the complete CI pipeline.

### What This Phase Does NOT Build

- Database schema or Drizzle ORM configuration (Phase 1B)
- Any application logic, routes, or features
- Authentication or tenant isolation (Phase 1C)
- Observability, logging, or security headers (Phase 1D)
- Test factories, `testTenantIsolation()`, or Playwright E2E setup (Phase 1E)
- Design system, shadcn/ui, or Tailwind theme tokens (Phase 1F)
- Socket.io room logic, BullMQ job processors, or file upload pipeline (Phase 1G)
- AI service layer or provider adapters (Phase 1H)
- Audit log or Platform API auth (Phase 1I)
- Production deployment configuration
- Any post-MVP features

### Architecture Patterns for This Phase

- **Monorepo tool:** Turborepo for build orchestration + pnpm workspaces for package management.
- **TypeScript strict mode** everywhere — no `any`, no implicit returns, `tsc --noEmit` in CI.
- **ESLint rules:** `no-console` (Pino logger will be introduced in 1D), `no-any` (TypeScript strict enforces this).
- **Node version:** v20 (pinned in `.nvmrc` and CI).
- **Package naming convention:** `@everystack/web`, `@everystack/worker`, `@everystack/realtime`, `@everystack/shared`.
- **Docker Compose:** Dev services run on standard ports (Postgres 5432, PgBouncer 6432, Redis 6379). Test services run on offset ports (Postgres 5433, PgBouncer 6433, Redis 6380).
- **CockroachDB safeguards active from this phase:** UUIDv7 for all primary keys, no PostgreSQL-specific syntax in application queries, no advisory locks, hash-partitioning-compatible schemas. These are documented but not yet enforced in code — enforcement starts in 1B when the schema is created.

### Mandatory Context for All Prompts

`CLAUDE.md` is the project root file — Claude Code auto-loads it from the monorepo root. No manual loading needed.
`GLOSSARY.md` is available at `docs/reference/GLOSSARY.md` — consult it when naming new functions, components, UI labels, or database objects. Do not load in full for every prompt.
`MANIFEST.md` is not needed during build execution.
Phase division files are not needed during build execution — their content has been pre-digested into this playbook.

---

## Section Index

| Prompt | Deliverable | Depends On | Lines (est.) |
|--------|-------------|------------|--------------|
| 1 | Monorepo scaffold with Turborepo + pnpm workspaces | None | ~180 |
| 2 | Next.js web app scaffold with health check endpoint | 1 | ~200 |
| 3 | Worker + realtime app scaffolds (entry points) | 1 | ~150 |
| 4 | Shared package scaffold with subpackage structure | 1 | ~150 |
| CP-1 | Integration Checkpoint 1 (after Prompts 1–4) | 1–4 | — |
| 5 | ESLint + Prettier + i18n stub configuration | 1–4 | ~180 |
| 6 | Docker Compose dev environment + .env.example | 1 | ~160 |
| 7 | Docker Compose test services (tmpfs-backed for CI) | 6 | ~120 |
| 8 | GitHub Actions CI pipeline (all 9 pre-merge gates) | 1–7 | ~200 |
| CP-2 | Integration Checkpoint 2 — Final (after Prompts 5–8) | 1–8 | — |

---

## Prompt 1: Initialize Monorepo with Turborepo + pnpm Workspaces

**Depends on:** None
**Load context:** CLAUDE.md (full — auto-loaded), testing.md lines 693–724 (CI workflow header for Node version reference)
**Target files:** `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.gitignore`, `.nvmrc`, `README.md`
**Migration required:** No
**Git:** Create and checkout branch `feat/phase-1a-infrastructure` from `main`. Commit with message `feat(infra): initialize monorepo with turborepo and pnpm workspaces [Phase 1A, Prompt 1]`

### Schema Snapshot

N/A — no schema changes.

### Task

Initialize the EveryStack monorepo from an empty directory. This is the project root — everything else builds on this scaffold.

**1. Root `package.json`:**
- `name`: `everystack`
- `private`: `true`
- `engines.node`: `>=20`
- `packageManager`: `pnpm@9.x` (use latest 9.x)
- Scripts: `dev`, `build`, `lint`, `typecheck`, `test` — all delegating to Turborepo (`turbo run <task>`)
- No direct dependencies at root — all deps live in workspace packages

**2. `pnpm-workspace.yaml`:**
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

**3. `turbo.json`:**
```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "typecheck": {},
    "check:i18n": {},
    "test": {
      "dependsOn": ["^build"]
    },
    "test:coverage-check": {
      "dependsOn": ["test"]
    },
    "test:e2e": {
      "dependsOn": ["build"],
      "cache": false
    },
    "test:ai-eval": {
      "cache": false
    },
    "db:migrate": {
      "cache": false
    },
    "db:migrate:check": {
      "cache": false,
      "dependsOn": ["db:migrate"]
    },
    "db:seed-staging": {
      "cache": false
    }
  }
}
```

**4. `tsconfig.base.json`:**
- `compilerOptions.target`: `ES2022`
- `compilerOptions.module`: `ESNext`
- `compilerOptions.moduleResolution`: `bundler`
- `compilerOptions.strict`: `true`
- `compilerOptions.noUncheckedIndexedAccess`: `true`
- `compilerOptions.forceConsistentCasingInFileNames`: `true`
- `compilerOptions.esModuleInterop`: `true`
- `compilerOptions.skipLibCheck`: `true`
- `compilerOptions.resolveJsonModule`: `true`
- `compilerOptions.isolatedModules`: `true`
- `compilerOptions.declaration`: `true`
- `compilerOptions.declarationMap`: `true`
- `compilerOptions.sourceMap`: `true`
- This is the base config. Each workspace package extends it with `"extends": "../../tsconfig.base.json"` (or the appropriate relative path).

**5. `.gitignore`:**
- Standard Node ignores: `node_modules/`, `dist/`, `.next/`, `.turbo/`, `coverage/`
- Environment files: `.env`, `.env.local`, `.env.test`
- IDE files: `.idea/`, `.vscode/settings.json` (but include `.vscode/extensions.json`)
- OS files: `.DS_Store`, `Thumbs.db`
- Build artifacts: `*.tsbuildinfo`
- Playwright: `playwright-report/`, `test-results/`

**6. `.nvmrc`:**
```
20
```

**7. `README.md`:**
- Brief project description: "EveryStack — Multi-tenant SaaS unifying no-code databases"
- Placeholder sections: Getting Started, Development, Testing, Architecture
- Reference to `CLAUDE.md` for project conventions

**8. Create empty directory scaffolds** (with `.gitkeep` files to track them in git):
- `apps/web/`
- `apps/worker/`
- `apps/realtime/`
- `packages/shared/`
- `docs/reference/`

### Acceptance Criteria

- [ ] `pnpm install` completes without errors (no packages to install yet, but the workspace config is valid)
- [ ] `turbo.json` is valid JSON with all task definitions from the task list above
- [ ] `tsconfig.base.json` has `strict: true` and all listed compiler options
- [ ] `.nvmrc` specifies Node 20
- [ ] `.gitignore` excludes `node_modules/`, `.env`, `.env.local`, `.next/`, `.turbo/`, `coverage/`
- [ ] Directory structure matches: `apps/web/`, `apps/worker/`, `apps/realtime/`, `packages/shared/`, `docs/reference/`
- [ ] TypeScript compiles with zero errors (trivially — no TS files yet)

### Do NOT Build

- Application code of any kind
- Drizzle config or database connection helpers (Phase 1B)
- Docker Compose services (Prompt 6)
- ESLint/Prettier config (Prompt 5 — separated to keep this prompt focused on monorepo structure)
- CI pipeline (Prompt 8)

---

## Prompt 2: Next.js Web App Scaffold with Health Check Endpoint

**Depends on:** Prompt 1
**Load context:** CLAUDE.md (full — auto-loaded), operations.md lines 405–408 (health check endpoint spec)
**Target files:** `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/next.config.ts`, `apps/web/src/app/layout.tsx`, `apps/web/src/app/page.tsx`, `apps/web/src/app/api/health/route.ts`
**Migration required:** No
**Git:** Commit with message `feat(web): scaffold next.js app with health check endpoint [Phase 1A, Prompt 2]`

### Schema Snapshot

N/A — no schema changes.

### Task

Create the `apps/web` Next.js application using the App Router pattern. This is the primary user-facing application.

**1. `apps/web/package.json`:**
- `name`: `@everystack/web`
- Dependencies: `next`, `react`, `react-dom`
- Dev dependencies: `typescript`, `@types/react`, `@types/react-dom`, `@types/node`
- Scripts: `dev` (`next dev`), `build` (`next build`), `start` (`next start`), `lint` (placeholder — ESLint configured in Prompt 5), `typecheck` (`tsc --noEmit`)
- Do NOT install ESLint, Prettier, Tailwind, shadcn, or any feature libraries yet — those come in later sub-phases.

**2. `apps/web/tsconfig.json`:**
- Extends `../../tsconfig.base.json`
- Add Next.js-specific options: `jsx: "preserve"`, `incremental: true`
- Path aliases: `"@/*": ["./src/*"]`
- Include: `["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"]`

**3. `apps/web/next.config.ts`:**
- Enable Turborepo transpile for `@everystack/shared`
- Strict mode: `reactStrictMode: true`
- Output: `standalone` (for containerized deployment)
- Placeholder for future headers (security headers come in 1D)

**4. `apps/web/src/app/layout.tsx`:**
- Root layout with `<html lang="en">` and `<body>`
- Metadata: title "EveryStack", description from CLAUDE.md
- No styling yet — raw HTML structure. Design system comes in 1F.

**5. `apps/web/src/app/page.tsx`:**
- Minimal placeholder: "EveryStack is running." with a `<h1>` tag.
- Server component (default in App Router).

**6. `apps/web/src/app/api/health/route.ts`:**
- `GET /api/health` route handler
- For now: returns `{ status: "ok", timestamp: new Date().toISOString() }` with HTTP 200
- Future: will check Postgres and Redis connectivity (added in 1B and 1G respectively)
- Include a `TODO` comment: `// TODO [Phase 1B]: Add Postgres health check via getDbForTenant()`
- Include a `TODO` comment: `// TODO [Phase 1G]: Add Redis health check`

**7. Create empty directory structure:**
- `apps/web/src/components/` (React components)
- `apps/web/src/data/` (server-side data access)
- `apps/web/src/actions/` (Server Actions)
- `apps/web/src/lib/` (client utilities)
- `apps/web/e2e/` (Playwright E2E tests — setup in 1E)
- Use `.gitkeep` files in empty directories.

### Acceptance Criteria

- [ ] `pnpm install` in the monorepo root installs Next.js and React dependencies in `apps/web`
- [ ] `pnpm turbo typecheck --filter=@everystack/web` passes with zero errors
- [ ] `pnpm turbo build --filter=@everystack/web` produces a successful Next.js build
- [ ] `pnpm dev --filter=@everystack/web` starts the dev server (manual check — visit `http://localhost:3000`)
- [ ] `GET /api/health` returns `{ status: "ok", timestamp: "..." }` with HTTP 200
- [ ] Path alias `@/*` resolves correctly in tsconfig
- [ ] Directory structure: `src/app/`, `src/components/`, `src/data/`, `src/actions/`, `src/lib/`, `e2e/`

### Do NOT Build

- Authentication middleware or Clerk integration (Phase 1C)
- Any styled UI components or Tailwind setup (Phase 1F)
- Database connections or Drizzle config (Phase 1B)
- Application routes beyond the placeholder and health check
- Error boundaries or global error handling (Phase 1D)

---

## Prompt 3: Worker + Realtime App Scaffolds

**Depends on:** Prompt 1
**Load context:** CLAUDE.md (full — auto-loaded)
**Target files:** `apps/worker/package.json`, `apps/worker/tsconfig.json`, `apps/worker/src/index.ts`, `apps/realtime/package.json`, `apps/realtime/tsconfig.json`, `apps/realtime/src/index.ts`
**Migration required:** No
**Git:** Commit with message `feat(infra): scaffold worker and realtime app entry points [Phase 1A, Prompt 3]`

### Schema Snapshot

N/A — no schema changes.

### Task

Create minimal, compilable entry points for the two non-web applications. These are skeleton processes that will be populated in later sub-phases.

**1. `apps/worker/` — BullMQ background job processor:**

- `package.json`:
  - `name`: `@everystack/worker`
  - Dependencies: (none yet — BullMQ added in 1G)
  - Dev dependencies: `typescript`, `@types/node`
  - Scripts: `dev` (`tsx watch src/index.ts`), `build` (`tsc`), `start` (`node dist/index.js`), `typecheck` (`tsc --noEmit`)
- `tsconfig.json`: extends `../../tsconfig.base.json`, `outDir: "dist"`, `rootDir: "src"`
- `src/index.ts`:
  ```typescript
  // EveryStack Worker — BullMQ Job Processor
  // Queue definitions and job processors will be added in Phase 1G.

  console.log('[worker] EveryStack worker starting...');

  // Graceful shutdown handler
  const shutdown = () => {
    console.log('[worker] Shutting down gracefully...');
    // TODO [Phase 1G]: Close BullMQ workers, wait for in-progress jobs
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  console.log('[worker] Ready. Waiting for queue configuration (Phase 1G).');
  ```

**2. `apps/realtime/` — Socket.io server:**

- `package.json`:
  - `name`: `@everystack/realtime`
  - Dependencies: (none yet — Socket.io added in 1G)
  - Dev dependencies: `typescript`, `@types/node`
  - Scripts: `dev` (`tsx watch src/index.ts`), `build` (`tsc`), `start` (`node dist/index.js`), `typecheck` (`tsc --noEmit`)
- `tsconfig.json`: extends `../../tsconfig.base.json`, `outDir: "dist"`, `rootDir: "src"`
- `src/index.ts`:
  ```typescript
  // EveryStack Realtime — Socket.io Server
  // Room model, auth, and event handling will be added in Phase 1G.

  const PORT = parseInt(process.env.REALTIME_PORT ?? '3001', 10);

  console.log(`[realtime] EveryStack realtime server starting on port ${PORT}...`);

  // Graceful shutdown handler
  const shutdown = () => {
    console.log('[realtime] Shutting down gracefully...');
    // TODO [Phase 1G]: Close Socket.io server, drain connections
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  console.log('[realtime] Ready. Waiting for Socket.io configuration (Phase 1G).');
  ```

**Note:** Both entry points use `console.log` temporarily. These will be replaced with the Pino structured logger in Phase 1D. The `no-console` ESLint rule (Prompt 5) will include a suppression comment or will not flag these specific bootstrap logs.

### Acceptance Criteria

- [ ] `pnpm install` resolves both new workspace packages
- [ ] `pnpm turbo typecheck --filter=@everystack/worker` passes with zero errors
- [ ] `pnpm turbo typecheck --filter=@everystack/realtime` passes with zero errors
- [ ] `pnpm turbo build --filter=@everystack/worker` produces `dist/index.js`
- [ ] `pnpm turbo build --filter=@everystack/realtime` produces `dist/index.js`
- [ ] Both entry points execute without runtime errors when run with `node dist/index.js`
- [ ] Both entry points handle SIGTERM gracefully (exit code 0)

### Do NOT Build

- BullMQ queue definitions or job processors (Phase 1G)
- Socket.io server setup, room model, or Redis adapter (Phase 1G)
- Any actual business logic or job handlers
- Database connections or imports

---

## Prompt 4: Shared Package Scaffold with Subpackage Structure

**Depends on:** Prompt 1
**Load context:** CLAUDE.md (full — auto-loaded, specifically the Monorepo Structure section)
**Target files:** `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/db/index.ts`, `packages/shared/sync/index.ts`, `packages/shared/ai/index.ts`, `packages/shared/testing/index.ts`
**Migration required:** No
**Git:** Commit with message `feat(shared): scaffold shared package with db, sync, ai, testing submodules [Phase 1A, Prompt 4]`

### Schema Snapshot

N/A — no schema changes.

### Task

Create the `packages/shared` package that all apps import from. This package contains the shared database layer, sync engine, AI service, and test utilities. For now, create the directory structure and barrel exports — actual implementations come in later sub-phases.

**1. `packages/shared/package.json`:**
- `name`: `@everystack/shared`
- `main`: `./index.ts` (for now — will add proper exports map)
- `exports`:
  ```json
  {
    "./db": "./db/index.ts",
    "./db/*": "./db/*/index.ts",
    "./sync": "./sync/index.ts",
    "./ai": "./ai/index.ts",
    "./testing": "./testing/index.ts"
  }
  ```
- Dev dependencies: `typescript`
- Scripts: `typecheck` (`tsc --noEmit`), `build` (`tsc`), `lint` (placeholder)

**2. `packages/shared/tsconfig.json`:**
- Extends `../../tsconfig.base.json`
- `compilerOptions.outDir`: `"dist"`
- `compilerOptions.rootDir`: `"."` (covers all subdirs)
- Include: `["**/*.ts"]`
- Exclude: `["dist", "node_modules", "**/*.test.ts"]`

**3. Create directory structure:**
```
packages/shared/
├── db/
│   ├── schema/         # Drizzle schema files (1B)
│   ├── migrations/     # Drizzle migration files (1B)
│   └── index.ts        # Barrel export
├── sync/
│   ├── adapters/       # Platform adapters (Phase 2)
│   ├── field-registry.ts  # FieldTypeRegistry (Phase 2) — placeholder
│   └── index.ts        # Barrel export
├── ai/
│   ├── providers/      # AIProviderAdapter implementations (1H)
│   ├── prompts/        # Versioned prompt templates (1H)
│   ├── tools/          # AI tool definitions (1H)
│   ├── evaluation/     # AI eval suite (1H)
│   └── index.ts        # Barrel export
├── testing/
│   └── index.ts        # Barrel export (factories, helpers — 1E)
├── index.ts            # Root barrel
├── package.json
└── tsconfig.json
```

**4. Barrel exports — each `index.ts` is a placeholder:**
```typescript
// packages/shared/db/index.ts
// Database layer — Drizzle schema, connection helpers, migrations
// Populated in Phase 1B.
export {};

// packages/shared/sync/index.ts
// Sync engine — adapters, FieldTypeRegistry, canonical transforms
// Populated in Phase 2.
export {};

// (similar pattern for ai/index.ts and testing/index.ts)
```

**5. Root barrel `packages/shared/index.ts`:**
```typescript
// @everystack/shared — shared utilities across all apps
// Import from specific subpackages: @everystack/shared/db, @everystack/shared/sync, etc.
export {};
```

**6. Verify that apps can import from the shared package:**
- Add `@everystack/shared` as a workspace dependency in `apps/web/package.json`, `apps/worker/package.json`, and `apps/realtime/package.json` using `"@everystack/shared": "workspace:*"`

### Acceptance Criteria

- [ ] `pnpm install` resolves `@everystack/shared` as a workspace dependency in all three apps
- [ ] `pnpm turbo typecheck --filter=@everystack/shared` passes with zero errors
- [ ] `pnpm turbo typecheck` (root — all packages) passes with zero errors
- [ ] Directory structure matches the tree diagram above (all directories exist with `.gitkeep` or `index.ts`)
- [ ] Package exports map in `package.json` correctly maps `./db`, `./sync`, `./ai`, `./testing`
- [ ] Adding `import {} from '@everystack/shared/db'` in `apps/web` compiles without errors

### Do NOT Build

- Drizzle schema or database helpers (Phase 1B)
- FieldTypeRegistry implementation (Phase 2)
- AIService or provider adapters (Phase 1H)
- Test factories or `testTenantIsolation()` (Phase 1E)
- Any actual exported functions — only empty barrel exports

---

## Integration Checkpoint 1 (after Prompts 1–4)

**Task:** Verify the monorepo structure is correct and all packages compile together.

Run:
1. `pnpm install` — all workspace packages resolve
2. `pnpm turbo typecheck` — zero TypeScript errors across all 4 packages
3. `pnpm turbo build` — all packages build successfully
4. `pnpm dev --filter=@everystack/web` — Next.js dev server starts, `http://localhost:3000` shows the placeholder page
5. `curl http://localhost:3000/api/health` — returns `{ status: "ok", ... }` with HTTP 200
6. Verify directory structure matches CLAUDE.md Monorepo Structure section

**Git:** Commit with message `chore(verify): integration checkpoint 1 — monorepo scaffold complete [Phase 1A, CP-1]`, then push branch to origin.

Fix any failures before proceeding to Prompt 5.

---

## Prompt 5: ESLint + Prettier + i18n Stub Configuration

**Depends on:** Prompts 1, 2, 3, 4
**Load context:** CLAUDE.md (full — auto-loaded, specifically Code Conventions and Pre-Merge Gates sections)
**Target files:** `.eslintrc.cjs` (or `eslint.config.mjs`), `.prettierrc`, `.prettierignore`, `packages/shared/eslint-config/index.js`, `scripts/check-i18n.ts`
**Migration required:** No
**Git:** Commit with message `feat(tooling): configure eslint, prettier, and i18n stub check [Phase 1A, Prompt 5]`

### Schema Snapshot

N/A — no schema changes.

### Task

Configure the code quality tooling that enforces CLAUDE.md conventions across the monorepo.

**1. ESLint configuration (flat config preferred if Next.js ESLint plugin supports it, otherwise `.eslintrc.cjs`):**

Core rules enforced:
- `no-console: "error"` — all logging goes through Pino (introduced in 1D). For Prompt 3's bootstrap entry points, add `// eslint-disable-next-line no-console` comments.
- `@typescript-eslint/no-explicit-any: "error"` — no `any` types.
- `@typescript-eslint/no-unused-vars: ["error", { "argsIgnorePattern": "^_" }]`
- `@typescript-eslint/consistent-type-imports: "error"` — use `import type {}` for type-only imports.
- Extend from `eslint:recommended`, `@typescript-eslint/recommended`, and `next/core-web-vitals` for `apps/web`.

Install dev dependencies at the root level:
- `eslint`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `eslint-config-prettier`
- In `apps/web`: `eslint-config-next`

Each workspace package should have a minimal ESLint config that extends the root, or use a shared config from `packages/shared/eslint-config/`.

**Alternative approach (simpler):** Create a shared ESLint config package or a root-level config that all workspaces inherit. Turborepo's `lint` task runs ESLint per-package.

**2. Prettier configuration (`.prettierrc`):**
```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

**`.prettierignore`:**
```
node_modules
dist
.next
.turbo
coverage
pnpm-lock.yaml
```

**3. i18n completeness check (`scripts/check-i18n.ts`):**

This is a stub script that will be expanded when actual UI strings exist. For now, it:
- Scans `apps/web/src/**/*.tsx` files for hardcoded English strings (string literals in JSX that aren't inside a `t()` call, `className`, or known safe attributes like `data-testid`).
- Returns exit code 0 if no violations, exit code 1 if violations found.
- For Phase 1A, this will trivially pass (no JSX with text content exists yet).
- Add the `check:i18n` script to the appropriate package.json, callable via `pnpm turbo check:i18n`.

**Note:** A full i18n solution (e.g., `next-intl` or `react-i18next`) will be configured when the first UI components are built in Phase 1F/Phase 3. This stub ensures the CI gate exists from day one.

**4. Add lint/format scripts to all workspace packages:**
- Each package should have a `lint` script that runs ESLint on its source files.
- Root scripts: `format` (`prettier --write .`), `format:check` (`prettier --check .`)

**5. Verify existing code passes:**
- Add `eslint-disable-next-line no-console` to the `console.log` statements in `apps/worker/src/index.ts` and `apps/realtime/src/index.ts` (temporary — replaced by Pino in 1D).

### Acceptance Criteria

- [ ] `pnpm turbo lint` passes with zero errors across all packages
- [ ] `pnpm turbo typecheck` still passes with zero errors
- [ ] `prettier --check .` reports no formatting violations (run `prettier --write .` first)
- [ ] ESLint `no-console` rule is active — adding an un-suppressed `console.log` to any source file causes a lint failure
- [ ] ESLint `no-explicit-any` rule is active — adding `: any` to a variable causes a lint failure
- [ ] `pnpm turbo check:i18n` passes (trivially — no UI strings exist yet)
- [ ] The `eslint-disable-next-line no-console` comments in worker and realtime entry points are the only console suppressions

### Do NOT Build

- A full i18n framework setup (Phase 1F or Phase 3)
- Pre-commit hooks or Husky (can be added later if desired)
- Import sorting or import alias rules beyond TypeScript path aliases
- Any application code changes

---

## Prompt 6: Docker Compose Dev Environment + .env.example

**Depends on:** Prompt 1
**Load context:** CLAUDE.md (full — auto-loaded), operations.md lines 374–395 (Redis Docker Compose config), operations.md lines 443–479 (Secrets inventory)
**Target files:** `docker-compose.yml`, `.env.example`
**Migration required:** No
**Git:** Commit with message `feat(infra): docker compose dev services with postgres, pgbouncer, redis [Phase 1A, Prompt 6]`

### Schema Snapshot

N/A — no schema changes. Docker services provide the infrastructure for Phase 1B's schema.

### Task

Create the development Docker Compose stack with all three database/cache services and a comprehensive `.env.example`.

**1. `docker-compose.yml`:**

```yaml
# EveryStack Development Services
# Start with: docker compose up -d
# Check health: docker compose ps

services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: everystack
      POSTGRES_PASSWORD: everystack_dev
      POSTGRES_DB: everystack_dev
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "everystack"]
      interval: 5s
      timeout: 5s
      retries: 10

  pgbouncer:
    image: bitnami/pgbouncer:latest
    environment:
      POSTGRESQL_HOST: postgres
      POSTGRESQL_PORT: 5432
      POSTGRESQL_USERNAME: everystack
      POSTGRESQL_PASSWORD: everystack_dev
      POSTGRESQL_DATABASE: everystack_dev
      PGBOUNCER_POOL_MODE: transaction
      PGBOUNCER_MAX_CLIENT_CONN: 200
      PGBOUNCER_DEFAULT_POOL_SIZE: 20
    ports:
      - "${PGBOUNCER_PORT:-6432}:6432"
    depends_on:
      postgres:
        condition: service_healthy

  redis:
    image: redis:7-alpine
    command: >
      redis-server
      --maxmemory 256mb
      --maxmemory-policy volatile-lru
      --appendonly yes
      --appendfsync everysec
      --save 300 10
      --save 60 10000
    ports:
      - "${REDIS_PORT:-6379}:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

volumes:
  postgres_data:
  redis_data:
```

Key design decisions:
- `pgvector/pgvector:pg16` image (not plain `postgres:16`) — pgvector extension pre-installed for future vector operations.
- PgBouncer in `transaction` mode — required for serverless-compatible connection pooling.
- Redis with `volatile-lru` eviction, AOF + RDB persistence — matches the operations.md specification.
- Named volumes for data persistence between `docker compose down` and `docker compose up`.
- Port variables with defaults so developers can override if ports conflict.

**2. `.env.example`:**

Create a comprehensive example with all environment variables needed across all Foundation sub-phases. Group by service. Include comments explaining each variable.

```env
# ============================
# EveryStack — Environment Variables
# ============================
# Copy this file to .env.local and fill in real values.
# NEVER commit .env.local to source control.

# --- Database (PostgreSQL via PgBouncer) ---
DATABASE_URL=postgres://everystack:everystack_dev@localhost:6432/everystack_dev
DATABASE_URL_DIRECT=postgres://everystack:everystack_dev@localhost:5432/everystack_dev
DATABASE_READ_URL=postgres://everystack:everystack_dev@localhost:6432/everystack_dev

# --- Redis ---
REDIS_URL=redis://localhost:6379

# --- Auth (Clerk) ---
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
CLERK_WEBHOOK_SECRET=whsec_xxx

# --- AI (Anthropic) ---
ANTHROPIC_API_KEY=sk-ant-xxx

# --- Email (Resend) ---
RESEND_API_KEY=re_xxx

# --- File Storage (Cloudflare R2 / S3-compatible) ---
R2_ACCESS_KEY=xxx
R2_SECRET_KEY=xxx
STORAGE_BUCKET=everystack-dev
STORAGE_ENDPOINT=https://xxx.r2.cloudflarestorage.com
STORAGE_PUBLIC_URL=https://cdn.everystack.app

# --- PDF Generation (Gotenberg) ---
GOTENBERG_URL=http://localhost:3030

# --- Billing (Stripe) ---
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# --- Observability ---
SENTRY_DSN=https://xxx@sentry.io/xxx

# --- App ---
NEXT_PUBLIC_APP_URL=http://localhost:3000
REALTIME_PORT=3001
NODE_ENV=development
```

### Acceptance Criteria

- [ ] `docker compose up -d` starts all three services (postgres, pgbouncer, redis) without errors
- [ ] `docker compose ps` shows all services healthy
- [ ] `psql postgres://everystack:everystack_dev@localhost:5432/everystack_dev -c "SELECT 1"` succeeds (direct Postgres)
- [ ] `psql postgres://everystack:everystack_dev@localhost:6432/everystack_dev -c "SELECT 1"` succeeds (via PgBouncer)
- [ ] `redis-cli -p 6379 PING` returns `PONG`
- [ ] `.env.example` contains all variables listed above with placeholder values
- [ ] `.env.example` is committed to git; `.env.local` is in `.gitignore`

### Do NOT Build

- Drizzle ORM configuration or migration runner (Phase 1B)
- Application-level database connection helpers like `getDbForTenant()` (Phase 1B)
- Redis client factory or connection management (Phase 1G)
- Production Docker Compose or multi-service orchestration
- Gotenberg service in Docker Compose (Phase 3D — Documents)

---

## Prompt 7: Docker Compose Test Services (tmpfs-Backed for CI)

**Depends on:** Prompt 6
**Load context:** CLAUDE.md (full — auto-loaded), testing.md lines 525–586 (Docker Compose for Test Services + environment variables)
**Target files:** `docker-compose.test.yml`, `.env.test.example`
**Migration required:** No
**Git:** Commit with message `feat(infra): docker compose test services with tmpfs-backed postgres and redis [Phase 1A, Prompt 7]`

### Schema Snapshot

N/A — no schema changes.

### Task

Create a separate Docker Compose file for test services that runs on different ports from dev and uses tmpfs (RAM-backed storage) for maximum speed.

**1. `docker-compose.test.yml`:**

Follow the specification from testing.md lines 525–573 exactly:

```yaml
# docker-compose.test.yml
# Used by CI and local `pnpm test:integration`
# All services use tmpfs for RAM-backed speed — no data persistence.

services:
  postgres-test:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: everystack_test
      POSTGRES_PASSWORD: test_password
      POSTGRES_DB: everystack_test
    ports:
      - "5433:5432"
    tmpfs: /var/lib/postgresql/data
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "everystack_test"]
      interval: 2s
      timeout: 5s
      retries: 10

  pgbouncer-test:
    image: bitnami/pgbouncer:latest
    environment:
      POSTGRESQL_HOST: postgres-test
      POSTGRESQL_PORT: 5432
      POSTGRESQL_USERNAME: everystack_test
      POSTGRESQL_PASSWORD: test_password
      POSTGRESQL_DATABASE: everystack_test
      PGBOUNCER_POOL_MODE: transaction
      PGBOUNCER_MAX_CLIENT_CONN: 100
      PGBOUNCER_DEFAULT_POOL_SIZE: 10
    ports:
      - "6433:6432"
    depends_on:
      postgres-test:
        condition: service_healthy

  redis-test:
    image: redis:7-alpine
    ports:
      - "6380:6379"
    tmpfs: /data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 2s
      timeout: 5s
      retries: 10
```

**2. `.env.test.example`:**

```env
# Test environment variables (used by CI and local integration tests)
# Copy to .env.test for local use. CI injects these directly.

DATABASE_URL=postgres://everystack_test:test_password@localhost:5433/everystack_test
PGBOUNCER_URL=postgres://everystack_test:test_password@localhost:6433/everystack_test
REDIS_URL=redis://localhost:6380
CLERK_SECRET_KEY=sk_test_xxx
NODE_ENV=test
```

**3. Add convenience scripts to root `package.json`:**
- `test:services:up`: `docker compose -f docker-compose.test.yml up -d --wait`
- `test:services:down`: `docker compose -f docker-compose.test.yml down`

**Key design decisions:**
- **tmpfs storage:** Tests run 3–5× faster on RAM. No persistence needed — each test creates its own state.
- **Offset ports:** Test Postgres on 5433 (not 5432), test Redis on 6380 (not 6379). Dev and test services can run simultaneously.
- **Separate PgBouncer instance:** Test traffic goes through PgBouncer just like production, catching connection pooling issues early.
- **Faster health check intervals:** 2s for tests vs. 5–10s for dev — CI needs fast startup.

### Acceptance Criteria

- [ ] `docker compose -f docker-compose.test.yml up -d --wait` starts all three test services
- [ ] `docker compose -f docker-compose.test.yml ps` shows all services healthy
- [ ] `psql postgres://everystack_test:test_password@localhost:5433/everystack_test -c "SELECT 1"` succeeds
- [ ] `psql postgres://everystack_test:test_password@localhost:6433/everystack_test -c "SELECT 1"` succeeds (via PgBouncer)
- [ ] `redis-cli -p 6380 PING` returns `PONG`
- [ ] Dev services (docker-compose.yml) and test services (docker-compose.test.yml) can run simultaneously without port conflicts
- [ ] `.env.test.example` is committed to git

### Do NOT Build

- Test framework configuration (Vitest setup is Phase 1E)
- Test factories or data seeding scripts (Phase 1E)
- Staging database seed script (Phase 1E)
- Any actual test files

---

## Prompt 8: GitHub Actions CI Pipeline

**Depends on:** Prompts 1–7 (all prior work)
**Load context:** CLAUDE.md (full — auto-loaded, specifically Pre-Merge Gates section), testing.md lines 693–886 (complete CI Pipeline section)
**Target files:** `.github/workflows/ci.yml`
**Migration required:** No
**Git:** Commit with message `feat(ci): github actions pipeline with all 9 pre-merge gates [Phase 1A, Prompt 8]`

### Schema Snapshot

N/A — no schema changes.

### Task

Create the GitHub Actions CI workflow that enforces all 9 pre-merge gates from CLAUDE.md. This pipeline runs on every push to `main` and every pull request targeting `main`.

**Implement the complete workflow from testing.md lines 697–862, with these jobs:**

**1. `lint` job (runs first):**
- Checkout, setup pnpm, setup Node 20, `pnpm install --frozen-lockfile`
- `pnpm turbo lint` (ESLint — `no-console`, `no-any`)
- `pnpm turbo typecheck` (tsc --noEmit with strict mode)
- `pnpm turbo check:i18n` (no hardcoded English strings)

**2. `unit-test` job (needs: lint):**
- Same checkout + install steps
- Service containers: PostgreSQL (`pgvector/pgvector:pg16` on port 5433 with tmpfs) and Redis (`redis:7-alpine` on port 6380)
- Run migrations: `pnpm turbo db:migrate` (will be a no-op until 1B adds migration files)
- Run tests with coverage: `pnpm turbo test -- --coverage`
- Check coverage thresholds: `pnpm turbo test:coverage-check` (will pass trivially until tests exist)
- Upload coverage to Codecov on PRs

**3. `e2e-test` job (needs: unit-test, only on push to main):**
- Playwright browser install
- Run E2E tests against staging URL (from secrets)
- Upload Playwright report as artifact on failure
- This job will be effectively no-op until E2E tests are written in Phase 1E/Phase 3

**4. `ai-eval` job (needs: lint, conditional on changes to `packages/shared/ai/`):**
- Run AI evaluation suite
- Fails if any template drops below 95% schema compliance
- This job will not trigger until Phase 1H adds AI prompt templates

**5. `migration-check` job (needs: lint, conditional on changes to `packages/shared/db/migrations/`):**
- Service container: PostgreSQL on port 5434 (separate from unit-test)
- Seed staging-scale data: `pnpm turbo db:seed-staging`
- Run migration with timing check: `pnpm turbo db:migrate:check`
- Fails if any migration acquires ACCESS EXCLUSIVE lock >1s or takes >30s on staging data
- This job will not trigger until Phase 1B adds migration files

**6. Concurrency control:**
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```
This cancels in-progress CI runs when a new push arrives on the same branch — prevents queue buildup.

**Important implementation details:**
- Use `pnpm/action-setup@v4` for pnpm installation
- Use `actions/setup-node@v4` with `node-version: 20` and `cache: pnpm`
- Use `--frozen-lockfile` for reproducible installs in CI
- Environment variables for database/Redis use the test service ports and credentials
- The `e2e-test` job uses secrets (`STAGING_URL`, `TEST_USER_EMAIL`, `TEST_USER_PASSWORD`) that won't exist yet — the job simply won't run until they're configured

**Where the workflow references no-op scripts:**
Several turbo tasks (`db:migrate`, `test`, `test:coverage-check`, `db:seed-staging`, `db:migrate:check`, `test:e2e`, `test:ai-eval`) don't have implementations yet. Ensure each workspace package has at minimum a stub script that exits 0 so turbo tasks don't fail. For example, in `apps/web/package.json`, add `"test": "echo 'No tests yet'"` as a placeholder. These will be replaced with real implementations in Phase 1B (migrations) and Phase 1E (tests).

### Acceptance Criteria

- [ ] `.github/workflows/ci.yml` exists and is valid YAML
- [ ] The workflow triggers on `push` to `main` and `pull_request` targeting `main`
- [ ] The `lint` job runs ESLint, TypeScript typecheck, and i18n check
- [ ] The `unit-test` job spins up Postgres and Redis service containers
- [ ] The `e2e-test` job is conditional on `push` to `main` only (not PRs)
- [ ] The `ai-eval` job is conditional on changes to `packages/shared/ai/` paths
- [ ] The `migration-check` job is conditional on changes to `packages/shared/db/migrations/` paths
- [ ] Concurrency group prevents duplicate CI runs on the same branch
- [ ] All stub scripts in workspace packages exit 0 so `turbo` tasks succeed
- [ ] `pnpm turbo lint && pnpm turbo typecheck && pnpm turbo test` all pass locally

### Do NOT Build

- Deployment steps or production deploy pipelines
- Branch protection rules (configured in GitHub UI, not in the workflow file)
- Secrets or environment configuration in GitHub (manual setup)
- Actual test files or migration files
- Staging environment setup

---

## Integration Checkpoint 2 — Final (after Prompts 5–8)

**Task:** Verify the complete Phase 1A deliverable: a fully configured monorepo with tooling, dev services, and CI pipeline.

Run:
1. `pnpm turbo typecheck` — zero TypeScript errors across all packages
2. `pnpm turbo lint` — zero ESLint errors across all packages
3. `pnpm turbo check:i18n` — passes
4. `pnpm turbo test` — all pass (stub scripts exit 0)
5. `docker compose up -d --wait` — all dev services start and become healthy
6. `docker compose -f docker-compose.test.yml up -d --wait` — all test services start and become healthy
7. `pnpm dev --filter=@everystack/web` — Next.js dev server starts at `http://localhost:3000`
8. `curl http://localhost:3000/api/health` — returns `{ status: "ok", ... }`
9. `prettier --check .` — no formatting violations
10. Verify `.github/workflows/ci.yml` exists with all 5 jobs and 9 gate coverage
11. `docker compose down && docker compose -f docker-compose.test.yml down` — clean shutdown

**Manual verification checklist:**
- Directory structure matches the CLAUDE.md Monorepo Structure (apps/web, apps/worker, apps/realtime, packages/shared with db/, sync/, ai/, testing/)
- `turbo.json` has all task definitions from the Key Commands list
- `tsconfig.base.json` has `strict: true`
- `.gitignore` excludes `.env.local`, `node_modules/`, `.next/`, `.turbo/`, `coverage/`
- `.env.example` has all Foundation-phase environment variables

**Git:** Commit with message `chore(verify): integration checkpoint 2 — phase 1A complete [Phase 1A, CP-2]`, push branch to origin, then open PR to `main` with title "Phase 1A — Monorepo, CI Pipeline, Dev Environment".

---

## Dependency Graph

```
Prompt 1 (Monorepo scaffold)
├── Prompt 2 (Next.js web app)
├── Prompt 3 (Worker + realtime)
├── Prompt 4 (Shared package)
│
├── CP-1 (after 1–4)
│
├── Prompt 5 (ESLint + Prettier) ← depends on 1–4
├── Prompt 6 (Docker Compose dev) ← depends on 1
│   └── Prompt 7 (Docker Compose test) ← depends on 6
│
└── Prompt 8 (GitHub Actions CI) ← depends on 1–7
    │
    └── CP-2 — Final (after 5–8)
```

**Parallel execution potential:** After Prompt 1 completes, Prompts 2, 3, 4, and 6 can proceed in parallel. After 1–4 complete, Prompt 5 can proceed. After 6 completes, Prompt 7 can proceed. Prompt 8 depends on everything.

---

## Post-Phase Notes

**What Phase 1B expects to find:**
- A working monorepo with `pnpm install` and `pnpm turbo build` passing
- `packages/shared/db/` directory ready for Drizzle schema files
- `packages/shared/db/migrations/` directory ready for migration files
- Docker Compose with PostgreSQL 16 (pgvector) and PgBouncer running
- Test Docker Compose with tmpfs-backed PostgreSQL for CI
- GitHub Actions CI pipeline ready to run migration-check when migration files appear
- `.env.example` with `DATABASE_URL`, `DATABASE_URL_DIRECT`, and `DATABASE_READ_URL` defined

**What Phase 1E expects to find:**
- `packages/shared/testing/` directory ready for test factories and helpers
- Docker Compose test services for integration tests
- GitHub Actions CI pipeline with `unit-test` job and service containers
- ESLint and TypeScript compilation passing so test files can be added cleanly
