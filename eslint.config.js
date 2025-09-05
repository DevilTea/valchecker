// @ts-check
import deviltea from '@deviltea/eslint-config'

export default deviltea(
	{
		ignores: [
			// eslint ignore globs here
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
