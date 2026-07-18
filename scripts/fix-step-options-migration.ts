import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'

const root = process.cwd()

interface Replacement {
	start: number
	end: number
	text: string
}

const messageOnlyMethods = new Set([
	'any',
	'bigint',
	'boolean',
	'isEmpty',
	'isFinite',
	'isInteger',
	'isNaN',
	'isNotEmpty',
	'json',
	'looseBigint',
	'looseBoolean',
	'looseNumber',
	'never',
	'null_',
	'number',
	'string',
	'symbol',
	'toBigint',
	'toJSONString',
	'toJSONValue',
	'toNumber',
	'toSafeNumber',
	'undefined_',
])

const operandMessageMethods = new Set([
	'array',
	'check',
	'fallback',
	'instance',
	'intersection',
	'isAtLeast',
	'isAtMost',
	'isEndingWith',
	'isLengthAtLeast',
	'isLengthAtMost',
	'isStartingWith',
	'literal',
	'looseObject',
	'object',
	'strictObject',
	'transform',
	'union',
])

const excludedRoots = new Set([
	'Array',
	'JSON',
	'Math',
	'Number',
	'Object',
	'Promise',
	'String',
	'expect',
])

function read(relativePath: string): string {
	return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function write(relativePath: string, content: string): void {
	fs.writeFileSync(path.join(root, relativePath), content)
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

function rootIdentifier(expression: ts.Expression): string | undefined {
	let current = expression
	while (ts.isCallExpression(current) || ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current))
		current = current.expression
	return ts.isIdentifier(current) ? current.text : undefined
}

function propertyName(node: ts.ObjectLiteralExpression, name: string): boolean {
	return node.properties.some((property) => {
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

function transformCalls(filePath: string, source: string): string {
	const sf = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
	const replacements: Replacement[] = []

	function visit(node: ts.Node): void {
		if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
			const args = [...node.arguments]
			const method = node.expression.name.text
			const rootName = rootIdentifier(node.expression.expression)
			if (rootName == null || !excludedRoots.has(rootName)) {
				const argText = (index: number) => args[index]!.getText(sf)
				const replaceArguments = (text: string) => replacements.push({
					start: node.arguments.pos,
					end: node.arguments.end,
					text,
				})

				if (messageOnlyMethods.has(method)
					&& args.length === 1
					&& looksLikeMessage(args[0]!)
					&& !(ts.isObjectLiteralExpression(args[0]!) && propertyName(args[0]!, 'message'))) {
					replaceArguments(`{ message: ${argText(0)} }`)
				}
				else if (operandMessageMethods.has(method)
					&& args.length === 2
					&& looksLikeMessage(args[1]!)
					&& !(ts.isObjectLiteralExpression(args[1]!) && propertyName(args[1]!, 'message'))) {
					replaceArguments(`${argText(0)}, { message: ${argText(1)} }`)
				}
				else if (method === 'toFiltered') {
					if (args.length === 2
						&& !(ts.isObjectLiteralExpression(args[1]!)
							&& (propertyName(args[1]!, 'thisArg') || propertyName(args[1]!, 'message')))) {
						replaceArguments(`${argText(0)}, { thisArg: ${argText(1)} }`)
					}
					else if (args.length === 3) {
						const properties = argText(1) === 'undefined'
							? `message: ${argText(2)}`
							: `thisArg: ${argText(1)}, message: ${argText(2)}`
						replaceArguments(`${argText(0)}, { ${properties} }`)
					}
				}
				else if (method === 'toSorted') {
					if (args.length === 1
						&& !(ts.isObjectLiteralExpression(args[0]!)
							&& (propertyName(args[0]!, 'compareFn') || propertyName(args[0]!, 'message')))) {
						replaceArguments(`{ compareFn: ${argText(0)} }`)
					}
					else if (args.length === 2) {
						const properties = argText(0) === 'undefined'
							? `message: ${argText(1)}`
							: `compareFn: ${argText(0)}, message: ${argText(1)}`
						replaceArguments(`{ ${properties} }`)
					}
				}
				else if (method === 'toMappedBoolean' && args.length === 2 && looksLikeMessage(args[1]!)) {
					const first = argText(0)
					if (ts.isObjectLiteralExpression(args[0]!)) {
						const inner = first.slice(1, -1).trim()
						replaceArguments(`{ ${inner}${inner === '' ? '' : ','} message: ${argText(1)} }`)
					}
					else {
						replaceArguments(`{ ...${first}, message: ${argText(1)} }`)
					}
				}
			}
		}
		ts.forEachChild(node, visit)
	}

	visit(sf)
	return applyReplacements(source, replacements)
}

function repairSource(source: string): string {
	return source
		.replace(/expect\.any\(\{\s*message:\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*\}\)/g, 'expect.any($1)')
		.replace(/Number\.(isFinite|isInteger|isNaN)\(\{\s*message:\s*([^{}]+?)\s*\}\)/g, 'Number.$1($2)')
}

const codeFiles = execFileSync('git', ['ls-files', '*.ts', '*.mts', '*.mjs'], { encoding: 'utf8' })
	.trim()
	.split('\n')
	.filter(Boolean)
	.filter(filePath => filePath !== 'scripts/fix-step-options-migration.ts')

for (const filePath of codeFiles) {
	const source = read(filePath)
	const transformed = transformCalls(filePath, repairSource(source))
	if (transformed !== source)
		write(filePath, transformed)
}

const markdownFiles = execFileSync('git', ['ls-files', '*.md'], { encoding: 'utf8' })
	.trim()
	.split('\n')
	.filter(Boolean)
for (const filePath of markdownFiles) {
	const source = read(filePath)
	const repaired = repairSource(source)
	const transformed = repaired.replace(/```(?:ts|typescript)\n([\s\S]*?)```/g, (full, code: string) =>
		full.replace(code, transformCalls(`${filePath}.example.ts`, code)))
	if (transformed !== source)
		write(filePath, transformed)
}

const typesPath = 'packages/internal/src/core/types.ts'
let typesSource = read(typesPath)
const optionsBlock = `/** Optional configuration shared by message-bearing built-in steps. */\nexport interface StepOptions<Issue extends AnyExecutionIssue = AnyExecutionIssue> {\n\treadonly message?: MessageHandler<Issue> | undefined\n}\n`
const duplicatedOptions = `${optionsBlock}\n${optionsBlock}`
if (typesSource.includes(duplicatedOptions)) {
	typesSource = typesSource.replace(duplicatedOptions, optionsBlock)
	write(typesPath, typesSource)
}

fs.rmSync(path.join(root, 'scripts/fix-step-options-migration.ts'))
fs.rmSync(path.join(root, '.github/workflows/fix-step-options-migration.yml'))
