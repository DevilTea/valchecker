import { describe, expect, it } from 'vitest'
import { objectTree } from './source-tree'
import { barrelDirectories, discoverSteps } from './step-inventory'

/**
 * What these protect is the direction a discovery bug points: not a wrong verdict, but a verdict
 * about fewer steps than the repository has. Every gate over the built-in steps prints a count
 * and exits 0, so a step that discovery never saw is a step reported as fine.
 *
 * Every expectation is written out from the synthetic repository below, never computed with the
 * function under test.
 */

const stepsRoot = 'packages/internal/src/steps'

function main(name: string, exportIdentifier = name): string {
	return [
		`import { implStepPlugin } from '../../core'`,
		'',
		'type Meta = DefineStepMethodMeta<{',
		`\tName: '${name}'`,
		'}>',
		'',
		`export const ${exportIdentifier} = implStepPlugin<PluginDef>({}, 'sync')`,
		'',
	].join('\n')
}

function repository(files: Record<string, string>, barrel?: string): ReturnType<typeof objectTree> {
	const directories = [...new Set(Object.keys(files)
		.filter(path => path.startsWith(`${stepsRoot}/`))
		.map(path => path.slice(stepsRoot.length + 1)
			.split('/')[0]!))]
	return objectTree({
		[`${stepsRoot}/index.ts`]: barrel ?? `${directories.map(directory => `export * from './${directory}'`)
			.join('\n')}\n`,
		...files,
	})
}

describe('barrelDirectories', () => {
	it('reads the directory out of every re-export line', () => {
		expect(barrelDirectories('export * from \'./isEmail\'\nexport * from \'./toTrimmed\'\n'))
			.toEqual(['isEmail', 'toTrimmed'])
	})

	it('reads a CRLF barrel the same as an LF one', () => {
		expect(barrelDirectories('export * from \'./isEmail\'\r\nexport * from \'./toTrimmed\'\r\n'))
			.toEqual(['isEmail', 'toTrimmed'])
	})

	it('ignores a re-export that is not a sibling step directory', () => {
		expect(barrelDirectories('export * from \'../core\'\nexport * from \'./isEmail/isEmail\'\n'))
			.toEqual([])
	})
})

describe('discoverSteps', () => {
	it('finds the name and the exported identifier of every step', () => {
		const { steps, problems } = discoverSteps(repository({
			[`${stepsRoot}/isEmail/isEmail.ts`]: main('isEmail'),
			[`${stepsRoot}/null/null.ts`]: main('null', 'null_'),
		}))

		expect(problems)
			.toEqual([])
		expect(steps.map(step => [step.directory, step.name, step.exportIdentifier]))
			.toEqual([
				['isEmail', 'isEmail', 'isEmail'],
				['null', 'null', 'null_'],
			])
		expect(steps[0]!.path)
			.toBe(`${stepsRoot}/isEmail/isEmail.ts`)
	})

	it('reads a CRLF checkout the same as an LF one', () => {
		const { steps, problems } = discoverSteps(repository({
			[`${stepsRoot}/isEmail/isEmail.ts`]: main('isEmail')
				.replaceAll('\n', '\r\n'),
		}, 'export * from \'./isEmail\'\r\n'))

		expect(problems)
			.toEqual([])
		expect(steps.map(step => step.name))
			.toEqual(['isEmail'])
	})

	// The reviewer's `steps/zzzGhost/plugin.ts`: the old scan skipped it and still reported
	// "114 steps", so the gate congratulated itself on a set it had not seen.
	it('fails on a step directory whose implementation is not named after it', () => {
		const { steps, problems } = discoverSteps(repository(
			{
				[`${stepsRoot}/isEmail/isEmail.ts`]: main('isEmail'),
				[`${stepsRoot}/zzzGhost/plugin.ts`]: main('zzzGhost'),
			},
			'export * from \'./isEmail\'\n',
		))

		expect(steps.map(step => step.directory))
			.toEqual(['isEmail'])
		expect(problems)
			.toHaveLength(1)
		expect(problems[0])
			.toContain(`${stepsRoot}/zzzGhost: no \`zzzGhost.ts\``)
	})

	it('also fails a ghost the barrel does export, which is the case that ships', () => {
		const { problems } = discoverSteps(repository({
			[`${stepsRoot}/isEmail/isEmail.ts`]: main('isEmail'),
			[`${stepsRoot}/zzzGhost/plugin.ts`]: main('zzzGhost'),
		}))

		expect(problems)
			.toHaveLength(2)
		expect(problems[0])
			.toContain(`${stepsRoot}/zzzGhost: no \`zzzGhost.ts\``)
		expect(problems[1])
			.toContain('re-exports \'./zzzGhost\', but no step was discovered there')
	})

	it('fails rather than reporting an empty repository as consistent', () => {
		expect(discoverSteps(objectTree({ [`${stepsRoot}/index.ts`]: '\n' })).problems)
			.toEqual([`${stepsRoot}/index.ts: re-exports no step directory. Either the barrel is empty or this scan no longer reads it, and in both cases a discovery that found nothing would look like a repository with no steps.`])
	})

	it('fails when the steps directory is missing entirely', () => {
		const { steps, problems } = discoverSteps(objectTree({ 'package.json': '{}' }))
		expect(steps)
			.toEqual([])
		expect(problems)
			.toEqual([`${stepsRoot}: the built-in step directory is missing, so this gate has nothing to check.`])
	})

	it('fails when the barrel is missing, because then nothing checks the discovered set', () => {
		const { problems } = discoverSteps(objectTree({ [`${stepsRoot}/isEmail/isEmail.ts`]: main('isEmail') }))
		expect(problems)
			.toEqual([`${stepsRoot}/index.ts: missing, so there is no independent list to check the discovered steps against.`])
	})

	it('fails when the barrel names a directory discovery did not produce a step from', () => {
		const { problems } = discoverSteps(repository(
			{ [`${stepsRoot}/isEmail/isEmail.ts`]: main('isEmail') },
			'export * from \'./isEmail\'\nexport * from \'./toTrimmed\'\n',
		))
		expect(problems)
			.toEqual([`${stepsRoot}/index.ts re-exports './toTrimmed', but no step was discovered there. The gates would report a verdict that silently excludes it.`])
	})

	it('fails when a discovered step is not re-exported by the barrel', () => {
		const { problems } = discoverSteps(repository(
			{
				[`${stepsRoot}/isEmail/isEmail.ts`]: main('isEmail'),
				[`${stepsRoot}/toTrimmed/toTrimmed.ts`]: main('toTrimmed'),
			},
			'export * from \'./isEmail\'\n',
		))
		expect(problems)
			.toEqual([`${stepsRoot}/toTrimmed holds a step that ${stepsRoot}/index.ts does not re-export, so it never reaches the published package.`])
	})

	it('fails on a step with no Meta.Name', () => {
		const { problems } = discoverSteps(repository({
			[`${stepsRoot}/isEmail/isEmail.ts`]: 'export const isEmail = implStepPlugin<PluginDef>({}, \'sync\')\n',
		}))
		expect(problems[0])
			.toContain('no `Meta.Name` found')
	})

	it('fails on a step with no implStepPlugin export', () => {
		const { problems } = discoverSteps(repository({
			[`${stepsRoot}/isEmail/isEmail.ts`]: `type Meta = {\n\tName: 'isEmail'\n}\n`,
		}))
		expect(problems[0])
			.toContain('no `export const <name> = implStepPlugin` found')
	})
})
