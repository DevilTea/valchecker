import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

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
 *
 * Everything is resolved from this file's own location, so the result does not
 * depend on which directory the run started in. The gates that `package.json`
 * also exposes as scripts take their command from there rather than repeating
 * it, so a rename cannot leave the two spellings pointing at different files.
 */

const root = fileURLToPath(new URL('..', import.meta.url))

interface Gate {
	name: string
	command: string
	args: string[]
}

const manifest = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as { scripts?: Record<string, string> }

/** A gate that is also a `package.json` script, taken from there so the two cannot drift. */
function packageScript(name: string, script: string): Gate {
	const command = manifest.scripts?.[script]
	if (command == null)
		throw new Error(`package.json has no '${script}' script, which is where the '${name}' gate takes its command from.`)
	// Deliberately not a shell parser: these entries are `tsx <path>` and nothing else, and a
	// command this cannot read has to fail loudly rather than be split on spaces and hoped for.
	const parsed = /^tsx (\S+)$/.exec(command)
	if (parsed == null)
		throw new Error(`package.json's '${script}' script is \`${command}\`, which is not the \`tsx <path>\` form this runner can execute. Run it here directly, or keep the script in that form.`)
	return { name, command: 'tsx', args: [path.resolve(root, parsed[1]!)] }
}

/** A gate with no `package.json` script of its own. */
function localScript(name: string, file: string): Gate {
	return { name, command: 'tsx', args: [path.join(root, 'scripts', file)] }
}

const gates: Gate[] = [
	localScript('test quality', 'check-test-quality.ts'),
	localScript('step parameter style', 'check-step-parameter-style.ts'),
	localScript('step JSDoc', 'check-step-jsdoc.ts'),
	localScript('issue codes', 'check-issue-codes.ts'),
	packageScript('step completeness', 'steps:complete'),
	packageScript('benchmark step coverage', 'bench:coverage'),
	localScript('workflow pipefail', 'check-workflow-pipefail.ts'),
	localScript('impact triggers', 'check-impact-triggers.ts'),
]

const failed: string[] = []
for (const { name, command, args } of gates) {
	const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' })
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

// Every gate prints its own success line to stdout; the summary of those lines belongs there too.
console.log(`\nAll ${gates.length} quality gates passed.`)
