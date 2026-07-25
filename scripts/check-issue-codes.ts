import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

// Enforces the issue-code grammar documented in AGENTS.md: every issue a built-in step owns is
// `<public-step-name>:<snake_case_description>`, where the prefix is that step's `Meta.Name`.
// The type system only guarantees a code belongs to the step's declared union, so a typo or a
// copy-pasted prefix from a neighbouring step is otherwise invisible until it reaches a
// consumer's error handling.
//
// Core codes (`core:*`) are a separate namespace and are not step-owned, so they are not scanned.

const root = process.cwd()
const stepsRoot = path.join(root, 'packages/internal/src/steps')
const descriptionPattern = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/
const errors: string[] = []

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

for (const directory of fs.readdirSync(stepsRoot)) {
	const stepDirectory = path.join(stepsRoot, directory)
	if (!fs.statSync(stepDirectory)
		.isDirectory()) {
		continue
	}

	const mainFile = path.join(stepDirectory, `${directory}.ts`)
	if (!fs.existsSync(mainFile))
		continue

	const source = fs.readFileSync(mainFile, 'utf8')
	const relative = path.relative(root, mainFile)
	const declaredName = /^\tName: '([^']+)'/m.exec(source)?.[1]

	if (declaredName == null) {
		errors.push(`${relative}: step must declare Meta.Name`)
		continue
	}

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
