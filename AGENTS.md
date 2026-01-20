# Valchecker Development Constitution

This document outlines the core principles and requirements for AI agents developing Valchecker.

## Core Values

### 1. Type Safety First
- All code must use TypeScript strict mode
- 100% type coverage is the baseline, not the goal
- Type errors are build blockers

### 2. Performance is Non-Negotiable
- Every optimization must be benchmarked
- Performance regressions are not acceptable
- Hot paths are documented and optimized

### 3. Testing is Mandatory
- New features require 100% test coverage
- Tests must validate both happy paths and edge cases
- Performance tests are required for optimizations

### 4. Documentation in English
- All code comments must be written in English
- All documentation files must be in English
- Configuration and commit messages must be in English

## Project Structure

Valchecker is a monorepo with three core packages:

```
packages/
├── valchecker/      # Public API entry point
├── all-steps/       # Bundled validation steps
└── internal/        # Core engine and step implementations
```

## Essential Commands

```bash
pnpm install         # Install dependencies
pnpm stub           # Development mode with watch
pnpm build          # Build all packages
pnpm test           # Run all tests
pnpm test:watch     # Watch test mode
pnpm bench          # Run performance benchmarks
pnpm lint           # Lint and format code
pnpm typecheck      # Run type checking
```

## Development Workflow

### Adding a New Step
1. Create `packages/internal/src/steps/[name]/[name].ts`
2. Implement with `implStepPlugin()` wrapper
3. Create `[name].test.ts` with 100% coverage
4. Create `[name].bench.ts` for performance testing
5. Export in `packages/all-steps/src/allSteps/allSteps.ts`

### Modifying Core Logic
- Type changes → `packages/internal/src/core/types.ts`
- Execution logic → `packages/internal/src/core/core.ts`
- All changes require test coverage and benchmarks

### Bug Fixes
- Verify tests reproduce the issue
- Fix the implementation
- Ensure all tests pass

## Git Conventions

### Branches
- `main`: Stable production version
- `feature/*`: New features
- `fix/*`: Bug fixes
- `perf/*`: Performance improvements

### Commit Messages
```
type(scope): description

[optional body]
```

Types: `feat`, `fix`, `perf`, `refactor`, `chore`, `docs`, `test`

## Quality Gates

- ✅ All tests must pass
- ✅ TypeScript strict mode compliance
- ✅ ESLint rules must pass
- ✅ Performance benchmarks must not regress
- ✅ 100% test coverage required for new code

## External References

For detailed guidance on specific development tasks, skills are available in `.github/skills/valchecker-dev/`.

Use the `skill` tool to access comprehensive instructions for:
- Adding validation steps
- Optimizing performance
- Debugging type issues
- Working with async operations
- Contributing to the project

---

**Version**: 0.0.31
**Maintainer**: DevilTea
**Last Updated**: January 20, 2026
