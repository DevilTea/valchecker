# Code Style and Conventions

Guidelines for writing code in the Valchecker project.

## Code Style

- **TypeScript strict mode** is enabled - no `any` types without justification
- **Single quotes** for strings, no semicolons
- **Tabs** (not spaces) for indentation
- **Functional patterns** preferred over object-oriented
- Use `/* @__NO_SIDE_EFFECTS__ */` annotation before exports for tree-shaking

## Issue Code Convention

Format: `[step-name]:[snake_case_description]`

### Good Examples
- `string:expected_string`
- `number:expected_number`
- `min:expected_min`
- `check:failed`

### Bad Examples
- `STRING_ERROR` - Wrong format (all caps)
- `invalidEmail` - Missing step prefix
- `min-error` - Use underscores, not dashes
- `min:expected-min` - Use underscores in descriptions

## File Naming

Step files follow a consistent pattern:

```
packages/internal/src/steps/[step-name]/
├── [step-name].ts       # Implementation
├── [step-name].test.ts  # Tests
├── [step-name].bench.ts # Benchmarks
└── index.ts             # Re-export
```

**Examples:**
- `string/string.ts` - String step implementation
- `min/min.ts` - Min constraint step
- `toTrimmed/toTrimmed.ts` - Transform step

## Naming Conventions

### Steps
- **Constraint steps**: `lowercase` (e.g., `min`, `max`, `empty`)
- **Transform steps**: `toCamelCase` (e.g., `toTrimmed`, `toLowercase`)
- **Validation steps**: `lowercase` (e.g., `check`, `use`)
- **Type steps**: `lowercase` (e.g., `string`, `number`, `object`)

### Issue Codes
- Step name + colon + description in snake_case
- Examples: `string:expected_string`, `min:expected_min`

### TypeScript Types
- `Meta` - Type metadata
- `PluginDef` - Plugin definition interface
- `SelfIssue` - Issue type for the step

## JSDoc Documentation

Every step method must have comprehensive JSDoc:

```typescript
/**
 * ### Description:
 * What the step does and when to use it.
 *
 * ---
 *
 * ### Example:
 * ```ts
 * const v = createValchecker({ steps: [string, stepName] })
 * const schema = v.string().stepName()
 * ```
 *
 * ---
 *
 * ### Issues:
 * - `'stepName:issue_code'`: Description of when this issue occurs.
 */
```

### JSDoc Sections

1. **Description** - What the step does
2. **Example** - How to use it
3. **Issues** - What errors it can produce

## Tree-Shaking Annotation

Always add before step exports:

```typescript
/* @__NO_SIDE_EFFECTS__ */
export const stepName = implStepPlugin<PluginDef>({
  // ...
})
```

This tells bundlers that the export has no side effects and can be eliminated if unused.

## Import Organization

Group imports logically:

```typescript
// 1. External/library imports
import { describe, expect, it } from 'vitest'

// 2. Internal core imports
import { createValchecker, implStepPlugin } from '@valchecker/internal'

// 3. Other internal imports
import { string } from '../string'
import { number } from '../number'
```

## Comments

Use comments sparingly - code should be self-documenting:

```typescript
// ✓ Good - explains WHY
// Filter out zero values because they're invalid in this context
const nonZero = values.filter(v => v !== 0)

// ✗ Bad - explains WHAT (already clear from code)
// Filter values
const nonZero = values.filter(v => v !== 0)
```

## Error Messages

Error messages should be clear and actionable:

```typescript
// ✓ Good - specific and helpful
'Expected string, got number'
'Expected minimum value of 10, got 5'

// ✗ Bad - vague
'Invalid input'
'Type error'
```

## Exports

Each step directory must have an `index.ts` that re-exports:

```typescript
// packages/internal/src/steps/string/index.ts
export * from './string'
```

Then add to the main steps export:

```typescript
// packages/internal/src/steps/index.ts
export * from './string'
export * from './number'
// ... etc
```
