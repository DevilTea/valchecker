import { describe, expect, it } from 'vitest'
import { buildSourceImportGraph, importPath, objectTree } from './source-tree'

const repository = {
	'packages/app/package.json': '{ "name": "app" }',
	'packages/app/src/index.ts': `export * from '@valchecker/internal'\n`,
	'packages/internal/package.json': '{ "name": "@valchecker/internal" }',
	'packages/internal/src/index.ts': `export * from './feature'\n`,
	'packages/internal/src/feature.ts': `import { helper } from './shared/helper.js'\n\nexport const feature = helper\n`,
	'packages/internal/src/shared/helper.ts': `export const helper = 1\n`,
}

describe('source import graph', () => {
	it('shares workspace and TypeScript-relative resolution across arbitrary roots', () => {
		const graph = buildSourceImportGraph(objectTree(repository), ['packages/app/src/index.ts'])

		expect(graph.problems)
			.toEqual([])
		expect([...graph.reachable].sort())
			.toEqual([
				'packages/app/src/index.ts',
				'packages/internal/src/feature.ts',
				'packages/internal/src/index.ts',
				'packages/internal/src/shared/helper.ts',
			])
		expect(importPath(graph, 'packages/app/src/index.ts', 'packages/internal/src/shared/helper.ts'))
			.toEqual([
				'packages/app/src/index.ts',
				'packages/internal/src/index.ts',
				'packages/internal/src/feature.ts',
				'packages/internal/src/shared/helper.ts',
			])
	})

	it('reports an unresolved edge instead of silently dropping it', () => {
		const graph = buildSourceImportGraph(objectTree({
			...repository,
			'packages/internal/src/feature.ts': `import { missing } from './missing'\n\nexport const feature = missing\n`,
		}), ['packages/internal/src/feature.ts'])

		expect(graph.problems)
			.toEqual([`packages/internal/src/feature.ts: cannot resolve './missing'`])
	})

	it('reports a non-literal dynamic import as an incomplete edge', () => {
		const graph = buildSourceImportGraph(objectTree({
			...repository,
			'packages/internal/src/feature.ts': `export const load = (name: string) => import(name)\n`,
		}), ['packages/internal/src/feature.ts'])

		expect(graph.problems)
			.toEqual(['packages/internal/src/feature.ts: a dynamic import whose specifier this scan cannot resolve'])
	})

	it('allows callers to preserve domain-specific unreadable diagnostics', () => {
		const graph = buildSourceImportGraph(objectTree(repository), ['packages/internal/src/missing.ts'], {
			unreadableFile: path => `${path}: custom unreadable reason`,
		})

		expect(graph.problems)
			.toEqual(['packages/internal/src/missing.ts: custom unreadable reason'])
	})
})
