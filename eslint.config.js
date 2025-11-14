// @ts-check
import deviltea from '@deviltea/eslint-config'

export default deviltea(
	{
		ignores: [
			// eslint ignore globs here
			'./agents_guides/*.md',
			'./**/README.md',
			'./benchmarks/PERFORMANCE_REPORT.md',
			'./benchmarks/comparison/*.md',
		],
		typescript: {
			overrides: {
				'ts/no-namespace': 'off',
			},
		},
	},
	{
		rules: {
			// overrides
		},
	},
)
