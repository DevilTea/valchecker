import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'

const root = process.cwd()
const artifactRoot = path.join(root, 'artifacts/step-option-call-migration')

interface Replacement {
	start: number
	end: number
	text: string
}

const messageOnlyMethods = new Set([
	'any', 'bigint', 'boolean', 'isEmpty', 'isFinite', 'isInteger', 'isNaN',
	'isNotEmpty', 'json', 'looseBigint', 'looseBoolean', 'looseNumber', 'never',
	'null_', 'number', 'string', 'symbol', 'toBigint', 'toJSONString',
	'toJSONValue', 'toNumber', 'toSafeNumber', 'undefined_',
])

const operandMessageMethods = new Set([
	'array', 'check', 'fallback', 'instance', 'intersection', 'isAtLeast',
	'isAtMost', 'isEndingWith', 'isLengthAtLeast', 'isLengthAtMost',
	'isStartingWith', 'literal', 'looseObject', 'object', 'strictObject',
	'transform', 'union',
])

const excludedRoots = new Set([
	'Array', 'JSON', 'Math', 'Number', 'Object', 'Promise', 'String', 'expect',
])

function parse(filePath: string, source: string): ts.SourceFile {
	return ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
}

function rootIdentifier(expression: ts.Expression): string | undefined {
	let current = expression
	while (ts.isCallExpression(current) || ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current))
		current = current.expression
	return ts.isIdentifier(current) ? current.text : undefined
}

function hasProperty(node: ts.Expression, name: string): boolean {
	return ts.isObjectLiteralExpression(node) && node.properties.some((property) => {
		if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property))
			return false
		return property.name.getText().replace(/["']/g, '') === name
	})
}

function looksLikeMessage(node: ts.Expression): boolean {
	if (ts.isStringLiteralLike(node)
		|| ts.isNoSubstitutionTemplateLiteral(node)
		|| ts.isArrowFunction(node)
		|| ts.isFunctionExpression(node)
		|| ts.isObjectLiteralExpression(node))
		return true
	if (ts.isIdentifier(node))
		return /message|handler/i.test(node.text)
	if (ts.isPropertyAccessExpression(node))
		return /message|handler/i.test(node.name.text)
	return false
}

function applyReplacements(source: string, replacements: Replacement[]): string {
	let result = source
	let previousStart = source.length + 1
	for (const replacement of replacements.sort((left, right) => right.start - left.start)) {
		if (replacement.end > previousStart)
			continue
		result = `${result.slice(0, replacement.start)}${replacement.text}${result.slice(replacement.end)}`
		previousStart = replacement.start
	}
	return result
}

function objectLiteral(properties: string[]): string {
	return `{ ${properties.join(', ')} }`
}

function transformCallsOnce(filePath: string, source: string): string {
	const sf = parse(filePath, source)
	const replacements: Replacement[] = []

	function visit(node: ts.Node): void {
		if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
			const method = node.expression.name.text
			const args = [...node.arguments]
			const rootName = rootIdentifier(node.expression.expression)
			if (rootName != null && excludedRoots.has(rootName)) {
				ts.forEachChild(node, visit)
				return
			}

			const argText = (index: number) => args[index]!.getText(sf)
			const replaceArguments = (text: string) => replacements.push({
				start: node.arguments.pos,
				end: node.arguments.end,
				text,
			})

			if (messageOnlyMethods.has(method)
				&& args.length === 1
				&& looksLikeMessage(args[0]!)
				&& !hasProperty(args[0]!, 'message')) {
				replaceArguments(objectLiteral([`message: ${argText(0)}`]))
				return
			}

			if (operandMessageMethods.has(method)
				&& args.length === 2
				&& looksLikeMessage(args[1]!)
				&& !hasProperty(args[1]!, 'message')) {
				replaceArguments(`${argText(0)}, ${objectLiteral([`message: ${argText(1)}`])}`)
				return
			}

			if (method === 'toFiltered') {
				if (args.length === 2 && !hasProperty(args[1]!, 'thisArg') && !hasProperty(args[1]!, 'message')) {
					replaceArguments(`${argText(0)}, ${objectLiteral([`thisArg: ${argText(1)}`])}`)
					return
				}
				if (args.length === 3) {
					const properties = argText(1) === 'undefined'
						? [`message: ${argText(2)}`]
						: [`thisArg: ${argText(1)}`, `message: ${argText(2)}`]
					replaceArguments(`${argText(0)}, ${objectLiteral(properties)}`)
					return
				}
			}

			if (method === 'toSorted') {
				if (args.length === 1 && !hasProperty(args[0]!, 'compareFn') && !hasProperty(args[0]!, 'message')) {
					replaceArguments(objectLiteral([`compareFn: ${argText(0)}`]))
					return
				}
				if (args.length === 2) {
					const properties = argText(0) === 'undefined'
						? [`message: ${argText(1)}`]
						: [`compareFn: ${argText(0)}`, `message: ${argText(1)}`]
					replaceArguments(objectLiteral(properties))
					return
				}
			}

			if (method === 'toMappedBoolean' && args.length === 2) {
				const first = argText(0)
				if (ts.isObjectLiteralExpression(args[0]!)) {
					const inner = first.slice(1, -1).trim()
					replaceArguments(`{ ${inner}${inner === '' ? '' : ','} message: ${argText(1)} }`)
				}
				else {
					replaceArguments(objectLiteral([`...${first}`, `message: ${argText(1)}`]))
				}
				return
			}
		}
		ts.forEachChild(node, visit)
	}

	visit(sf)
	return applyReplacements(source, replacements)
}

function transformCalls(filePath: string, source: string): string {
	let current = source
	for (let pass = 0; pass < 8; pass++) {
		const next = transformCallsOnce(filePath, current)
		if (next === current)
			return current
		current = next
	}
	throw new Error(`Call migration did not stabilize for ${filePath}`)
}

function transformFile(filePath: string, source: string): string {
	if (/\.(?:ts|tsx|mts|cts)$/.test(filePath))
		return transformCalls(filePath, source)
	if (filePath.endsWith('.md')) {
		return source.replace(/```(?:ts|typescript)\n([\s\S]*?)```/g, (full, code: string) => {
			const transformed = transformCalls(`${filePath}.example.ts`, code)
			return full.replace(code, transformed)
		})
	}
	return source
}

fs.rmSync(artifactRoot, { force: true, recursive: true })
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root })
	.toString('utf8')
	.split('\0')
	.filter(Boolean)

const changed: string[] = []
for (const relativePath of tracked) {
	if (!/\.(?:ts|tsx|mts|cts|md)$/.test(relativePath))
		continue
	if (relativePath === 'scripts/generate-step-option-call-migration.ts')
		continue
	const absolutePath = path.join(root, relativePath)
	const source = fs.readFileSync(absolutePath, 'utf8')
	const transformed = transformFile(relativePath, source)
	if (transformed === source)
		continue
	fs.writeFileSync(absolutePath, transformed)
	const artifactPath = path.join(artifactRoot, 'files', relativePath)
	fs.mkdirSync(path.dirname(artifactPath), { recursive: true })
	fs.writeFileSync(artifactPath, transformed)
	changed.push(relativePath)
}

fs.mkdirSync(artifactRoot, { recursive: true })
fs.writeFileSync(path.join(artifactRoot, 'manifest.json'), `${JSON.stringify({ changed }, null, 2)}\n`)
console.log(`Generated migrated call sites for ${changed.length} files.`)
