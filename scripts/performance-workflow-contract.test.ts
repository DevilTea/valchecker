import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { performanceVerdictWorkflowProblems } from './performance-workflow-contract'

const workflow = readFileSync(new URL('../.github/workflows/performance-impact.yml', import.meta.url), 'utf8')
	.replaceAll('\r\n', '\n')
const githubExpression = (expression: string): string => '$' + `{{ ${expression} }}`

describe('performance Impact verdict workflow contract', () => {
	it('accepts the current executable verdict authority path', () => {
		expect(performanceVerdictWorkflowProblems(workflow))
			.toEqual([])
	})

	it('accepts the same executable contract with CRLF line endings', () => {
		expect(performanceVerdictWorkflowProblems(workflow.replaceAll('\n', '\r\n')))
			.toEqual([])
	})

	it('rejects require-resolved when it survives only as a shell comment', () => {
		const mutated = workflow.replace(
			'            --fail-on-regression \\\n            --require-resolved',
			'            --fail-on-regression\n          # --require-resolved',
		)
		expect(performanceVerdictWorkflowProblems(mutated))
			.toContain('Resolve the two stages step must end with the exact gated confirmation command')
	})

	it('rejects a verdict step disabled by an if condition', () => {
		const mutated = workflow.replace(
			'      - name: Resolve the two stages\n        shell: bash',
			'      - name: Resolve the two stages\n        if: false\n        shell: bash',
		)
		expect(performanceVerdictWorkflowProblems(mutated)[0])
			.toMatch(/step keys must equal/)
	})

	it('rejects a verdict step allowed to continue on error', () => {
		const mutated = workflow.replace(
			'      - name: Resolve the two stages\n        shell: bash',
			'      - name: Resolve the two stages\n        continue-on-error: true\n        shell: bash',
		)
		expect(performanceVerdictWorkflowProblems(mutated)[0])
			.toMatch(/step keys must equal/)
	})

	it('pins the environment inputs used to reconstruct the confirmation evidence', () => {
		const target = `          PLAN: ${githubExpression('needs.compare.outputs.confirm_plan')}`
		const index = workflow.lastIndexOf(target)
		expect(index)
			.toBeGreaterThanOrEqual(0)
		const mutated = `${workflow.slice(0, index)}          PLAN: {}${workflow.slice(index + target.length)}`
		expect(performanceVerdictWorkflowProblems(mutated)
			.some(problem => problem.includes('step env must equal')))
			.toBe(true)
	})
})
