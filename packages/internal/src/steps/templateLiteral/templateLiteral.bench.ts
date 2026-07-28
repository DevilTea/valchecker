import { createValchecker, literal, number, templateLiteral, union } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [literal, number, templateLiteral, union] })

// A placeholder followed by a union part is the representative shape: it splits the
// string and then tries the member set, where a pure literal template is one comparison.
// The parts are compiled at construction and execution runs no child schema, so this
// step has no child loop to make non-empty and no `collectAllIssues` option.
const schema = v.templateLiteral([v.number(), v.union(['px', 'em', 'rem'])])

const matching = '12px'
const notMatching = '12pt'

stepBench('templateLiteral', [
	{
		name: 'valid',
		group: 'warm/success',
		expect: { success: true },
		batch: 50,
		run: () => schema.execute(matching),
	},
	{
		name: 'expected-template-literal',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['templateLiteral:expected_template_literal'] },
		batch: 50,
		run: () => schema.execute(notMatching),
	},
])
