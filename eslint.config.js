// @ts-check
import deviltea from '@deviltea/eslint-config'

export default deviltea(
	{
		ignores: [
			// eslint ignore globs here
			'./.github/skills/**/*.md',
			'./**/README.md',
		],
		typescript: {
			overrides: {
				'ts/no-namespace': 'off',
			},
		},
	},
	{
		rules: {
			'style/no-mixed-spaces-and-tabs': 'warn',
		},
	},
)
