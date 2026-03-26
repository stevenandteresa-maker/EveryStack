---
name: monorepo-architecture-pattern
category: architecture
derivedFrom:
  - doc: CLAUDE.md
    section: Monorepo Structure
    sourceHash: placeholder
  - doc: CLAUDE.md
    section: Code Conventions
    sourceHash: placeholder
  - doc: CLAUDE.md
    section: Tech Stack
    sourceHash: placeholder
generatedAt: 2026-03-24T15:06:36Z
ablespecVersion: 0
---

# Monorepo Architecture Pattern

EveryStack uses Turborepo + pnpm workspaces for monorepo management with strict package boundaries and standardized import conventions. All packages follow consistent naming and structure patterns.

## Convention Rules

- MUST use Turborepo for build orchestration and caching
- MUST use pnpm workspaces for dependency management
- MUST use @/ path alias for imports within apps/web
- MUST use @everystack/package-name for shared package imports
- MUST follow kebab-case for file names and directories
- MUST use PascalCase for React component files
- MUST maintain strict package boundaries — no direct file system imports across packages
- MUST place shared utilities in packages/ directory
- MUST use consistent package.json structure across all packages

## Pattern Templates

Covers Package Structure Pattern, Import Convention Pattern, Package.json Pattern, Turborepo Configuration Pattern, File Naming Pattern.

### Package Structure Pattern
```
packages/
├── ui/                    # Shared UI components
│   ├── src/
│   │   ├── components/
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
├── database/              # Database schema and utilities
│   ├── src/
│   │   ├── schema/
│   │   ├── migrations/
│   │   └── index.ts
│   └── package.json
└── shared/                # Shared utilities and types
    ├── src/
    │   ├── types/
    │   ├── utils/
    │   └── index.ts
    └── package.json

apps/
└── web/                   # Main Next.js application
    ├── src/
    │   ├── app/
    │   ├── components/
    │   ├── lib/
    │   └── types/
    ├── package.json
    └── next.config.js
```

### Import Convention Pattern
```typescript
// ✅ Within apps/web - use @/ alias
import { Button } from '@/components/ui/button';
import { getTenantDb } from '@/lib/database';
import { UserSchema } from '@/types/user';

// ✅ Shared packages - use @everystack/ prefix
import { DatabaseClient } from '@everystack/database';
import { validateInput } from '@everystack/shared';
import { Card } from '@everystack/ui';

// ❌ Don't use relative imports across package boundaries
// import { Button } from '../../../packages/ui/src/components/button';

// ❌ Don't use direct file system imports
// import { schema } from '../../packages/database/src/schema/users';
```

### Package.json Pattern
```json
{
  "name": "@everystack/package-name",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "lint": "eslint src/",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    // Package-specific dependencies
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0"
  }
}
```

### Turborepo Configuration Pattern
```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "type-check": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"],
      "inputs": ["src/**/*.tsx", "src/**/*.ts", "test/**/*.ts"]
    }
  }
}
```

### File Naming Pattern
```
// ✅ Correct file naming
src/
├── components/
│   ├── UserProfile.tsx        # PascalCase for components
│   ├── user-settings.tsx      # kebab-case for non-component files
│   └── index.ts
├── lib/
│   ├── database-client.ts     # kebab-case for utilities
│   ├── auth-helpers.ts
│   └── field-type-registry.ts
└── types/
    ├── user-types.ts          # kebab-case for type files
    └── workspace-types.ts

// ❌ Incorrect naming
// UserProfile.js              # Use .tsx for React components
// user_settings.tsx           # Use kebab-case, not snake_case
// databaseClient.ts           # Use kebab-case, not camelCase
```

## Validation Criteria

- All packages have consistent package.json structure with @everystack/ naming
- Import statements use @/ for internal app imports and @everystack/ for shared packages
- No relative imports that cross package boundaries
- File names follow kebab-case convention (PascalCase for React components)
- Turborepo pipeline configuration includes all necessary build steps
- Package dependencies are properly declared in package.json
- TypeScript path mapping is configured for @/ alias in apps/web
- All shared code is properly exported from package index files