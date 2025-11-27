# How to Write a Test

This document outlines general standards and best practices for writing tests in the Valchecker project. The goal is to ensure code is robust, well-typed, and fully tested.

## Core Principle: 100% Coverage

Every TypeScript source file (`.ts`) **must** be accompanied by a test file (`.test.ts`) that achieves **100% statement, branch, and function coverage** related to the file's runtime behavior.

Tests must validate the logic of the source file, including all success and failure scenarios, edge cases, overloads, and message/issue shapes.

## Test File Structure

Test files should be organized as follows:

### 1. Test Plan Comment

Start every test file with a JSDoc comment that outlines the test plan. The plan serves as a reference for the reviewer and ensures the test’s goals are explicit.

```typescript
/**
 * Test plan for [feature/module name]:
 * - Functions tested: List the functions or classes under test.
 * - Valid inputs: Describe valid scenarios and arguments.
 * - Invalid inputs: Describe invalid scenarios and arguments.
 * - Edge cases: Describe boundary conditions (e.g., empty inputs, zero, null).
 * - Expected behaviors: Describe the expected outcomes for success and failure cases.
 * - Coverage goals: 100% statement, branch, and function coverage.
 */
```

### 2. Setup

Import `vitest` utilities and the modules required for the test.

```typescript
import { describe, expect, it } from 'vitest'
import { functionToTest } from '../my-module'
```

### 3. Describe and It Blocks

Organize tests using nested `describe` blocks for logical grouping and `it` blocks for individual, focused test cases.

```typescript
describe('myFunction', () => {
	describe('valid inputs', () => {
		it('should return a correct value for a valid case', () => {
			// ...
		})
	})

	describe('invalid inputs', () => {
		it('should handle an error case gracefully', () => {
			// ...
		})
	})
})
```

## Test File Standards

To ensure consistency and quality, every `.test.ts` file **must** adhere to these standards:

1.  **Language**: All code, comments, and documentation must be in **English**.
2.  **Indentation**: Use **tabs**, not spaces.
3.  **Line Endings**: Use LF (`\n`).
4.  **Test Plan**: Start every test file with a complete JSDoc test plan.
5.  **Structure**: Use `describe` for grouping and `it` for individual test cases. Organize `describe` blocks logically (e.g., `valid inputs`, `invalid inputs`, `edge cases`).
6.  **Strict Assertions**: Prefer `expect(...).toEqual(...)` for full-object assertions. When necessary, `expect.any()` or partial checks (e.g., `expect.any(Error)`) are acceptable for result fields that vary unpredictably (e.g., runtime-generated messages or Error objects).

## Verification Workflow

After making any changes, run the full verification sequence to ensure code quality and correctness.

1.  **Lint**: `pnpm -w lint`
2.  **Type Check**: `pnpm -w typecheck`
3.  **Test & Coverage**: `pnpm -w test --coverage.include=<path-to-source-file>.ts <path-to-test-file>.test.ts`

**Example for testing a specific step:**
```bash
pnpm -w test --coverage.include=packages/valchecker/src/steps/max/max.ts packages/valchecker/src/steps/max/max.test.ts
```

If any step fails, fix the issues and re-run the entire verification sequence.

## Summary
Ensure each test file declares intent (plan), covers all success/failure paths, validates issue structures strictly, and achieves 100% coverage before merge.

```