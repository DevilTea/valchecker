import { describe, expect, it } from 'vitest'
import { auditDocumentationMarkdown } from './docs-markdown'
import { objectTree } from './source-tree'

describe('documentation Markdown audit', () => {
	it('accepts Graphviz and explained compile skips', () => {
		const tree = objectTree({
			'docs/concept.md': [
				'# Concept',
				'',
				'```dot',
				'digraph { a -> b }',
				'```',
				'',
				'<!-- Historical API shown deliberately. -->',
				'<!-- typecheck-skip -->',
				'```ts',
				'oldApi()',
				'```',
			].join('\n'),
		})

		expect(auditDocumentationMarkdown(tree))
			.toEqual([])
	})

	it('rejects Mermaid and unaudited compile skips', () => {
		const tree = objectTree({
			'docs/concept.md': [
				'# Concept',
				'```mermaid',
				'flowchart LR',
				'```',
				'<!-- typecheck-skip -->',
				'```ts',
				'fragment()',
				'```',
			].join('\n'),
		})

		expect(auditDocumentationMarkdown(tree))
			.toEqual([
				'docs/concept.md:2 uses unsupported `mermaid` diagram syntax; use Graphviz DOT instead.',
				'docs/concept.md:5 has `typecheck-skip` without a preceding explanatory HTML comment.',
			])
	})

	it('ignores diagram-like text nested inside a larger code fence', () => {
		const tree = objectTree({
			'docs/authoring.md': [
				'# Authoring',
				'````md',
				'```mermaid',
				'flowchart LR',
				'```',
				'````',
			].join('\n'),
		})

		expect(auditDocumentationMarkdown(tree))
			.toEqual([])
	})
})
