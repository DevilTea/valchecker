import type { NarrativePage } from '../docs/_meta/pages'
import { describe, expect, it } from 'vitest'
import { analyzeDocsImpact, parseNameStatus } from './docs-impact'
import { objectTree } from './source-tree'

const page: NarrativePage = {
	id: 'pipeline',
	path: 'docs/core/pipeline.md',
	section: 'core-concepts',
	order: 10,
	title: 'Pipeline',
	archetype: 'concept',
}

function alphaSource(helperImport: string | null): string {
	return [
		helperImport == null ? null : `import { helper } from '${helperImport}'`,
		'',
		'const Meta = {',
		`\tName: 'alpha',`,
		'} as const',
		'',
		`export const alpha = implStepPlugin(Meta${helperImport == null ? '' : ', helper'})`,
		'',
	].filter(line => line != null)
		.join('\n')
}

function pageSource(root: string = 'packages/internal/src/steps/alpha/alpha.ts'): string {
	return [
		'---',
		'description: Pipeline behavior.',
		'relatedSources:',
		`  - ${root}`,
		'relatedPackages:',
		'---',
		'# Pipeline',
		'',
	].join('\n')
}

function repository(alpha = alphaSource('./helper')): Record<string, string> {
	return {
		'packages/internal/package.json': '{ "name": "@valchecker/internal" }',
		'packages/internal/src/steps/index.ts': `export * from './alpha'\n`,
		'packages/internal/src/steps/alpha/alpha.ts': alpha,
		'packages/internal/src/steps/alpha/alpha.doc.md': '### `alpha()`\n',
		'packages/internal/src/steps/alpha/helper.ts': `export const helper = 1\n`,
		'docs/core/pipeline.md': pageSource(),
	}
}

describe('documentation impact selection', () => {
	it('selects narrative and step reference owners through the same transitive dependency', () => {
		const report = analyzeDocsImpact(
			objectTree(repository()),
			[
				'docs/core/pipeline.md',
				'packages/internal/src/steps/alpha/helper.ts',
			],
			{ pages: [page] },
		)

		expect(report.problems)
			.toEqual([])
		expect(report.impacts)
			.toHaveLength(2)
		expect(report.impacts.find(impact => impact.kind === 'narrative'))
			.toMatchObject({
				path: 'docs/core/pipeline.md',
				touched: true,
				causes: [{
					changedPath: 'packages/internal/src/steps/alpha/helper.ts',
					root: 'packages/internal/src/steps/alpha/alpha.ts',
					chain: [
						'packages/internal/src/steps/alpha/alpha.ts',
						'packages/internal/src/steps/alpha/helper.ts',
					],
					revision: 'current',
				}],
			})
		expect(report.impacts.find(impact => impact.kind === 'step-reference'))
			.toMatchObject({
				path: 'packages/internal/src/steps/alpha/alpha.doc.md',
				touched: false,
			})
	})

	it('uses the base graph for a deleted dependency no longer reachable in the current tree', () => {
		const base = repository(alphaSource('./old-helper'))
		delete base['packages/internal/src/steps/alpha/helper.ts']
		base['packages/internal/src/steps/alpha/old-helper.ts'] = `export const helper = 1\n`

		const current = repository(alphaSource(null))
		const report = analyzeDocsImpact(
			objectTree(current),
			['packages/internal/src/steps/alpha/old-helper.ts'],
			{ baseTree: objectTree(base), pages: [page] },
		)

		expect(report.problems)
			.toEqual([])
		for (const impact of report.impacts) {
			expect(impact.causes)
				.toEqual([{
					changedPath: 'packages/internal/src/steps/alpha/old-helper.ts',
					root: 'packages/internal/src/steps/alpha/alpha.ts',
					chain: [
						'packages/internal/src/steps/alpha/alpha.ts',
						'packages/internal/src/steps/alpha/old-helper.ts',
					],
					revision: 'base',
				}])
		}
	})

	it('reads the base page metadata when the semantic root itself was renamed', () => {
		const oldRoot = 'packages/internal/src/pipeline-old.ts'
		const newRoot = 'packages/internal/src/pipeline-new.ts'
		const base = repository()
		base[oldRoot] = `export const pipeline = 1\n`
		base['docs/core/pipeline.md'] = pageSource(oldRoot)

		const current = repository()
		current[newRoot] = `export const pipeline = 1\n`
		current['docs/core/pipeline.md'] = pageSource(newRoot)

		const report = analyzeDocsImpact(
			objectTree(current),
			['docs/core/pipeline.md', oldRoot, newRoot],
			{ baseTree: objectTree(base), pages: [page] },
		)

		const narrative = report.impacts.find(impact => impact.kind === 'narrative')!
		expect(narrative.touched)
			.toBe(true)
		expect(narrative.causes)
			.toEqual(expect.arrayContaining([
				{
					changedPath: newRoot,
					root: newRoot,
					chain: [newRoot],
					revision: 'current',
				},
				{
					changedPath: oldRoot,
					root: oldRoot,
					chain: [oldRoot],
					revision: 'base',
				},
			]))
	})
})

describe('git name-status parsing', () => {
	it('preserves both sides of renames and copies', () => {
		expect(parseNameStatus([
			'M\tdocs/core/pipeline.md',
			'R100\tpackages/internal/src/old.ts\tpackages/internal/src/new.ts',
			'C75\tpackages/internal/src/source.ts\tpackages/internal/src/copy.ts',
			'D\tpackages/internal/src/deleted.ts',
		].join('\n')))
			.toEqual([
				'docs/core/pipeline.md',
				'packages/internal/src/old.ts',
				'packages/internal/src/new.ts',
				'packages/internal/src/source.ts',
				'packages/internal/src/copy.ts',
				'packages/internal/src/deleted.ts',
			])
	})
})
