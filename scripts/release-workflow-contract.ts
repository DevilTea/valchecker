interface WorkflowStep {
	name: string
	properties: Record<string, string>
	with: Record<string, string>
}

function indentation(line: string): number {
	let count = 0
	while (line[count] === ' ')
		count++
	return count
}

function scalar(text: string): string {
	const commentIndex = text.indexOf(' #')
	return (commentIndex === -1 ? text : text.slice(0, commentIndex)).trim()
}

function blockAfter(lines: readonly string[], startIndex: number, parentIndent: number): string[] {
	const block: string[] = []
	for (const line of lines.slice(startIndex + 1)) {
		const trimmed = line.trim()
		if (trimmed !== '' && !trimmed.startsWith('#') && indentation(line) <= parentIndent)
			break
		block.push(line)
	}
	return block
}

function keyValue(line: string, indent: number, label: string): [string, string] {
	if (indentation(line) !== indent)
		throw new Error(`${label} has unexpected indentation: ${line.trim()}`)
	const text = line.slice(indent)
	const separator = text.indexOf(':')
	if (separator <= 0)
		throw new Error(`${label} has malformed entry: ${line.trim()}`)
	const key = text.slice(0, separator)
	if (!/^[\w-]+$/.test(key))
		throw new Error(`${label} has malformed key: ${key}`)
	return [key, scalar(text.slice(separator + 1))]
}

function directMapping(block: readonly string[], indent: number, label: string): Record<string, string> {
	const result: Record<string, string> = {}
	for (const line of block) {
		const trimmed = line.trim()
		if (trimmed === '' || trimmed.startsWith('#') || indentation(line) !== indent)
			continue
		const [key, value] = keyValue(line, indent, label)
		if (key in result)
			throw new Error(`${label} contains duplicate ${key}`)
		result[key] = value
	}
	return result
}

function nestedMapping(block: readonly string[], parentIndent: number, key: string, label: string): Record<string, string> {
	const header = `${' '.repeat(parentIndent)}${key}:`
	const indexes = block
		.map((line, index) => line === header ? index : -1)
		.filter(index => index !== -1)
	if (indexes.length !== 1)
		throw new Error(`${label} must contain exactly one ${key} block`)
	return directMapping(blockAfter(block, indexes[0]!, parentIndent), parentIndent + 2, `${label} ${key}`)
}

function blockRun(block: readonly string[], startIndex: number): string {
	const lines: string[] = []
	for (const line of block.slice(startIndex + 1)) {
		const trimmed = line.trim()
		if (trimmed !== '' && !trimmed.startsWith('#') && indentation(line) <= 8)
			break
		if (line.startsWith('          '))
			lines.push(line.slice(10))
	}
	return lines.join('\n')
		.trim()
}

function parseSteps(jobBlock: readonly string[]): WorkflowStep[] {
	const stepsIndex = jobBlock.findIndex(line => line === '    steps:')
	if (stepsIndex === -1)
		throw new Error('release publish job is missing steps')
	const lines = blockAfter(jobBlock, stepsIndex, 4)
	const starts: number[] = []
	for (const [index, line] of lines.entries()) {
		if (line.startsWith('      - name: '))
			starts.push(index)
	}

	const steps: WorkflowStep[] = []
	for (const [position, start] of starts.entries()) {
		const end = starts[position + 1] ?? lines.length
		const block = lines.slice(start, end)
		const name = scalar(block[0]!.slice('      - name: '.length))
		const properties: Record<string, string> = {}
		for (let index = 1; index < block.length; index++) {
			const line = block[index]!
			const trimmed = line.trim()
			if (trimmed === '' || trimmed.startsWith('#') || indentation(line) !== 8)
				continue
			const [key, value] = keyValue(line, 8, `release step ${name}`)
			if (key === 'with')
				continue
			if (key in properties)
				throw new Error(`release step ${name} contains duplicate ${key}`)
			properties[key] = key === 'run' && value === '|' ? blockRun(block, index) : value
		}
		const withMapping = block.includes('        with:')
			? nestedMapping(block, 8, 'with', `release step ${name}`)
			: {}
		steps.push({ name, properties, with: withMapping })
	}
	return steps
}

function assertExactMapping(actual: Record<string, string>, expected: Record<string, string>, label: string): void {
	const actualEntries = Object.entries(actual)
		.sort(([left], [right]) => left.localeCompare(right))
	const expectedEntries = Object.entries(expected)
		.sort(([left], [right]) => left.localeCompare(right))
	if (JSON.stringify(actualEntries) !== JSON.stringify(expectedEntries))
		throw new Error(`${label} must equal ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`)
}

function assertStepShape(step: WorkflowStep, expectedProperties: Record<string, string>, expectedWith: Record<string, string> = {}): void {
	assertExactMapping(step.properties, expectedProperties, `release step ${step.name}`)
	assertExactMapping(step.with, expectedWith, `release step ${step.name} with options`)
}

function assertPinnedAction(step: WorkflowStep, action: string): void {
	const uses = step.properties.uses
	const prefix = `${action}@`
	if (!uses?.startsWith(prefix) || !/^[0-9a-f]{40}$/.test(uses.slice(prefix.length)))
		throw new Error(`release step ${step.name} must use a commit-pinned ${action} action`)
}

function parseTriggers(lines: readonly string[], onIndex: number): string[] {
	const triggers: string[] = []
	for (const line of blockAfter(lines, onIndex, 0)) {
		if (indentation(line) !== 2 || line.trimStart()
			.startsWith('#')) {
			continue
		}
		const [key] = keyValue(line, 2, 'release workflow on block')
		triggers.push(key)
	}
	return triggers
}

export function assertReleaseWorkflowContract(workflow: string): void {
	const lines = workflow.split(/\r?\n/)
	const onIndex = lines.findIndex(line => line === 'on:')
	if (onIndex === -1)
		throw new Error('release workflow is missing its on block')
	const onBlock = blockAfter(lines, onIndex, 0)
	const triggers = parseTriggers(lines, onIndex)
	if (JSON.stringify(triggers) !== JSON.stringify(['push']))
		throw new Error(`release workflow triggers must equal ["push"], received ${JSON.stringify(triggers)}`)
	if (!onBlock.includes('      - \'v*\''))
		throw new Error('release workflow push trigger must target v* tags')

	const jobsIndex = lines.findIndex(line => line === 'jobs:')
	if (jobsIndex === -1)
		throw new Error('release workflow is missing jobs')
	const jobsBlock = blockAfter(lines, jobsIndex, 0)
	const publishIndex = jobsBlock.findIndex(line => line === '  publish:')
	if (publishIndex === -1)
		throw new Error('release workflow is missing publish job')
	const publishJob = blockAfter(jobsBlock, publishIndex, 2)
	const jobProperties = directMapping(publishJob, 4, 'release publish job')
	assertExactMapping(jobProperties, {
		'environment': 'npm',
		'permissions': '',
		'runs-on': 'ubuntu-24.04',
		'steps': '',
		'timeout-minutes': '45',
	}, 'release publish job')
	assertExactMapping(
		nestedMapping(publishJob, 4, 'permissions', 'release publish job'),
		{ 'contents': 'read', 'id-token': 'write' },
		'release publish permissions',
	)

	const steps = parseSteps(publishJob)
	const expectedNames = [
		'Checkout exact release tag',
		'Verify annotated tag and main ancestry',
		'Setup PNPM',
		'Setup Node',
		'Setup npm for Trusted Publishing',
		'Install Dependencies',
		'Security Audit Policy',
		'Validate Tagged Release',
		'Prepare Immutable Tarballs',
		'Upload Prepared Tarballs',
		'Publish Prepared Tarballs',
	]
	if (JSON.stringify(steps.map(step => step.name)) !== JSON.stringify(expectedNames))
		throw new Error('release publish steps or their order changed')
	const byName = new Map(steps.map(step => [step.name, step]))
	const get = (name: string): WorkflowStep => byName.get(name)!

	const checkout = get('Checkout exact release tag')
	assertPinnedAction(checkout, 'actions/checkout')
	assertStepShape(checkout, { uses: checkout.properties.uses! }, { 'fetch-depth': '0', 'persist-credentials': 'false' })

	const ancestry = get('Verify annotated tag and main ancestry')
	assertStepShape(ancestry, {
		run: [
			'test "$GITHUB_REF_TYPE" = "tag"',
			'test "$(git cat-file -t "$GITHUB_REF_NAME")" = "tag"',
			'tagged_commit="$(git rev-list -n 1 "$GITHUB_REF_NAME")"',
			'test "$tagged_commit" = "$GITHUB_SHA"',
			'git fetch origin main',
			'git merge-base --is-ancestor "$GITHUB_SHA" origin/main',
		].join('\n'),
		shell: 'bash',
	})

	const setupPnpm = get('Setup PNPM')
	assertPinnedAction(setupPnpm, 'pnpm/action-setup')
	assertStepShape(setupPnpm, { uses: setupPnpm.properties.uses! })

	const setupNode = get('Setup Node')
	assertPinnedAction(setupNode, 'actions/setup-node')
	assertStepShape(setupNode, { uses: setupNode.properties.uses! }, { 'node-version': '24', 'package-manager-cache': 'false' })

	assertStepShape(get('Setup npm for Trusted Publishing'), { run: 'npm install --global npm@11.5.1' })
	assertStepShape(get('Install Dependencies'), { run: 'pnpm install --frozen-lockfile' })
	assertStepShape(get('Security Audit Policy'), { run: 'pnpm security:audit' })
	assertStepShape(get('Validate Tagged Release'), { run: 'pnpm release:validate' })
	assertStepShape(get('Prepare Immutable Tarballs'), { run: 'pnpm release:prepare' })

	const upload = get('Upload Prepared Tarballs')
	assertPinnedAction(upload, 'actions/upload-artifact')
	assertStepShape(upload, { uses: upload.properties.uses! }, {
		'if-no-files-found': 'error',
		'name': 'npm-release-$' + '{{ github.ref_name }}-$' + '{{ github.run_id }}-$' + '{{ github.run_attempt }}',
		'path': 'artifacts/release',
		'retention-days': '90',
	})
	assertStepShape(get('Publish Prepared Tarballs'), { run: 'pnpm release:publish' })
}
