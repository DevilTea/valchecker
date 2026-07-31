import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { composeDocsApi, staleOutputs } from './docs-api'
import { fileSystemTree } from './source-tree'

// `pnpm docs:api` / `pnpm docs:api:update`, the same pair as `pnpm api:surface`: the committed
// reference must equal what the step units compose, and the write mode is the only way to change
// it. The composition itself lives in `docs-api.ts`, as a pure function of a source tree, so its
// rules are driven by `docs-api.test.ts` over a small synthetic repository rather than over the
// real one.

const root = path.resolve(import.meta.dirname, '..')
const write = process.argv.includes('--write')

const tree = fileSystemTree(root)
const { outputs, problems } = composeDocsApi(tree)

if (problems.length > 0) {
	console.error('The API reference cannot be composed from the step units:')
	for (const problem of problems)
		console.error(`- ${problem}`)
	console.error(`\n${problems.length} problem${problems.length === 1 ? '' : 's'}. Nothing was written: a partial reference over the committed one would hide whichever step could not be placed.`)
	process.exit(1)
}

// Whether a committed file matches is decided in `docs-api.ts`, where a test over a synthetic tree
// can reach it. This script only writes what that comparison names.
const stale = staleOutputs(tree, outputs)
if (write) {
	for (const relative of stale) {
		const target = path.join(root, relative)
		fs.mkdirSync(path.dirname(target), { recursive: true })
		fs.writeFileSync(target, outputs.get(relative)!)
	}
}

if (write) {
	console.log(stale.length === 0
		? `The API reference already matches the step units (${outputs.size} files).`
		: `Updated ${stale.length} of ${outputs.size} generated files:\n${stale.map(file => `- ${file}`)
			.join('\n')}`)
}
else if (stale.length > 0) {
	console.error(`The generated API reference does not match the step units:\n${stale.map(file => `- ${file}`)
		.join('\n')}`)
	console.error('\nThese files are generated. Edit the step\'s `<name>.doc.md` or the page template, then run `pnpm docs:api:update`.')
	process.exitCode = 1
}
else {
	console.log(`The API reference matches the step units (${outputs.size} generated files).`)
}
