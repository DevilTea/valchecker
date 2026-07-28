import { spawnSync } from 'node:child_process'
import process from 'node:process'

/**
 * Runs every quality gate and reports all of their failures, rather than
 * stopping at the first.
 *
 * `test:quality` used to be a `&&` chain, which meant adding one built-in step
 * produced a sequence of runs: fix the missing test, learn about the missing
 * bench, fix that, learn about the missing documentation. Each gate already
 * groups its own findings; short-circuiting between them was the only thing
 * still rationing the list.
 *
 * A gate that crashes rather than reporting is still a failure, and the summary
 * says which gates it could not reach a verdict from — a crash must not read as
 * a pass.
 */
const gates = [
	['test quality', 'tsx', ['./scripts/check-test-quality.ts']],
	['step parameter style', 'tsx', ['./scripts/check-step-parameter-style.ts']],
	['step JSDoc', 'tsx', ['./scripts/check-step-jsdoc.ts']],
	['issue codes', 'tsx', ['./scripts/check-issue-codes.ts']],
	['step completeness', 'tsx', ['./scripts/check-step-completeness.ts']],
	['benchmark step coverage', 'tsx', ['./scripts/check-benchmark-coverage.ts']],
	['workflow pipefail', 'tsx', ['./scripts/check-workflow-pipefail.ts']],
	['impact triggers', 'tsx', ['./scripts/check-impact-triggers.ts']],
] as const satisfies readonly (readonly [string, string, readonly string[]])[]

const failed: string[] = []
for (const [name, command, args] of gates) {
	const result = spawnSync(command, [...args], { stdio: 'inherit', shell: process.platform === 'win32' })
	if (result.error != null) {
		console.error(`\n${name}: could not run — ${result.error.message}`)
		failed.push(name)
		continue
	}
	if (result.status !== 0 || result.signal != null)
		failed.push(name)
}

if (failed.length > 0) {
	console.error(`\n${failed.length} of ${gates.length} quality gates failed: ${failed.join(', ')}`)
	console.error('Every gate above ran, so this is the complete list rather than the first thing to break.')
	process.exit(1)
}

console.error(`\nAll ${gates.length} quality gates passed.`)
