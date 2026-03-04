# Prompt Templates

This directory holds versioned prompt templates for AI features.

Templates are registered in code via `PromptRegistry.register()`.
Each template file exports a `PromptTemplate` object.

## Naming Convention

Files are named `{feature-name}.ts` (kebab-case), matching the template ID.

## Example Template Structure

```typescript
// import type { PromptTemplate } from '../registry';
//
// export const recordSummarization: PromptTemplate = {
//   id: 'record_summarization',
//   version: 1,
//   description: 'Summarize a record into a human-readable paragraph.',
//   capabilityTier: 'fast',
//   systemInstruction:
//     'You are a data assistant. Summarize the following record for table "{{tableName}}".\n' +
//     'Focus on the most important fields and relationships.',
//   outputSchema: {
//     type: 'object',
//     properties: {
//       summary: { type: 'string' },
//     },
//     required: ['summary'],
//   },
//   variables: [
//     {
//       name: 'tableName',
//       type: 'string',
//       required: true,
//       description: 'The name of the table containing the record.',
//     },
//   ],
//   examples: [
//     {
//       input: 'Record: { name: "Acme Corp", status: "Active", revenue: 1200000 }',
//       expectedOutput: '{"summary": "Acme Corp is an active account with $1.2M in revenue."}',
//     },
//   ],
//   testedWith: [
//     { providerId: 'anthropic', modelId: 'claude-haiku-4-5-20251001', passRate: 0.97 },
//   ],
//   createdAt: '2026-03-04T00:00:00Z',
//   changelog: 'Initial version.',
// };
```

Actual templates will be added in Phase 5 (AI Features).
