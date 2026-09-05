import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = process.cwd()
const stepsRoot = path.join(root, 'packages/internal/src/steps')
const sideEffectMarker = '/* @__NO_SIDE_EFFECTS__ */'

// Tree-shaking of unselected plugins depends on this marker sitting directly above every
// plugin construction. Losing it is invisible in tests and only shows up as a bundle-size
// regression in the tree-shaking scenarios that happen to be enumerated. AST traversal keeps a
// line break between `const name =` and `implStepPlugin(...)` from hiding the construction.
export function checkSideEffectMarker(source: string, relativePath: string): string[] {
	const sourceFile = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
	const failures: string[] = []

	function visit(node: ts.Node): void {
		if (ts.isVariableDeclaration(node)
			&& ts.isIdentifier(node.name)
			&& node.initializer != null
			&& ts.isCallExpression(node.initializer)
			&& ts.isIdentifier(node.initializer.expression)
			&& node.initializer.expression.text === 'implStepPlugin') {
			const statement = node.parent.parent
			const comments = ts.getLeadingCommentRanges(source, statement.getFullStart()) ?? []
			const lastComment = comments.at(-1)
			const commentText = lastComment == null ? '' : source.slice(lastComment.pos, lastComment.end)
			const betweenCommentAndStatement = lastComment == null ? '' : source.slice(lastComment.end, statement.getStart(sourceFile))
			const directlyPreceded = lastComment != null
				&& commentText.trim() === sideEffectMarker
				&& betweenCommentAndStatement.trim() === ''
			if (!directlyPreceded)
				failures.push(`${relativePath}:${sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1}: plugin construction must be directly preceded by ${sideEffectMarker}`)
		}
		ts.forEachChild(node, visit)
	}

	visit(sourceFile)
	return failures
}

export function checkStepParameterStyle(source: string, relativePath: string): string[] {
	const failures: string[] = []
	const sf = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
	const usesDirectMessageHandler = source.includes('MessageHandler<')
	if (usesDirectMessageHandler)
		failures.push(`${relativePath}: message-bearing steps must use StepOptions instead of MessageHandler directly`)

	function inspectMethodType(node: ts.TypeNode): void {
		function visit(current: ts.Node): void {
			if (ts.isFunctionTypeNode(current)) {
				const parameters = [...current.parameters]
				if (parameters.length > 2)
					failures.push(`${relativePath}: method has more than one operand plus options`)

				parameters.forEach((parameter, index) => {
					const name = ts.isIdentifier(parameter.name) ? parameter.name.text : parameter.name.getText(sf)
					const optional = parameter.questionToken != null || parameter.initializer != null
					if (name === 'message')
						failures.push(`${relativePath}: positional message parameters are forbidden`)
					if (optional && name !== 'options')
						failures.push(`${relativePath}: optional parameter ${name} must be grouped into options`)
					if (index > 0 && name !== 'options')
						failures.push(`${relativePath}: only trailing options may follow the operand`)
					if (name === 'options' && !parameter.type?.getText(sf)
						.includes('Options')) {
						failures.push(`${relativePath}: options must use a named options type`)
					}
				})
				return
			}
			ts.forEachChild(current, visit)
		}
		visit(node)
	}

	function visit(node: ts.Node): void {
		if (ts.isTypeReferenceNode(node)
			&& ts.isIdentifier(node.typeName)
			&& node.typeName.text === 'DefineStepMethod'
			&& node.typeArguments?.[1]) {
			inspectMethodType(node.typeArguments[1])
		}
		ts.forEachChild(node, visit)
	}
	visit(sf)
	return failures
}

export function main(): void {
	const errors: string[] = []
	for (const directory of fs.readdirSync(stepsRoot)) {
		const stepDirectory = path.join(stepsRoot, directory)
		if (!fs.statSync(stepDirectory)
			.isDirectory()) {
			continue
		}

		const mainFile = path.join(stepDirectory, `${directory}.ts`)
		if (fs.existsSync(mainFile)) {
			const relativePath = path.relative(root, mainFile)
			const source = fs.readFileSync(mainFile, 'utf8')
			errors.push(...checkStepParameterStyle(source, relativePath))
		}

		for (const entry of fs.readdirSync(stepDirectory)) {
			if (!entry.endsWith('.ts') || entry.endsWith('.test.ts') || entry.endsWith('.bench.ts'))
				continue
			const filePath = path.join(stepDirectory, entry)
			errors.push(...checkSideEffectMarker(fs.readFileSync(filePath, 'utf8'), path.relative(root, filePath)))
		}
	}

	if (errors.length > 0) {
		console.error(errors.join('\n'))
		process.exitCode = 1
	}
	else {
		console.log('Built-in step parameter style is valid.')
	}
}

if (process.argv[1] != null && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
	main()
