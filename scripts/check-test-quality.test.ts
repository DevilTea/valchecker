import { describe, expect, it } from 'vitest'
import { checkTestQualitySource } from './check-test-quality'

describe('test quality syntax checks', () => {
	it('rejects aliases, namespace, multiline calls, element access, skipIf, and todo forms', () => {
		const errors = checkTestQualitySource(`
			import { describe as group, it as caseTest, test } from 'vitest'
			import * as vitest from 'vitest'
			caseTest
				.skipIf(true)('conditional', () => {})
			caseTest.skipIf(true)
			caseTest.todo('later')
			test.skip('focused', () => {})
			test['skip']('element access', () => {})
			group.todo('pending', () => {})
			vitest.it.skip('namespace', () => {})
		`, 'scripts/adversarial.test.ts')
		expect(errors.filter(error => error.includes('focused, skipped, or todo test')))
			.toHaveLength(7)
	})
})
