import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { fileSystemTree } from './source-tree'
import { checkStepCompleteness, successMessage } from './step-completeness'

// Fails a built-in step that is missing part of what one has to ship with. The rules, and what
// each of them can and cannot decide, are in `scripts/step-completeness.ts`, which is a pure
// function of a source tree so that `scripts/step-completeness.test.ts` can drive every rule —
// including the ways each one can be satisfied without the requirement being met.
//
// Failures are collected per step and printed together, so adding a step means one wall listing
// everything it still needs rather than one requirement per CI run.
//
// The root is taken from this file's own location rather than from `process.cwd()`, so
// `pnpm steps:complete` reports the same thing from a subdirectory as from the repository root.

const root = fileURLToPath(new URL('..', import.meta.url))
const report = checkStepCompleteness(fileSystemTree(root))

if (report.errors.length > 0) {
	console.error(report.errors.join('\n'))
	process.exitCode = 1
}
else {
	console.log(successMessage(report))
}
