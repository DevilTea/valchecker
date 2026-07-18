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

function parse(filePath: string, source: string): ts.SourceFile {
	return ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
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

function rootIdentifier(expression: ts.Expression): string | undefined {
	let current: ts.Expression = expression
	while (ts.isCallExpression(current) || ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
		if (ts.isCallExpression(current))
			current = current.expression
		else
			current = current.expression
	}
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

function objectLiteral(properties: string[]): string {
	return `{ ${properties.join(', ')} }`
}

function transformCalls(filePath: string, source: string): string {
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
				&& !(ts.isObjectLiteralExpression(args[0]!) && propertyName(args[0]!, 'message'))) {
				replaceArguments(objectLiteral([`message: ${argText(0)}`]))
			}
			else if (operandMessageMethods.has(method)
				&& args.length === 2
				&& looksLikeMessage(args[1]!)
				&& !(ts.isObjectLiteralExpression(args[1]!) && propertyName(args[1]!, 'message'))) {
				replaceArguments(`${argText(0)}, ${objectLiteral([`message: ${argText(1)}`])}`)
			}
			else if (method === 'toFiltered') {
				if (args.length === 2
					&& !(ts.isObjectLiteralExpression(args[1]!)
						&& (propertyName(args[1]!, 'thisArg') || propertyName(args[1]!, 'message')))) {
					replaceArguments(`${argText(0)}, ${objectLiteral([`thisArg: ${argText(1)}`])}`)
				}
				else if (args.length === 3) {
					const properties = argText(1) === 'undefined'
						? [`message: ${argText(2)}`]
						: [`thisArg: ${argText(1)}`, `message: ${argText(2)}`]
					replaceArguments(`${argText(0)}, ${objectLiteral(properties)}`)
				}
			}
			else if (method === 'toSorted') {
				if (args.length === 1
					&& !(ts.isObjectLiteralExpression(args[0]!)
						&& (propertyName(args[0]!, 'compareFn') || propertyName(args[0]!, 'message')))) {
					replaceArguments(objectLiteral([`compareFn: ${argText(0)}`]))
				}
				else if (args.length === 2) {
					const properties = argText(0) === 'undefined'
						? [`message: ${argText(1)}`]
						: [`compareFn: ${argText(0)}`, `message: ${argText(1)}`]
					replaceArguments(objectLiteral(properties))
				}
			}
			else if (method === 'toMappedBoolean' && args.length === 2 && looksLikeMessage(args[1]!)) {
				const first = argText(0)
				if (ts.isObjectLiteralExpression(args[0]!)) {
					const inner = first.slice(1, -1).trim()
					replaceArguments(`{ ${inner}${inner === '' ? '' : ','} message: ${argText(1)} }`)
				}
				else {
					replaceArguments(objectLiteral([`...${first}`, `message: ${argText(1)}`]))
				}
			}
		}
		ts.forEachChild(node, visit)
	}

	visit(sf)
	return applyReplacements(source, replacements)
}

function transformCodeFences(filePath: string, source: string): string {
	return source.replace(/```(?:ts|typescript)\n([\s\S]*?)```/g, (full, code: string) => {
		const transformed = transformCalls(`${filePath}.example.ts`, code)
		return full.replace(code, transformed)
	})
}

function addStepOptionsType(): void {
	const filePath = 'packages/internal/src/core/types.ts'
	let source = read(filePath)
	const anchor = `export type MessageHandler<Issue extends AnyExecutionIssue = AnyExecutionIssue>\n\t= | string\n\t\t| ((issue: IssueMessageInput<Issue>) => string | undefined | null)\n\t\t| MessageMap<Issue>\n`
	if (!source.includes(anchor))
		throw new Error('MessageHandler anchor not found')
	source = source.replace(anchor, `${anchor}\n/** Optional configuration shared by message-bearing built-in steps. */\nexport interface StepOptions<Issue extends AnyExecutionIssue = AnyExecutionIssue> {\n\treadonly message?: MessageHandler<Issue> | undefined\n}\n`)
	write(filePath, source)
}

function transformGenericStep(filePath: string): void {
	let source = read(filePath)
	if (!source.includes('MessageHandler<'))
		return
	const sf = parse(filePath, source)
	const exportPosition = source.indexOf('export const ')
	const replacements: Replacement[] = []
	let replacedParameter = false

	function visit(node: ts.Node): void {
		if (ts.isImportSpecifier(node) && node.name.text === 'MessageHandler')
			replacements.push({ start: node.name.getStart(sf), end: node.name.end, text: 'StepOptions' })

		if (ts.isParameter(node)
			&& ts.isIdentifier(node.name)
			&& node.name.text === 'message'
			&& node.type
			&& ts.isTypeReferenceNode(node.type)
			&& ts.isIdentifier(node.type.typeName)
			&& node.type.typeName.text === 'MessageHandler') {
			const issue = node.type.typeArguments?.[0]?.getText(sf)
			if (!issue)
				throw new Error(`Missing message issue type in ${filePath}`)
			replacements.push({ start: node.getStart(sf), end: node.end, text: `options?: StepOptions<${issue}>` })
			replacedParameter = true
		}

		if (exportPosition >= 0 && ts.isIdentifier(node) && node.text === 'message' && node.getStart(sf) > exportPosition) {
			if (ts.isBindingElement(node.parent))
				replacements.push({ start: node.getStart(sf), end: node.end, text: 'options' })
			else
				replacements.push({ start: node.getStart(sf), end: node.end, text: 'options?.message' })
		}
		ts.forEachChild(node, visit)
	}

	visit(sf)
	if (!replacedParameter)
		throw new Error(`No public message parameter found in ${filePath}`)
	source = applyReplacements(source, replacements)
	source = transformCodeFences(filePath, source)
	write(filePath, source)
}

function transformToFiltered(): void {
	const filePath = 'packages/internal/src/steps/toFiltered/toFiltered.ts'
	let source = read(filePath)
	source = source.replace('InferOutput, MessageHandler, Next', 'InferOutput, Next, StepOptions')
	source = source.replace(
		`\texport type Issue<Input extends any[] = any[], Item = Input[number]> = ExecutionIssue<\n\t\t'toFiltered:callback_failed',\n\t\t{ value: Input, item: Item, index: number, error: unknown },\n\t\t'operation'\n\t>\n`,
		`\texport type Issue<Input extends any[] = any[], Item = Input[number]> = ExecutionIssue<\n\t\t'toFiltered:callback_failed',\n\t\t{ value: Input, item: Item, index: number, error: unknown },\n\t\t'operation'\n\t>\n\texport interface Options<Input extends any[] = any[]> extends StepOptions<Issue<Input>> {\n\t\treadonly thisArg?: any\n\t}\n`,
	)
	source = source.replace(/\n\t\t\t\t\t\tthisArg\?: any,\n\t\t\t\t\t\tmessage\?: MessageHandler<Internal\.Issue<Input>>,/g, '\n\t\t\t\t\t\toptions?: Internal.Options<Input>,')
	source = source.replace('The optional `thisArg` follows\n\t * `Array.prototype.filter`; the optional third argument is the step message.', 'The optional `thisArg` and message are supplied through the second options object.')
	source = source.replace('params: [predicate, thisArg, message]', 'params: [predicate, options]')
	source = source.replace('predicate.call(thisArg, item, index, array)', 'predicate.call(options?.thisArg, item, index, array)')
	source = source.replace('customMessage: message', 'customMessage: options?.message')
	source = transformCodeFences(filePath, source)
	write(filePath, source)
}

function transformToSorted(): void {
	const filePath = 'packages/internal/src/steps/toSorted/toSorted.ts'
	let source = read(filePath)
	source = source.replace('InferOutput, MessageHandler, Next', 'InferOutput, Next, StepOptions')
	source = source.replace(
		`\texport type Issue<Input extends any[] = any[], Item = Input[number]> = ExecutionIssue<\n\t\t'toSorted:callback_failed',\n\t\t{ value: Input, left: Item, right: Item, error: unknown },\n\t\t'operation'\n\t>\n`,
		`\texport type Issue<Input extends any[] = any[], Item = Input[number]> = ExecutionIssue<\n\t\t'toSorted:callback_failed',\n\t\t{ value: Input, left: Item, right: Item, error: unknown },\n\t\t'operation'\n\t>\n\texport interface Options<Input extends any[] = any[]> extends StepOptions<Issue<Input>> {\n\t\treadonly compareFn?: ((left: Input[number], right: Input[number]) => number) | undefined\n\t}\n`,
	)
	source = source.replace(
		`\t\t\t\t? (\n\t\t\t\t\tcompareFn?: ((left: Input[number], right: Input[number]) => number) | undefined,\n\t\t\t\t\tmessage?: MessageHandler<Internal.Issue<Input>>,\n\t\t\t\t) => Next`,
		`\t\t\t\t? (options?: Internal.Options<Input>) => Next`,
	)
	source = source.replace('params: [compareFn, message]', 'params: [options]')
	source = source.replace('\t}) => {\n\t\taddSuccessStep', '\t}) => {\n\t\tconst compareFn = options?.compareFn\n\t\taddSuccessStep')
	source = source.replace('customMessage: message', 'customMessage: options?.message')
	source = transformCodeFences(filePath, source)
	write(filePath, source)
}

function transformToMappedBoolean(): void {
	const filePath = 'packages/internal/src/steps/toMappedBoolean/toMappedBoolean.ts'
	let source = read(filePath)
	source = source.replace('InferOutput, MessageHandler, Next', 'InferOutput, Next, StepOptions')
	source = source.replace(
		`declare namespace Internal {\n\texport interface Options<T> {\n\t\treadonly trueValues: readonly T[]\n\t\treadonly falseValues: readonly T[]\n\t}\n\texport type Issue<T = unknown> = ExecutionIssue<\n\t\t'toMappedBoolean:unmapped_value',\n\t\t{ value: T, trueValues: readonly T[], falseValues: readonly T[] }\n\t>\n}`,
		`declare namespace Internal {\n\texport type Issue<T = unknown> = ExecutionIssue<\n\t\t'toMappedBoolean:unmapped_value',\n\t\t{ value: T, trueValues: readonly T[], falseValues: readonly T[] }\n\t>\n\texport interface Options<T> extends StepOptions<Issue<T>> {\n\t\treadonly trueValues: readonly T[]\n\t\treadonly falseValues: readonly T[]\n\t}\n}`,
	)
	source = source.replace(
		`\t\t\t\t? (\n\t\t\t\t\toptions: Internal.Options<CurrentOutput>,\n\t\t\t\t\tmessage?: MessageHandler<Internal.Issue<CurrentOutput>>,\n\t\t\t\t) => Next`,
		`\t\t\t\t? (options: Internal.Options<CurrentOutput>) => Next`,
	)
	source = source.replace('params: [options, message]', 'params: [options]')
	source = source.replace('customMessage: message', 'customMessage: options.message')
	source = transformCodeFences(filePath, source)
	write(filePath, source)
}

function transformTrackedCallSites(): void {
	const files = execFileSync('git', ['ls-files', '*.ts', '*.mts', '*.mjs'], { encoding: 'utf8' })
		.trim()
		.split('\n')
		.filter(Boolean)
		.filter(filePath => !filePath.startsWith('scripts/migrate-step-options.ts'))
		.filter(filePath => !filePath.startsWith('packages/internal/src/steps/'))
	for (const filePath of files) {
		const source = read(filePath)
		const transformed = transformCalls(filePath, source)
		if (transformed !== source)
			write(filePath, transformed)
	}

	const markdownFiles = execFileSync('git', ['ls-files', '*.md'], { encoding: 'utf8' })
		.trim()
		.split('\n')
		.filter(Boolean)
	for (const filePath of markdownFiles) {
		const source = read(filePath)
		const transformed = transformCodeFences(filePath, source)
		if (transformed !== source)
			write(filePath, transformed)
	}
}

function insertAfter(relativePath: string, anchor: string, addition: string): void {
	let source = read(relativePath)
	if (source.includes(addition.trim()))
		return
	if (!source.includes(anchor))
		throw new Error(`Anchor not found in ${relativePath}`)
	source = source.replace(anchor, `${anchor}${addition}`)
	write(relativePath, source)
}

function updateDocumentation(): void {
	insertAfter(
		'.github/skills/valchecker-dev/references/conventions.md',
		'`check()` and `transform()` intentionally remain generic escape hatches rather than synthetic `isValid()` or `toTransformed()` methods.\n',
		`\n## Step parameters\n\nMessage-bearing built-in steps use one consistent parameter contract:\n\n- a single required semantic operand may remain positional;\n- every optional configuration field and the step message belong to one trailing options object;\n- a step with no required operand accepts only an optional options object;\n- a step that already requires a named configuration object includes \`message\` in that same object;\n- direct positional messages are forbidden.\n\nExamples:\n\n\`\`\`ts\nv.number().isAtLeast(0, { message: 'Expected a non-negative number.' })\nv.number().isFinite({ message: 'Expected a finite number.' })\nv.array(v.string()).toFiltered(predicate, { thisArg, message })\nv.array(v.number()).toSorted({ compareFn, message })\n\`\`\`\n\nBuilt-in step definitions are checked by \`pnpm test:quality\`. Steps without message support may preserve a native positional signature when it is semantically clearer.\n`,
	)
	insertAfter(
		'docs/guide/v1-contract.md',
		'- flow-control and type utilities use their most direct semantic name.\n',
		`\n### Step parameter contract\n\nA message-bearing built-in step accepts at most one required semantic operand positionally. Optional configuration and \`message\` are supplied through one trailing options object. Message-only steps accept an optional options object, and configuration-object steps include \`message\` in that object. Positional messages are not part of the 1.0 API.\n\n\`\`\`ts\nv.number().isAtLeast(0, { message: 'Expected a non-negative number.' })\nv.string().isNotEmpty({ message: 'Required.' })\nv.array(v.number()).toSorted({ compareFn: (left, right) => left - right })\n\`\`\`\n`,
	)
	insertAfter(
		'docs/api/overview.md',
		'- Flow-control and type-level utilities use their most direct names.\n',
		`\nMessage-bearing steps place their message and optional configuration in a trailing options object. A single required semantic operand remains positional. For example, use \`isAtLeast(0, { message })\`, \`isFinite({ message })\`, and \`toFiltered(predicate, { thisArg, message })\`.\n`,
	)
	insertAfter(
		'AGENTS.md',
		'`check()` and `transform()` are generic escape hatches and intentionally do not use artificial `isValid` or `toTransformed` names.\n',
		`\nMessage-bearing steps keep at most one required semantic operand positional. All optional configuration and \`message\` belong to one trailing options object; direct positional messages are forbidden.\n`,
	)
	insertAfter(
		'MIGRATION.md',
		'# Migrating to Valchecker 1.0\n',
		`\n## Step messages now use options objects\n\nAll built-in positional message parameters have been removed before 1.0. Keep one required semantic operand positional and move the message into the trailing options object. Callback configuration such as \`thisArg\` and \`compareFn\` belongs to that object as well.\n\n\`\`\`ts\n// Before\nv.number().isAtLeast(0, 'Must be non-negative.')\nv.array(v.string()).toFiltered(predicate, undefined, 'Filter failed.')\n\n// After\nv.number().isAtLeast(0, { message: 'Must be non-negative.' })\nv.array(v.string()).toFiltered(predicate, { message: 'Filter failed.' })\n\`\`\`\n`,
	)
	let changelog = read('CHANGELOG.md')
	const line = '- Standardized all message-bearing built-in step parameters around trailing options objects and removed positional messages.\n'
	if (!changelog.includes(line)) {
		const anchor = '### Changed\n'
		changelog = changelog.replace(anchor, `${anchor}\n${line}`)
		write('CHANGELOG.md', changelog)
	}
}

function addStyleCheck(): void {
	const content = `import fs from 'node:fs'\nimport path from 'node:path'\nimport process from 'node:process'\nimport ts from 'typescript'\n\nconst root = process.cwd()\nconst stepsRoot = path.join(root, 'packages/internal/src/steps')\nconst errors: string[] = []\n\nfunction visitFile(filePath: string): void {\n\tconst source = fs.readFileSync(filePath, 'utf8')\n\tif (!source.includes('StepOptions'))\n\t\treturn\n\tconst sf = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)\n\n\tfunction inspectMethodType(node: ts.TypeNode): void {\n\t\tfunction visit(current: ts.Node): void {\n\t\t\tif (ts.isFunctionTypeNode(current)) {\n\t\t\t\tconst parameters = [...current.parameters]\n\t\t\t\tif (parameters.length > 2)\n\t\t\t\t\terrors.push(\`${'${path.relative(root, filePath)}'}: method has more than one operand plus options\`)\n\t\t\t\tparameters.forEach((parameter, index) => {\n\t\t\t\t\tconst name = ts.isIdentifier(parameter.name) ? parameter.name.text : parameter.name.getText(sf)\n\t\t\t\t\tconst optional = parameter.questionToken != null || parameter.initializer != null\n\t\t\t\t\tif (name === 'message')\n\t\t\t\t\t\terrors.push(\`${'${path.relative(root, filePath)}'}: positional message parameters are forbidden\`)\n\t\t\t\t\tif (optional && name !== 'options')\n\t\t\t\t\t\terrors.push(\`${'${path.relative(root, filePath)}'}: optional parameter \${name} must be grouped into options\`)\n\t\t\t\t\tif (index > 0 && name !== 'options')\n\t\t\t\t\t\terrors.push(\`${'${path.relative(root, filePath)}'}: only trailing options may follow the operand\`)\n\t\t\t\t})\n\t\t\t\treturn\n\t\t\t}\n\t\t\tts.forEachChild(current, visit)\n\t\t}\n\t\tvisit(node)\n\t}\n\n\tfunction visit(node: ts.Node): void {\n\t\tif (ts.isTypeReferenceNode(node)\n\t\t\t&& ts.isIdentifier(node.typeName)\n\t\t\t&& node.typeName.text === 'DefineStepMethod'\n\t\t\t&& node.typeArguments?.[1])\n\t\t\tinspectMethodType(node.typeArguments[1])\n\t\tts.forEachChild(node, visit)\n\t}\n\tvisit(sf)\n}\n\nfor (const directory of fs.readdirSync(stepsRoot)) {\n\tconst filePath = path.join(stepsRoot, directory, \`${'${directory}'}.ts\`)\n\tif (fs.existsSync(filePath))\n\t\tvisitFile(filePath)\n}\n\nif (errors.length > 0) {\n\tconsole.error(errors.join('\\n'))\n\tprocess.exitCode = 1\n}\nelse {\n\tconsole.log('Built-in step parameter style is valid.')\n}\n`
	write('scripts/check-step-parameter-style.ts', content)
	let packageSource = read('package.json')
	packageSource = packageSource.replace(
		'"test:quality": "tsx ./scripts/check-test-quality.ts"',
		'"test:quality": "tsx ./scripts/check-test-quality.ts && tsx ./scripts/check-step-parameter-style.ts"',
	)
	write('package.json', packageSource)
}

addStepOptionsType()
const special = new Set([
	'packages/internal/src/steps/toFiltered/toFiltered.ts',
	'packages/internal/src/steps/toMappedBoolean/toMappedBoolean.ts',
	'packages/internal/src/steps/toSorted/toSorted.ts',
])
const stepFiles = execFileSync('git', ['ls-files', 'packages/internal/src/steps/*/*.ts'], { encoding: 'utf8' })
	.trim()
	.split('\n')
	.filter(Boolean)
	.filter(filePath => !filePath.endsWith('.test.ts'))
	.filter(filePath => !filePath.endsWith('.bench.ts'))
	.filter(filePath => !filePath.endsWith('/index.ts'))
for (const filePath of stepFiles) {
	if (!special.has(filePath))
		transformGenericStep(filePath)
}
transformToFiltered()
transformToSorted()
transformToMappedBoolean()
transformTrackedCallSites()
updateDocumentation()
addStyleCheck()

fs.rmSync(path.join(root, 'scripts/migrate-step-options.ts'))
fs.rmSync(path.join(root, '.github/workflows/migrate-step-options.yml'))
