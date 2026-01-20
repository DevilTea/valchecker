---
name: valchecker-dev
description: Comprehensive guide for developing Valchecker - a TypeScript validation library. Covers project architecture, development workflows, package structure, testing standards, and common development tasks.
license: MIT
metadata:
  author: DevilTea
  version: "0.0.31"
---

# Valchecker Development Skill

## Overview

This skill provides comprehensive guidance for developing the Valchecker project - a powerful TypeScript value validation and transformation library with plugin-based architecture.

## Project Quick Reference

**Valchecker** is a monorepo containing three packages:
- `valchecker`: Main public API entry point
- `@valchecker/all-steps`: Bundled validation steps
- `@valchecker/internal`: Core engine and 45+ step implementations

See [Architecture Reference](references/ARCHITECTURE.md) for detailed structure.

## Common Development Tasks

### Task 1: Adding a New Validation Step

**When to use**: When adding new validation or transformation functionality

**Process**:

1. Create directory structure:
   ```bash
   mkdir -p packages/internal/src/steps/[stepName]/
   ```

2. Implement the step in `[stepName].ts`:
   - Use `implStepPlugin()` to mark the plugin
   - Implement validation/transformation logic
   - Handle both sync and async operations
   - Reference [Step Implementation Guide](references/STEP_IMPLEMENTATION.md)

3. Create unit tests in `[stepName].test.ts`:
   - 100% test coverage required
   - Test happy paths and edge cases
   - Use helper functions from test utilities

4. Create performance benchmarks in `[stepName].bench.ts`:
   - Benchmark critical operations
   - Use Vitest bench format

5. Export in `packages/all-steps/src/allSteps/allSteps.ts`:
   ```typescript
   import { myStep } from '../../../internal/src/steps/myStep'
   
   export const allSteps: StepPluginImpl[] = [
     // ... other steps
     myStep,
   ]
   ```

6. Run verification:
   ```bash
   pnpm test
   pnpm bench
   pnpm typecheck
   ```

### Task 2: Bug Fixes

**When to use**: Fixing reported issues or test failures

**Process**:

1. Locate the relevant step or core module
2. Write a test that reproduces the issue
3. Verify the test fails
4. Implement the fix
5. Verify the test passes
6. Run full test suite: `pnpm test`
7. Check for performance regressions: `pnpm bench`

### Task 3: Performance Optimization

**When to use**: Improving execution speed or bundle size

**Important**: All optimizations must be benchmarked and show measurable improvement.

**Process**:

1. Identify the bottleneck:
   ```bash
   pnpm bench              # Run all benchmarks
   pnpm bench:watch        # Watch mode for iterative testing
   ```

2. Study the implementation:
   - Review `packages/internal/src/core/core.ts` (especially `createPipeExecutor`)
   - Look for unnecessary allocations and operations
   - Profile hot paths

3. Implement optimization

4. Verify with benchmarks:
   ```bash
   pnpm bench:watch
   ```

5. Ensure no functional regressions:
   ```bash
   pnpm test
   ```

6. Document the optimization in commit message

### Task 4: Type System Changes

**When to use**: Improving type inference, fixing type errors, or enhancing type safety

**Process**:

1. Modify type definitions in `packages/internal/src/core/types.ts`
2. Run type checking: `pnpm typecheck`
3. Update affected steps as needed
4. Verify tests pass: `pnpm test`
5. Update documentation if API changes

### Task 5: Core Logic Modifications

**When to use**: Changing execution engine, error handling, or message system

**Location**: `packages/internal/src/core/core.ts`

**Process**:

1. Understand current implementation
2. Identify all affected code paths
3. Make changes
4. Run comprehensive tests:
   ```bash
   pnpm test              # 1195 line test suite in core.test.ts
   pnpm typecheck
   ```
5. Update tests if needed
6. Verify no performance regression: `pnpm bench`

## Project Structure Details

See [Package Structure Reference](references/PACKAGE_STRUCTURE.md) for:
- Complete directory layout
- File responsibilities
- Entry points and exports
- Dependencies between packages

## Testing Standards

### Test Coverage Requirements
- New features: **100% coverage required**
- Bug fixes: Include regression test
- Modifications: Update existing tests

### Test Locations
- Unit tests: `packages/*/src/**/*.test.ts`
- Performance tests: `packages/*/src/**/*.bench.ts`
- Core tests: `packages/internal/src/core/core.test.ts` (1195 lines)

### Testing Commands
```bash
pnpm test                 # Single run, all tests
pnpm test:watch          # Watch mode for development
pnpm bench               # Run performance benchmarks
pnpm bench:watch         # Watch mode for benchmarks
```

## Git and Release Workflow

### Branching Strategy
- `main`: Stable production version
- `feature/*`: New features
- `fix/*`: Bug fixes
- `perf/*`: Performance improvements

### Commit Message Format
```
type(scope): short description

Optional body explaining the change
and any breaking changes or notes.
```

**Commit types**:
- `feat`: New feature
- `fix`: Bug fix
- `perf`: Performance improvement
- `refactor`: Code refactoring
- `chore`: Build, dependencies, tooling
- `docs`: Documentation updates
- `test`: Test additions/modifications

### Release Process
```bash
pnpm release
# Performs:
# 1. Build all packages
# 2. Build documentation
# 3. Type checking
# 4. Linting (publint)
# 5. Version bumping
# 6. Rebuild
# 7. Publish to npm
```

## Essential Commands Reference

| Command | Purpose |
|---------|---------|
| `pnpm install` | Install dependencies |
| `pnpm stub` | Development mode with watch compilation |
| `pnpm build` | Build all packages |
| `pnpm test` | Run all tests once |
| `pnpm test:watch` | Watch mode for tests |
| `pnpm bench` | Run performance benchmarks |
| `pnpm bench:watch` | Watch mode for benchmarks |
| `pnpm lint` | Run ESLint with auto-fix |
| `pnpm typecheck` | Type checking across all packages |
| `pnpm docs:dev` | Documentation development server |
| `pnpm docs:build` | Build documentation site |
| `pnpm release` | Full release process |

## Quality Standards

### Code Quality
- ✅ **TypeScript strict mode**: Enforced
- ✅ **Type coverage**: 100% required for new code
- ✅ **ESLint**: All rules must pass
- ✅ **Test coverage**: 100% for new code
- ✅ **Performance**: Benchmarks must not regress

### Build Requirements
- All tests must pass
- Type checking must pass
- Linting must pass
- Performance benchmarks must show no regression

## Code Style Guidelines

- Use TypeScript strict mode
- Follow ESLint configuration
- Write clear, self-documenting code
- Use English for all comments and documentation
- Optimize for both readability and performance

## Package Overview

### valchecker (Main API)
- **Location**: `packages/valchecker/`
- **Purpose**: Public entry point
- **Main Export**: `createValchecker()` function
- **Dependency**: Both other packages

### @valchecker/all-steps
- **Location**: `packages/all-steps/`
- **Purpose**: Convenience bundle of all steps
- **Main File**: `src/allSteps/allSteps.ts`
- **Exports**: Pre-configured step array

### @valchecker/internal
- **Location**: `packages/internal/`
- **Purpose**: Core implementation
- **Contains**:
  - `src/core/`: Execution engine
  - `src/steps/`: 45+ validation steps
  - `src/shared/`: Utilities and helpers

## When to Use External References

Detailed guidance documents in `references/` folder:

- **ARCHITECTURE.md**: Deep dive into project structure
- **STEP_IMPLEMENTATION.md**: How to implement new steps
- **PLUGIN_SYSTEM.md**: Plugin architecture details
- **TYPE_SYSTEM.md**: Type inference and evolution
- **PERFORMANCE_OPTIMIZATION.md**: Performance best practices

Load these on demand when tackling specific tasks.

## Quick Start for New Contributors

1. **Setup**: `pnpm install && pnpm stub`
2. **Understand**: Review ARCHITECTURE.md reference
3. **Pick a task**: Look at GitHub issues
4. **Follow the process**: Use task-specific guidance above
5. **Verify**: Run `pnpm test && pnpm typecheck`
6. **Commit**: Follow commit message format
7. **Submit**: Push to feature branch and create PR

## Common Pitfalls to Avoid

1. **Type errors**: Always run `pnpm typecheck` before committing
2. **Test coverage**: New code without 100% test coverage will be rejected
3. **Performance regressions**: Always benchmark before optimizing
4. **Breaking changes**: Consider backward compatibility
5. **English documentation**: All comments must be in English
6. **Node version**: Requires Node.js 24+

## Support and Questions

- Check existing issues on GitHub
- Review AGENTS.md for constitutional principles
- Consult reference documents for specific tasks
- Examine existing steps for implementation patterns

---

**Version**: 0.0.31
**Last Updated**: January 20, 2026
