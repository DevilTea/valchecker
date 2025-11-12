import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
	entries: ['src/index.ts', 'src/allSteps/allSteps.ts'],
	clean: true,
	declaration: true,
	rollup: {
		dts: {
			tsconfig: './tsconfig.package.json',
			compilerOptions: {
				composite: false,
			},
		},
		emitCJS: true,
	},
})
