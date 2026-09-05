import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { issueCodeProblems } from './issue-code-analysis'
import { fileSystemTree } from './source-tree'
import { discoverSteps } from './step-inventory'

// Enforces the issue-code grammar documented in AGENTS.md: every issue a built-in step owns is
// `<public-step-name>:<snake_case_description>`, where the prefix is that step's `Meta.Name`.
// The type system only guarantees a code belongs to the step's declared union, so a typo or a
// copy-pasted prefix from a neighbouring step is otherwise invisible until it reaches a
// consumer's error handling.
//
// Core codes (`core:*`) are a separate namespace and are not step-owned, so they are not scanned.
//
// The set of steps comes from `step-inventory`, which fails rather than skipping a directory it
// cannot read as a step — a scan that silently misses a step reports a clean grammar for a
// namespace it never looked at.

const root = fileURLToPath(new URL('..', import.meta.url))
const { steps, problems } = discoverSteps(fileSystemTree(root))
const errors: string[] = [...problems]

for (const { directory, name: declaredName, path: relative, source } of steps) {
	if (declaredName !== directory)
		errors.push(`${relative}: Meta.Name '${declaredName}' must match the step directory '${directory}'`)

	errors.push(...issueCodeProblems(declaredName, source, relative))
}

if (errors.length > 0) {
	console.error(errors.join('\n'))
	process.exitCode = 1
}
else {
	console.log('Built-in issue codes are valid.')
}
