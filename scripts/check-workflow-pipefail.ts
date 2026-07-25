import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

// A GitHub Actions `run` block uses `sh`/`bash` without `pipefail`, so `cmd | tee log` reports
// tee's exit status and a failing command passes CI silently. This repository lost that once
// already (`ci: propagate lint and typecheck failures with pipefail`), and it is invisible in a
// green run, so it needs a guard rather than review attention.
//
// limit: only `| tee` is checked, not every shell pipe. Deciding whether an arbitrary pipe
// swallows a meaningful exit code needs a shell parser, and several pipes here deliberately
// tolerate failure (`grep … | head -n 1 || true`). Widen this by teaching it specific patterns,
// not by flagging every `|`.

const root = process.cwd()
const workflowsRoot = path.join(root, '.github/workflows')
const pipefailPattern = /\bset\s+-[a-z]*o\s+pipefail\b/
const errors: string[] = []

interface RunBlock {
	/** Indentation of the `run:` key itself; the block body is indented further. */
	keyIndent: number
	pipefail: boolean
}

function indentOf(line: string): number {
	return line.length - line.trimStart().length
}

for (const entry of fs.readdirSync(workflowsRoot)
	.sort()) {
	if (!entry.endsWith('.yml') && !entry.endsWith('.yaml'))
		continue

	const filePath = path.join(workflowsRoot, entry)
	const relative = path.relative(root, filePath)
	const lines = fs.readFileSync(filePath, 'utf8')
		.split('\n')
	let block: RunBlock | undefined

	lines.forEach((line, index) => {
		if (line.trim() === '')
			return

		if (block != null && indentOf(line) <= block.keyIndent)
			block = undefined

		const runMatch = /^(\s*)(?:-\s+)?run:/.exec(line)
		if (runMatch != null)
			block = { keyIndent: runMatch[1]!.length, pipefail: false }

		if (block == null)
			return

		if (pipefailPattern.test(line))
			block.pipefail = true

		if (/\|\s*tee\b/.test(line) && !block.pipefail)
			errors.push(`${relative}:${index + 1}: piping into tee requires \`set -o pipefail\` earlier in the same run block`)
	})
}

if (errors.length > 0) {
	console.error(errors.join('\n'))
	process.exitCode = 1
}
else {
	console.log('Workflow log-capturing pipelines preserve failure exit codes.')
}
