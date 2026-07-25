import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import ts from 'typescript'

const root = process.cwd()
const stepsRoot = path.join(root, 'packages/internal/src/steps')
const errors: string[] = []

const sideEffectMarker = '/* @__NO_SIDE_EFFECTS__ */'

// Tree-shaking of unselected plugins depends on this marker sitting directly above every
// plugin construction. Losing it is invisible in tests and only shows up as a bundle-size
// regression in the tree-shaking scenarios that happen to be enumerated.
function checkSideEffectMarker(filePath: string): void {
	const lines = fs.readFileSync(filePath, 'utf8')
		.split('\n')
	lines.forEach((line, index) => {
		if (!/^export const \w+ = implStepPlugin\b/.test(line))
			return

		let previous = index - 1
		while (previous >= 0 && lines[previous]!.trim() === '')
			previous--

		if (previous < 0 || lines[previous]!.trim() !== sideEffectMarker)
			errors.push(`${path.relative(root, filePath)}:${index + 1}: plugin construction must be directly preceded by ${sideEffectMarker}`)
	})
}

function visitFile(filePath: string): void {
	const source = fs.readFileSync(filePath, 'utf8')
	const usesStepOptions = source.includes('StepOptions')
	const usesDirectMessageHandler = source.includes('MessageHandler<')
	if (!usesStepOptions && !usesDirectMessageHandler)
		return

	if (usesDirectMessageHandler) {
		errors.push(`${path.relative(root, filePath)}: message-bearing steps must use StepOptions instead of MessageHandler directly`)
	}

	const sf = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)

	function inspectMethodType(node: ts.TypeNode): void {
		function visit(current: ts.Node): void {
			if (ts.isFunctionTypeNode(current)) {
				const parameters = [...current.parameters]
				if (parameters.length > 2)
					errors.push(`${path.relative(root, filePath)}: method has more than one operand plus options`)

				parameters.forEach((parameter, index) => {
					const name = ts.isIdentifier(parameter.name) ? parameter.name.text : parameter.name.getText(sf)
					const optional = parameter.questionToken != null || parameter.initializer != null
					if (name === 'message')
						errors.push(`${path.relative(root, filePath)}: positional message parameters are forbidden`)
					if (optional && name !== 'options')
						errors.push(`${path.relative(root, filePath)}: optional parameter ${name} must be grouped into options`)
					if (index > 0 && name !== 'options')
						errors.push(`${path.relative(root, filePath)}: only trailing options may follow the operand`)
					if (name === 'options' && !parameter.type?.getText(sf)
						.includes('Options')) {
						errors.push(`${path.relative(root, filePath)}: options must use a named options type`)
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
}

for (const directory of fs.readdirSync(stepsRoot)) {
	const stepDirectory = path.join(stepsRoot, directory)
	if (!fs.statSync(stepDirectory)
		.isDirectory()) {
		continue
	}

	const mainFile = path.join(stepDirectory, `${directory}.ts`)
	if (fs.existsSync(mainFile))
		visitFile(mainFile)

	for (const entry of fs.readdirSync(stepDirectory)) {
		if (!entry.endsWith('.ts') || entry.endsWith('.test.ts') || entry.endsWith('.bench.ts'))
			continue
		checkSideEffectMarker(path.join(stepDirectory, entry))
	}
}

if (errors.length > 0) {
	console.error(errors.join('\n'))
	process.exitCode = 1
}
else {
	console.log('Built-in step parameter style is valid.')
}
