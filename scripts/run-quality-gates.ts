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

interface GateCommand {
	command: string
	args: string[]
}

interface Gate extends GateCommand {
	name: string
	prepare?: GateCommand
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

/**
 * A gate that lives in the deliberately isolated `benchmarks` package.
 *
 * The benchmark package is not a pnpm-workspace member: its pinned competitor/tooling
 * dependencies are installed separately with `--ignore-workspace --lockfile=false`, exactly as
 * the benchmark workflows and contributor docs prescribe. Keep that isolation, but make the
 * repository-owned quality gate self-sufficient on a clean checkout. A harness test may import
 * benchmark-only dependencies (for example the manifest `sideEffects` matcher), so relying on a
 * developer's pre-existing `benchmarks/node_modules` would make `pnpm verify` state-dependent.
 */
function benchmarksScript(name: string): Gate {
	return {
		name,
		prepare: {
			command: 'pnpm',
			args: ['--dir', 'benchmarks', 'install', '--ignore-workspace', '--lockfile=false', '--ignore-scripts'],
		},
		command: 'pnpm',
		args: ['--dir', 'benchmarks', 'test'],
	}
}

const gates: Gate[] = [
	localScript('test quality', 'check-test-quality.ts'),
	localScript('step parameter style', 'check-step-parameter-style.ts'),
	localScript('step JSDoc', 'check-step-jsdoc.ts'),
	localScript('issue codes', 'check-issue-codes.ts'),
	packageScript('step completeness', 'steps:complete'),
	packageScript('generated API reference', 'docs:api'),
	packageScript('benchmark step coverage', 'bench:coverage'),
	// The harness that decides the Performance Impact verdict. It was reachable only from that
	// workflow's preflight job, so a change to the code that classifies a regression could break
	// its own tests and `pnpm verify` would not notice — which is the wrong shape for a suite the
	// blocking gate rests on.
	benchmarksScript('benchmark harness'),
	localScript('workflow pipefail', 'check-workflow-pipefail.ts'),
	localScript('impact triggers', 'check-impact-triggers.ts'),
]

const failed: string[] = []
for (const { name, prepare, command, args } of gates) {
	if (prepare != null) {
		const prepared = spawnSync(prepare.command, prepare.args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' })
		if (prepared.error != null || prepared.status !== 0 || prepared.signal != null) {
			const detail = prepared.error?.message ?? `exit ${String(prepared.status)}${prepared.signal == null ? '' : ` / signal ${prepared.signal}`}`
			console.error(`\n${name}: prerequisite failed — ${detail}`)
			failed.push(name)
			continue
		}
	}

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
