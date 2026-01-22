# AGENTS.md

## Project Overview

Valchecker is a modular TypeScript validation library with composable steps, full type inference, and deterministic issue reporting. It follows Standard Schema V1 specification.

**Repository structure:**
```
packages/
├── internal/         # @valchecker/internal - Core types, functions, and 46+ step plugins
├── all-steps/        # @valchecker/all-steps - Convenience export of all steps
└── valchecker/       # valchecker - Main package re-exporting both
docs/                 # VitePress documentation site
```

## Setup Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start docs dev server
pnpm docs:dev

# Run tests
pnpm test

# Run tests with coverage
pnpm test --coverage

# Run benchmarks
pnpm bench

# Lint and fix
pnpm lint

# Type check
pnpm typecheck
```

## Code Style

- TypeScript strict mode enabled
- Single quotes, no semicolons
- Tabs for indentation
- Functional patterns preferred
- Use `/* @__NO_SIDE_EFFECTS__ */` annotation for tree-shakable exports
- Follow existing patterns in `packages/internal/src/steps/`

## File Structure for Steps

Every validation step must follow this structure:
```
packages/internal/src/steps/[step-name]/
├── [step-name].ts       # Implementation (required)
├── [step-name].test.ts  # Tests with 100% coverage (required)
├── [step-name].bench.ts # Benchmarks (required)
└── index.ts             # Re-export (required)
```

## Step Implementation Pattern

Steps follow a three-layer pattern:

1. **Meta** - Define step metadata (name, expected context, issues)
2. **PluginDef** - Define TypeScript interface with JSDoc
3. **Implementation** - Runtime logic using `implStepPlugin()`

```typescript
// Example: See packages/internal/src/steps/string/string.ts
type Meta = DefineStepMethodMeta<{
	Name: 'stepName'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: ExecutionIssue<'stepName:issue_code', { value: unknown }>
}>

interface PluginDef extends TStepPluginDef {
	/** JSDoc with Description, Example, and Issues sections */
	stepName: DefineStepMethod<Meta, /* method signature */>
}

export const stepName = implStepPlugin<PluginDef>({
	stepName: ({ utils, params }) => {
		utils.addSuccessStep((value) => {
			// validation logic
		})
	},
})
```

## Testing Requirements

- **100% code coverage required** for all step implementations
- Tests use Vitest
- Cover: valid inputs, invalid inputs, custom messages, chaining, async behavior
- Run `pnpm test --coverage` to verify

Test file template:
```typescript
/**
 * Test plan for [step] step:
 * - Functions tested: ...
 * - Valid inputs: ...
 * - Invalid inputs: ...
 * - Edge cases: ...
 * - Coverage goals: 100%
 */
describe('stepName plugin', () => {
	describe('valid inputs', () => { /* ... */ })
	describe('invalid inputs', () => { /* ... */ })
	describe('custom messages', () => { /* ... */ })
	describe('chaining', () => { /* ... */ })
})
```

## Issue Code Convention

Format: `[step-name]:[snake_case_description]`

Examples:
- `string:expected_string`
- `number:expected_number`
- `check:failed`
- `min:expected_min`

## PR Instructions

1. Run full verification before committing:
   ```bash
   pnpm lint && pnpm typecheck && pnpm test
   ```

2. Commit message format (conventional commits):
   - `feat(step): add new step`
   - `fix(core): fix issue in core`
   - `docs: update documentation`
   - `test: add tests`
   - `refactor: refactor code`

3. Ensure all tests pass and coverage remains at 100% for modified steps

## Key Files Reference

| File | Purpose |
|------|---------|
| `packages/internal/src/core/types.ts` | All TypeScript type definitions |
| `packages/internal/src/core/core.ts` | Core implementation (createValchecker, implStepPlugin) |
| `packages/internal/src/steps/index.ts` | All steps exports |
| `packages/all-steps/src/allSteps/allSteps.ts` | Dynamic step collection |

## Agent Skills

For more detailed guidance:
- **valchecker-dev**: `.github/skills/valchecker-dev/` - For developing valchecker itself
- **valchecker-expert**: `.github/skills/valchecker-expert/` - For using valchecker in projects
