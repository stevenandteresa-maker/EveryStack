---
name: glossary-terminology-discipline
category: naming-convention
derivedFrom:
  - doc: docs/GLOSSARY.md
    section: GLOSSARY
    sourceHash: placeholder
  - doc: CLAUDE.md
    section: Critical Rules — Do's and Don'ts
    sourceHash: placeholder
generatedAt: 2026-03-24T15:06:36Z
ablespecVersion: 0
---

# Glossary Terminology Discipline

EveryStack maintains strict terminology discipline through GLOSSARY.md. All code, comments, UI text, and documentation must use exact glossary terms — never synonyms, abbreviations, or invented alternatives.

## Convention Rules

- MUST check GLOSSARY.md for the correct name of every concept before using it in code, comments, or UI text
- MUST use glossary terms exactly as defined — no synonyms or abbreviations
- MUST NOT invent new names for existing concepts
- MUST verify MVP scope in glossary before building any feature
- MUST use glossary-compliant field names, variable names, and type names
- MUST reference glossary terms in error messages and user-facing text
- MUST update glossary when introducing new domain concepts

## Pattern Templates

Covers Code Naming Pattern, UI Text Pattern, Error Message Pattern, Database Schema Pattern, Type Definition Pattern.

### Code Naming Pattern
```typescript
// ✅ Use exact glossary terms
interface TableView {
  id: string;
  name: string;
  workspaceId: string;
  // ...
}

// ✅ Function names use glossary terminology
function createSharedView(params: CreateSharedViewParams) {
  // Implementation
}

// ❌ Don't use synonyms or abbreviations
// interface View { } // Too generic
// interface TableInterface { } // Wrong term
// function createView() { } // Ambiguous
```

### UI Text Pattern
```typescript
// ✅ Use exact glossary terms in UI
const messages = {
  createTableView: "Create Table View",
  shareTableView: "Share this Table View with team members",
  workspaceSettings: "Workspace Settings",
  crossLinkField: "Cross-Link Field",
};

// ❌ Don't use synonyms in UI
// createInterface: "Create Interface"
// shareView: "Share this view"
// boardSettings: "Board Settings"
// relationField: "Relation Field"
```

### Error Message Pattern
```typescript
// ✅ Use glossary terms in error messages
throw new AppError(
  "You don't have permission to access this Table View",
  403
);

throw new AppError(
  "Cross-Link field cannot reference tables in different tenants",
  422
);

// ❌ Don't use non-glossary terms
// "You don't have permission to access this interface"
// "Relation field cannot reference boards in different orgs"
```

### Database Schema Pattern
```sql
-- ✅ Use glossary-compliant table and column names
CREATE TABLE workspace_memberships (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role workspace_role NOT NULL
);

-- ❌ Don't use non-glossary terms
-- CREATE TABLE board_memberships
-- CREATE TABLE interface_permissions
```

### Type Definition Pattern
```typescript
// ✅ Types use exact glossary terminology
type WorkspaceRole = 'manager' | 'team_member' | 'viewer';
type TenantRole = 'owner' | 'admin' | 'member';
type FieldType = 'text' | 'number' | 'date' | 'cross_link' | 'attachment';

// ❌ Don't deviate from glossary
// type BoardRole = 'manager' | 'member' | 'viewer';
// type OrgRole = 'owner' | 'admin' | 'user';
// type RelationType = 'one_to_many' | 'many_to_many';
```

## Validation Criteria

- All variable names, function names, and type names use glossary-compliant terminology
- Database table and column names match glossary entity definitions
- UI strings and error messages use exact glossary terms
- No synonyms or abbreviations are used in place of defined terms
- Code comments reference concepts using glossary terminology
- API endpoint paths and parameter names follow glossary naming
- Test descriptions and factory names use glossary terms
- Documentation consistently uses glossary terminology throughout