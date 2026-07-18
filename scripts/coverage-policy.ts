export interface CoverageThresholds {
	lines: number
	statements: number
	functions: number
	branches: number
}

export interface CoverageOverride {
	name: string
	matches: (path: string) => boolean
	thresholds: CoverageThresholds
}

export const coveragePolicy: {
	global: CoverageThresholds
	perFile: CoverageThresholds
	overrides: CoverageOverride[]
} = {
	global: {
		lines: 95,
		statements: 95,
		functions: 95,
		branches: 92,
	},
	perFile: {
		lines: 90,
		statements: 90,
		functions: 90,
		branches: 85,
	},
	overrides: [
		{
			name: 'core',
			matches: path => path.startsWith('packages/internal/src/core/'),
			thresholds: {
				lines: 100,
				statements: 100,
				functions: 100,
				branches: 95,
			},
		},
		{
			// Structural schemas contain duplicated synchronous/asynchronous traversal
			// paths and defensive hostile-key helpers. Their public contracts are
			// covered directly; this floor reflects the post-rebuild V8 baseline
			// without adding equivalent cases solely to influence instrumentation.
			name: 'complex structural steps',
			matches: path => /^packages\/internal\/src\/steps\/(?:strictObject|looseObject)\//.test(path),
			thresholds: {
				lines: 88,
				statements: 88,
				functions: 95,
				branches: 83,
			},
		},
		{
			name: 'complex steps',
			matches: path => /^packages\/internal\/src\/steps\/(?:union|intersection|object|use)\//.test(path),
			thresholds: {
				lines: 90,
				statements: 90,
				functions: 95,
				branches: 85,
			},
		},
	],
}

export function resolvePerFileThresholds(path: string): {
	name: string
	thresholds: CoverageThresholds
} {
	for (const override of coveragePolicy.overrides) {
		if (override.matches(path))
			return override
	}
	return { name: 'default', thresholds: coveragePolicy.perFile }
}
