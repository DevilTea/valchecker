// @ts-check
import deviltea from '@deviltea/eslint-config'

export default deviltea(
	{
		ignores: [
			// eslint ignore globs here
			'./.claude/**/*.md',
			'./.agents/**/*.md',
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
	{
		// benchmarks/ is intentionally NOT a workspace member: CI installs it with
		// `pnpm --dir benchmarks install --ignore-workspace`, where `catalog:` cannot resolve.
		files: ['benchmarks/package.json'],
		rules: {
			'pnpm/json-enforce-catalog': 'off',
		},
	},
)
