import type { SourceTree } from './source-tree'

// The one list of built-in steps that `check-issue-codes`, `check-step-completeness`, and
// `check-benchmark-coverage` all work from.
//
// Each of them used to walk `packages/internal/src/steps` itself and `continue` past a
// directory whose implementation was not `<dir>/<dir>.ts`. That skip is how a gate reports a
// verdict on a set it never saw: a step whose implementation is named anything else is not
// failed, it is *absent*, and the gate then prints a count and exits 0. A directory added as
// `steps/ghost/plugin.ts` left the count unchanged, and a run against an empty steps root
// reported that all zero steps were complete.
//
// So discovery reports problems rather than skipping, and it is checked against a list it did
// not derive. `packages/internal/src/steps/index.ts` is that list: it is hand-maintained, it is
// what makes a step reach the published package at all, and it names directories, so the two
// sets must be equal in both directions. `api-surface.json` cannot play this part — it is a
// flat list of exported identifiers with nothing in it distinguishing a step plugin from
// `createValchecker`, so it can confirm that a discovered step is exported (which
// `check-step-completeness` does with it) but cannot say which of its entries a discovery
// should have found.
//
// Everything here is matched against whole-file text, never against an exact line, so a CRLF
// checkout reads the same as an LF one.

export const stepsRoot = 'packages/internal/src/steps'
export const stepsBarrel = `${stepsRoot}/index.ts`

export interface DiscoveredStep {
	/** Directory name under `packages/internal/src/steps`, which `Meta.Name` must equal. */
	directory: string
	/** The public step name, from `Meta.Name`. */
	name: string
	/** The exported plugin identifier, which differs from the name for reserved words. */
	exportIdentifier: string
	/** Repository-relative path of `<directory>/<directory>.ts`. */
	path: string
	/** Text of `<directory>/<directory>.ts`. */
	source: string
}

export interface StepInventory {
	steps: DiscoveredStep[]
	/**
	 * Reasons the list above cannot be trusted to be the complete set of built-in steps. A
	 * gate with a non-empty list here must fail: its verdict covers whatever it happened to
	 * find, which is not the same thing as covering the repository.
	 */
	problems: string[]
}

/** The step directories `packages/internal/src/steps/index.ts` re-exports. */
export function barrelDirectories(barrel: string): string[] {
	return [...barrel.matchAll(/^export \* from '\.\/([^'/]+)'/gm)].map(match => match[1]!)
}

export function discoverSteps(tree: SourceTree): StepInventory {
	const steps: DiscoveredStep[] = []
	const problems: string[] = []

	const entries = tree.list(stepsRoot)
	if (entries == null) {
		return { steps, problems: [`${stepsRoot}: the built-in step directory is missing, so this gate has nothing to check.`] }
	}

	for (const directory of [...entries].sort()) {
		if (!tree.isDirectory(`${stepsRoot}/${directory}`))
			continue

		const mainPath = `${stepsRoot}/${directory}/${directory}.ts`
		const source = tree.read(mainPath)
		if (source == null) {
			problems.push(`${stepsRoot}/${directory}: no \`${directory}.ts\`. Every gate over the built-in steps finds a step by that name, so a directory without one holds a step none of them can see. Name the implementation after its directory, or move the directory out of the steps root.`)
			continue
		}

		const name = /^\tName: '([^']+)'/m.exec(source)?.[1]
		if (name == null) {
			problems.push(`${mainPath}: no \`Meta.Name\` found, so no gate can tell which step this is.`)
			continue
		}

		const exportIdentifier = /^export const (\w+) = implStepPlugin\b/m.exec(source)?.[1]
		if (exportIdentifier == null) {
			problems.push(`${mainPath}: no \`export const <name> = implStepPlugin\` found, so no gate can tell which identifier the step publishes.`)
			continue
		}

		steps.push({ directory, name, exportIdentifier, path: mainPath, source })
	}

	const barrel = tree.read(stepsBarrel)
	if (barrel == null) {
		problems.push(`${stepsBarrel}: missing, so there is no independent list to check the discovered steps against.`)
		return { steps, problems }
	}

	const listed = new Set(barrelDirectories(barrel))
	if (listed.size === 0)
		problems.push(`${stepsBarrel}: re-exports no step directory. Either the barrel is empty or this scan no longer reads it, and in both cases a discovery that found nothing would look like a repository with no steps.`)

	const found = new Set(steps.map(step => step.directory))
	for (const directory of [...listed].sort()) {
		if (!found.has(directory))
			problems.push(`${stepsBarrel} re-exports './${directory}', but no step was discovered there. The gates would report a verdict that silently excludes it.`)
	}
	for (const directory of [...found].sort()) {
		if (!listed.has(directory))
			problems.push(`${stepsRoot}/${directory} holds a step that ${stepsBarrel} does not re-export, so it never reaches the published package.`)
	}

	return { steps, problems }
}
