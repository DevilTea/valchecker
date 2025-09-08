# AGENTS.md

This project is a monorepo managed with pnpm workspaces, containing multiple packages. Each package is written in TypeScript and aims for high code quality with linting, type checking, and comprehensive testing using Vitest.

## Tech Stack
- Node: 22.x
- Language: TypeScript
- Package manager: pnpm
- Monorepo: pnpm workspaces
- Test framework: vitest

## Scripts
- Lint: `pnpm -w lint`
- Typecheck: `pnpm -w typecheck`
- Build: `pnpm -w build`
- Test: `pnpm -w test` (Coverage enabled by default)

## Global Conventions / Rules
- Write `code`, `comments`, `docs` in English.
- Use **tabs** for indentation, no spaces.
- Line endings: LF (`\n`).
- Aim for **100% code coverage** on all source files.
- Do not modify `/node_modules`, `/dist`, generated files
- It's allowed and recommended to store any agent's temporary notes, thoughts, plans in `<project_root>/.agents/` folder.
- Always run lint, typecheck, and test commands after any changes to verify correctness.
- All `index.ts` files are only for re-exports and do not require tests or specifications.
- Every source file (`<example>.ts`) must have a paired specification (`<example>.spec.md`) and test file (`<example>.test.ts`).
	- `<example>.spec.md`:
		```markdown
		# <example>.spec.md

		Source File: `./<example>.ts`

		## Functionality Summary
		- <brief description of `<example>.ts` functionality>

		## Exported Items (Functions, Classes, Constants, TS Types, etc.)
		- `exportedItem1`
			- Description: <brief description>
			- Input: <brief description of input>
			- Output: <brief description of output>
		- `exportedItem2`
			- ...

		## Test Cases (as strictly required for 100% coverage)
		- `exportedItem1`
			- Happy Path Cases
				- [ ] case 1: <description>
					- Input: ...
					- Expected: ...
				- [ ] case 2: ...
			- Edge Cases
				- [ ] case 1: ...
			- Error Cases (if applicable)
				- [ ] case 1: ...
		- `exportedItem2`
			- ...
		```
	- `<example>.test.ts`:
		```ts
		import { describe, expect, it } from 'vitest'
		import { exportedItem1 } from './<example>'

		describe('tests of `exportedItem1`', () => {
			describe('happy path cases', () => {
				describe('case 1', () => {
					it('should <case description>', () => {
						const result = exportedItem1(/* input */)
						expect(result).toEqual(/* expected */)
					})
				})
			})
			describe('edge cases', () => {
				// ...
			})
			describe('error cases', () => {
				// ...
			})
		})
		```
- When processing test file's failures or type errors, always assume the source file is correct and do not modify it unless you have explicit reason to believe it's wrong and user agrees to modify it.

## Workflows
- Analyze `<specific_dir>` for spec/test updates
	1. Scan all source files in `<specific_dir>`, check if they have paired spec and test files.
	2. For each source file, check if the paired spec and test files are up-to-date and fully follow the format in **Global Conventions**.
	3. Collect all source files that need updates (missing spec/test, outdated spec/test, not following format).
	4. Print the list of files that need updates, and ask user for confirmation to proceed with updates.
	5. If user confirms, sort the list of files by complexity (e.g. lines of code, number of exports) and process them one by one using the **Update spec/test for a specific source file** workflow.

- Update spec/test for a specific source file `<path_to_source>.ts`
	1. After analyzing `<path_to_source>.ts`, write a complete specification in `<path_to_source>.spec.md` following the format in **Global Conventions**.
		- If the spec already exists, ensure it is up-to-date, every exported item is covered and fully follows the format.
	2. Run Lint, If any issues, fix them.
	3. Check the `<path_to_source>.test.ts` file, ensure it aligns with the section `Test Cases` of `<path_to_source>.spec.md`.
	4. Run Test + Run Lint + Run Typecheck, collect failures, issues and coverage report.
		- If any tests fail or issues, fix them. Re-run starting from `4.` until all pass.
		- If coverage < 100%, re-run starting from `1.` until coverage is 100%.
