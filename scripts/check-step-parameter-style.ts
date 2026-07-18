import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import ts from 'typescript'

const root = process.cwd()
const stepsRoot = path.join(root, 'packages/internal/src/steps')
const errors: string[] = []

function visitFile(filePath: string): void {
	const source = fs.readFileSync(filePath, 'utf8')
	if (!source.includes('StepOptions'))
		return
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
	const filePath = path.join(stepsRoot, directory, `${directory}.ts`)
	if (fs.existsSync(filePath))
		visitFile(filePath)
}

if (errors.length > 0) {
	console.error(errors.join('\n'))
	process.exitCode = 1
}
else {
	console.log('Built-in step parameter style is valid.')
}
