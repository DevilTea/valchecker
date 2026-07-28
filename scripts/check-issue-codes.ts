import process from 'node:process'
import { fileURLToPath } from 'node:url'
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
const descriptionPattern = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/
const { steps, problems } = discoverSteps(fileSystemTree(root))
const errors: string[] = [...problems]

function declaredCodes(source: string): string[] {
	const codes: string[] = []
	const marker = 'ExecutionIssue<'
	let index = source.indexOf(marker)

	while (index !== -1) {
		const quote = source.indexOf('\'', index + marker.length)
		if (quote !== -1) {
			const end = source.indexOf('\'', quote + 1)
			if (end !== -1)
				codes.push(source.slice(quote + 1, end))
		}
		index = source.indexOf(marker, index + marker.length)
	}

	return codes
}

for (const { directory, name: declaredName, path: relative, source } of steps) {
	if (declaredName !== directory)
		errors.push(`${relative}: Meta.Name '${declaredName}' must match the step directory '${directory}'`)

	for (const code of declaredCodes(source)) {
		const separator = code.indexOf(':')
		if (separator === -1) {
			errors.push(`${relative}: issue code '${code}' must be <step-name>:<snake_case_description>`)
			continue
		}

		const prefix = code.slice(0, separator)
		const description = code.slice(separator + 1)

		if (prefix !== declaredName)
			errors.push(`${relative}: issue code '${code}' must be prefixed with '${declaredName}'`)
		if (!descriptionPattern.test(description))
			errors.push(`${relative}: issue code '${code}' description must be snake_case`)
	}
}

if (errors.length > 0) {
	console.error(errors.join('\n'))
	process.exitCode = 1
}
else {
	console.log('Built-in issue codes are valid.')
}
