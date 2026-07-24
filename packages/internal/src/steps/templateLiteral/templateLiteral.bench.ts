import { bench, describe } from 'vitest'
import { createValchecker, literal, number, string, templateLiteral, union } from '../..'

const v = createValchecker({ steps: [templateLiteral, string, number, literal, union] })

const literalPrefix = v.templateLiteral(['ID-', v.number()])
const adjacent = v.templateLiteral([v.number(), v.string()])
const unionCross = v.templateLiteral([v.number(), v.union(['px', 'em', 'rem'])])

describe('templateLiteral benchmarks', () => {
	bench('construction (small)', () => {
		v.templateLiteral(['ID-', v.number()])
	})

	bench('construction (union cross-product)', () => {
		v.templateLiteral([v.number(), v.union(['px', 'em', 'rem'])])
	})

	bench('valid match (literal prefix)', () => {
		literalPrefix.execute('ID-42')
	})

	bench('valid match (adjacent placeholders)', () => {
		adjacent.execute('1abc')
	})

	bench('valid match (union cross-product)', () => {
		unionCross.execute('12px')
	})

	bench('invalid string', () => {
		literalPrefix.execute('ID-x')
	})

	bench('non-string input', () => {
		literalPrefix.execute(42)
	})
})
