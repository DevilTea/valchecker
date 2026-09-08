import path from 'node:path'
import process from 'node:process'
import { auditDocumentationMarkdown } from './docs-markdown'
import { fileSystemTree } from './source-tree'

const root = path.resolve(import.meta.dirname, '..')
const problems = auditDocumentationMarkdown(fileSystemTree(root))

if (problems.length > 0) {
	console.error('The documentation Markdown contract is broken:')
	for (const problem of problems)
		console.error(`- ${problem}`)
	process.exitCode = 1
}
else {
	console.log('Documentation diagram syntax and compile-skip reasons are valid.')
}
