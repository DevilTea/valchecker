import path from 'node:path'
import process from 'node:process'
import { auditNarrativeDocs } from './docs-narrative'
import { fileSystemTree } from './source-tree'

const root = path.resolve(import.meta.dirname, '..')
const problems = auditNarrativeDocs(fileSystemTree(root))

if (problems.length > 0) {
	console.error('The narrative documentation contract is broken:')
	for (const problem of problems)
		console.error(`- ${problem}`)
	console.error(`\n${problems.length} problem${problems.length === 1 ? '' : 's'}. Fix the canonical registry/page owner rather than adding a second navigation inventory.`)
	process.exitCode = 1
}
else {
	console.log('The narrative documentation registry, pages, metadata, and local references are consistent.')
}
