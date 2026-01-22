---
name: valchecker-dev
description: Comprehensive guide for developing and contributing to the Valchecker validation library. Use this skill when working on the valchecker codebase itself - adding new steps, fixing bugs, or improving core functionality.
---

# Valchecker Development Guide

This skill provides guidance for contributing to the Valchecker validation library. Use this when developing new features, fixing bugs, or improving existing functionality within the valchecker repository.

## Quick Start

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Run tests with coverage
pnpm test --coverage

# Type check
pnpm typecheck

# Lint
pnpm lint
```

## Project Structure

Valchecker is a pnpm monorepo with three packages:

```
valchecker/
├── packages/
│   ├── internal/         # @valchecker/internal - Core implementation
│   │   ├── src/
│   │   │   ├── core/     # Core types and functions
│   │   │   ├── steps/    # 47+ validation step plugins
│   │   │   └── shared/   # Shared utilities
│   ├── all-steps/        # @valchecker/all-steps - Convenience export
│   └── valchecker/       # valchecker - Main package
├── docs/                 # VitePress documentation site
└── AGENTS.md             # Quick reference for AI agents
```

## Documentation

This skill is organized into modular guides:

### Core Development
- [**Architecture**](./references/architecture.md) - The three-layer step pattern
- [**Utils API**](./references/utils-api.md) - Available utility functions
- [**Conventions**](./references/conventions.md) - Code style and naming

### Quality Assurance
- [**Testing**](./references/testing.md) - 100% coverage requirements and patterns
- [**Benchmarking**](./references/benchmarking.md) - Performance tracking
- [**PR Checklist**](./references/checklist.md) - Before submitting

### Learning
- [**Implementation Examples**](./references/examples.md) - Reference implementations of common patterns

## Key Concepts

### Three-Layer Pattern

Every validation step follows this pattern:

1. **Meta** - Type metadata definition
2. **PluginDef** - TypeScript interface with JSDoc
3. **Implementation** - Runtime validation logic

See [Architecture Guide](./references/architecture.md) for details.

### Step Categories

- **Primitives**: `string`, `number`, `boolean`, `bigint`, `symbol`
- **Types**: `literal`, `unknown`, `any`, `never`, `null_`, `undefined_`
- **Structures**: `object`, `strictObject`, `looseObject`, `array`, `union`, `intersection`, `instance`
- **Constraints**: `min`, `max`, `empty`, `integer`, `startsWith`, `endsWith`
- **Transforms**: `transform`, `toTrimmed`, `toLowercase`, `toUppercase`, `toFiltered`, `toSorted`, `toSliced`, `toLength`, `toSplitted`, `toString`, `parseJSON`, `stringifyJSON`, `toAsync`
- **Flow Control**: `check`, `fallback`, `use`, `as`, `generic`
- **Loose Variants**: `looseNumber`
- **Other**: `json`

### Issue Code Format

`[step-name]:[snake_case_description]`

Examples:
- `string:expected_string`
- `number:expected_number`
- `min:expected_min`
- `check:failed`

## Common Tasks

### Adding a New Step

1. Create directory: `packages/internal/src/steps/[step-name]/`
2. Implement three files:
   - `[step-name].ts` - Step implementation
   - `[step-name].test.ts` - Tests (100% coverage required)
   - `[step-name].bench.ts` - Benchmarks
   - `index.ts` - Re-export
3. Add to `packages/internal/src/steps/index.ts`
4. Add to `packages/all-steps/src/allSteps/allSteps.ts` if applicable
5. See [Examples](./references/examples.md) for reference implementations

### Testing

```bash
# Run all tests
pnpm test

# Run with coverage (must be 100%)
pnpm test --coverage

# Run specific test file
pnpm test packages/internal/src/steps/step-name
```

Coverage must be 100% for all step implementations. See [Testing Guide](./references/testing.md).

### Linting and Type Checking

```bash
# Check types (strict mode)
pnpm typecheck

# Run linter
pnpm lint

# Both together
pnpm lint && pnpm typecheck
```

### Benchmarking

```bash
# Run all benchmarks
pnpm bench

# Track performance of steps
pnpm bench -- --reporter=verbose
```

See [Benchmarking Guide](./references/benchmarking.md).

### Before Submitting PR

```bash
# Full verification
pnpm lint && pnpm typecheck && pnpm test --coverage && pnpm bench
```

All commands must pass. See [PR Checklist](./references/checklist.md) for details.

## File Structure for Steps

Every step MUST follow this structure:

```
packages/internal/src/steps/[step-name]/
├── [step-name].ts       # Implementation (required)
├── [step-name].test.ts  # Tests with 100% coverage (required)
├── [step-name].bench.ts # Benchmarks (required)
└── index.ts             # Re-export (required)
```

## Code Style

- **TypeScript strict mode** enabled
- **Single quotes**, no semicolons
- **Tabs** for indentation
- **Functional patterns** preferred
- Use `/* @__NO_SIDE_EFFECTS__ */` annotation for tree-shaking
- Follow existing patterns in `packages/internal/src/steps/`

See [Conventions Guide](./references/conventions.md) for details.

## Troubleshooting

### Type Errors
- Check `ExpectedCurrentValchecker` matches required input
- Verify `SelfIssue` code matches `createIssue` code
- Ensure `Next<>` generics are correct

### Coverage Issues
- Run `pnpm test --coverage` to identify uncovered lines
- Add tests for all code paths
- Test both success and failure conditions

### Performance Concerns
- Profile slow steps with benchmarks
- Check for unnecessary operations
- Consider caching if applicable

## References

- **Key Files**:
  - `packages/internal/src/core/types.ts` - All TypeScript type definitions
  - `packages/internal/src/core/core.ts` - Core implementation
  - `packages/internal/src/steps/index.ts` - All steps exports
  - `packages/all-steps/src/allSteps/allSteps.ts` - Dynamic step collection

- **External**:
  - [Valchecker Docs](https://valchecker.dev) - User documentation
  - [GitHub Repository](https://github.com/anomalyco/valchecker) - Source code

## Getting Help

- Check [Architecture Guide](./references/architecture.md) for pattern questions
- See [Implementation Examples](./references/examples.md) for reference code
- Review [Testing Guide](./references/testing.md) for test structure
- Check [PR Checklist](./references/checklist.md) before submitting

For more help, refer to existing step implementations in `packages/internal/src/steps/`.
