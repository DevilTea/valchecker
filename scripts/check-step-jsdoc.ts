import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

// Enforces the canonical PluginDef JSDoc template documented in
// .github/skills/valchecker-dev/references/conventions.md: every public step's
// PluginDef must carry the three sections `### Description`, `### Example`, and
// `### Issues`. This guard prevents the terse/prose/@tag formats from regressing.

const root = process.cwd()
const stepsRoot = path.join(root, 'packages/internal/src/steps')
const requiredSections = ['### Description', '### Example', '### Issues'] as const
const errors: string[] = []

function pluginDefBlock(source: string): string | undefined {
	// Match any `*PluginDef` interface name, not only the bare `PluginDef`
	// identifier: several steps prefix it (e.g. `AtLeastPluginDef`,
	// `LengthAtLeastPluginDef`). A literal `indexOf('interface PluginDef')`
	// silently skipped those files and let their JSDoc regress unchecked.
	const match = /interface\s+\w*PluginDef\b/.exec(source)
	if (match == null)
		return undefined
	const start = match.index
	// The plugin implementation always follows the interface; use its marker as
	// the block terminator, falling back to end-of-file.
	const markerIndex = source.indexOf('/* @__NO_SIDE_EFFECTS__ */', start)
	const end = markerIndex === -1 ? source.length : markerIndex
	return source.slice(start, end)
}

// Every scanned step main file (`<dir>/<dir>.ts`) is expected to declare a
// `*PluginDef` interface carrying the JSDoc template. A main file with none is
// a hard failure rather than a silent skip: a missing PluginDef means the
// template can no longer be enforced for that step. (Secondary step files such
// as shorthand variants live outside this per-step-main-file scan by design.)
for (const directory of fs.readdirSync(stepsRoot)) {
	const filePath = path.join(stepsRoot, directory, `${directory}.ts`)
	if (!fs.existsSync(filePath))
		continue

	const source = fs.readFileSync(filePath, 'utf8')
	const block = pluginDefBlock(source)
	if (block == null) {
		errors.push(`${path.relative(root, filePath)}: no *PluginDef interface found (step main files must declare a PluginDef carrying the JSDoc template)`)
		continue
	}

	const missing = requiredSections.filter(section => !block.includes(section))
	if (missing.length > 0)
		errors.push(`${path.relative(root, filePath)}: PluginDef JSDoc missing ${missing.join(', ')}`)
}

if (errors.length > 0) {
	console.error('Step JSDoc checks failed:')
	for (const error of errors)
		console.error(`- ${error}`)
	process.exitCode = 1
}
else {
	console.log('Step JSDoc template is valid.')
}
