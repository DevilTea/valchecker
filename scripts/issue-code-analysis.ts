import ts from 'typescript'

const descriptionPattern = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/

/** Read every literal issue code in every ExecutionIssue<...> code argument. */
export function declaredIssueCodes(source: string, fileName = 'step.ts'): string[] {
	const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
	const codes: string[] = []

	function visit(node: ts.Node): void {
		if (ts.isTypeReferenceNode(node)
			&& ((ts.isIdentifier(node.typeName) && node.typeName.text === 'ExecutionIssue')
				|| (ts.isQualifiedName(node.typeName) && node.typeName.right.text === 'ExecutionIssue'))
			&& node.typeArguments?.[0]) {
			function readCodeLiterals(type: ts.Node): void {
				if (ts.isLiteralTypeNode(type) && ts.isStringLiteralLike(type.literal))
					codes.push(type.literal.text)
				ts.forEachChild(type, readCodeLiterals)
			}
			readCodeLiterals(node.typeArguments[0])
		}
		ts.forEachChild(node, visit)
	}

	visit(sourceFile)
	return [...new Set(codes)]
}

export function issueCodeProblems(declaredName: string, source: string, relativePath: string): string[] {
	const problems: string[] = []
	for (const code of declaredIssueCodes(source, relativePath)) {
		const separator = code.indexOf(':')
		if (separator === -1) {
			problems.push(`${relativePath}: issue code '${code}' must be <step-name>:<snake_case_description>`)
			continue
		}

		const prefix = code.slice(0, separator)
		const description = code.slice(separator + 1)
		if (prefix !== declaredName)
			problems.push(`${relativePath}: issue code '${code}' must be prefixed with '${declaredName}'`)
		if (!descriptionPattern.test(description))
			problems.push(`${relativePath}: issue code '${code}' description must be snake_case`)
	}
	return problems
}
