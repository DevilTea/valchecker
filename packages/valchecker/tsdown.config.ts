import { defineConfig } from 'tsdown'

export default defineConfig({
	entry: 'src/index.ts',
	format: ['esm', 'cjs'],
	clean: true,
	dts: {
		resolve: true,
		tsconfig: './tsconfig.package.json',
		compilerOptions: {
			composite: false,
		},
	},
})
