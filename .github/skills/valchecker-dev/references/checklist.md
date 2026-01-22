# PR Checklist

Complete this checklist before submitting a pull request.

## Pre-Submission Checks

### Code Quality
- [ ] Code follows [code style conventions](./conventions.md)
- [ ] All steps have `/* @__NO_SIDE_EFFECTS__ */` annotation
- [ ] No TypeScript errors (strict mode)
- [ ] Linting passes

### Testing
- [ ] All tests pass: `pnpm test`
- [ ] New tests have 100% coverage
- [ ] Coverage reports no regressions: `pnpm test --coverage`
- [ ] Tests cover:
  - Valid inputs
  - Invalid inputs
  - Custom messages (string and function)
  - Chaining with other steps
  - Edge cases

### Benchmarks
- [ ] Benchmark file exists: `[step-name].bench.ts`
- [ ] Benchmarks run without errors: `pnpm bench`
- [ ] Performance is reasonable

### Documentation
- [ ] JSDoc includes:
  - Description section
  - Example section
  - Issues section
- [ ] All issue codes documented

### Exports
- [ ] Step added to `packages/internal/src/steps/[step-name]/index.ts`
- [ ] Step exported from `packages/internal/src/steps/index.ts`
- [ ] Step added to `packages/all-steps/src/allSteps/allSteps.ts` if applicable

## Full Verification

Run this before committing:

```bash
pnpm lint && pnpm typecheck && pnpm test --coverage && pnpm bench
```

All commands must complete successfully.

## Commit Message Format

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type
- `feat`: New feature (new step)
- `fix`: Bug fix
- `docs`: Documentation changes
- `test`: Test changes
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `chore`: Tooling changes

### Scope
- `step`: Changes to step implementations
- `core`: Changes to core types/functions
- `docs`: Documentation changes
- `tests`: Test infrastructure

### Subject
- Use imperative mood ("add" not "adds" or "added")
- Don't capitalize first letter
- No period at the end
- Max 50 characters

### Examples

```
feat(step): add new maximum step for constraints

docs: update step implementation guide

fix(core): correct type inference for unions

test: add coverage for edge cases
```

## PR Description Template

```markdown
## Summary
Brief description of changes.

## Changes
- Change 1
- Change 2
- Change 3

## Testing
- [ ] All tests pass
- [ ] New tests for edge cases
- [ ] Coverage maintained at 100%

## Checklist
- [ ] Follows code style
- [ ] Documentation updated
- [ ] JSDoc complete
- [ ] Benchmarks added
- [ ] Commits use conventional format
```

## Common Issues

### Coverage not at 100%
```bash
# Find uncovered lines
pnpm test --coverage -- --reporter=text

# Identify lines not covered
# Add tests to cover them
```

### Type errors
```bash
# Check TypeScript strict mode
pnpm typecheck

# Fix any type errors
# Avoid using 'any' unless justified
```

### Linting errors
```bash
# Run linter
pnpm lint

# Auto-fix if possible
pnpm lint -- --fix
```

### Benchmark regressions
- If new code is significantly slower, investigate
- Profile the code if needed
- Optimize hot paths
- Add comments explaining performance decisions

## Review Process

After submitting:

1. **Automated checks** run (tests, linting, coverage)
2. **Code review** by maintainers
3. **Additional tests** may be requested
4. **Updates** may be needed based on feedback
5. **Merge** once approved

## After Merge

- Monitor for issues in production
- Respond to bug reports quickly
- Update documentation if needed
- Patch versions may be released for critical fixes
