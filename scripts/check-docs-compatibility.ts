import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import {
	composeDocsCompatibility,
	staleCompatibilityOutputs,
} from './docs-compatibility'
import { fileSystemTree } from './source-tree'

const root = path.resolve(import.meta.dirname, '..')
const write = process.argv.includes('--write')
const tree = fileSystemTree(root)
const { outputs, problems } = composeDocsCompatibility()

if (problems.length > 0) {
	console.error('The documentation route-compatibility mapping is invalid:')
	for (const problem of problems)
		console.error(`- ${problem}`)
	console.error(`\n${problems.length} problem${problems.length === 1 ? '' : 's'}. Nothing was written.`)
	process.exit(1)
}

const stale = staleCompatibilityOutputs(tree, outputs)
if (write) {
	for (const relative of stale) {
		const target = path.join(root, relative)
		fs.mkdirSync(path.dirname(target), { recursive: true })
		fs.writeFileSync(target, outputs.get(relative)!)
	}
}

if (write) {
	console.log(stale.length === 0
		? `The ${outputs.size} compatibility routes already match the canonical mapping.`
		: `Updated ${stale.length} of ${outputs.size} compatibility routes:\n${stale.map(file => `- ${file}`)
			.join('\n')}`)
}
else if (stale.length > 0) {
	console.error(`Generated documentation compatibility routes are stale:\n${stale.map(file => `- ${file}`)
		.join('\n')}`)
	console.error('\nEdit `docs/_meta/compatibility.ts` or the canonical narrative registry, then run `pnpm docs:compat:update`.')
	process.exitCode = 1
}
else {
	console.log(`The ${outputs.size} compatibility routes match the canonical mapping.`)
}
