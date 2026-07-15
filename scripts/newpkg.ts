import { writeFile } from 'node:fs/promises'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { cancel, intro, isCancel, outro, text } from '@clack/prompts'
import { join } from 'pathe'
import { $ } from 'zx'

intro('Create a new package')

const pkgDirname = await text({
	message: 'Package directory name (/packages/<pkgDirname>)',
	validate: (value) => {
		if (!value)
			return 'Required.'
		if (!/^[a-z0-9-]+$/.test(value))
			return 'Only lowercase letters, numbers, and hyphens are allowed.'
		return void 0
	},
})

if (isCancel(pkgDirname)) {
	cancel('Operation cancelled.')
	process.exit(0)
}

const pkgName = await text({
	message: 'Package name (@deviltea/<pkgName>)',
	initialValue: pkgDirname,
	validate: (value) => {
		if (!value)
			return 'Required.'
		if (!/^[a-z0-9-]+$/.test(value))
			return 'Only lowercase letters, numbers, and hyphens are allowed.'
		return void 0
	},
})

if (isCancel(pkgName)) {
	cancel('Operation cancelled.')
	process.exit(0)
}

const root = fileURLToPath(new URL('..', import.meta.url))
const packageDir = join(root, 'packages', pkgDirname)

await $`(rm -rf ${packageDir} || true) \
		&& mkdir -p ${packageDir} \
		&& mkdir -p ${join(packageDir, 'src')} \
		&& mkdir -p ${join(packageDir, 'tests')} \
`

const pkgJson = JSON.parse((await $`cat ${join(root, 'package.json')}`).stdout)

const templates = {
	'package.json': `
{
	"name": "@deviltea/${pkgName}",
	"type": "module",
	"publishConfig": {
		"access": "public"
	},
	"version": "${pkgJson.version}",
	"author": "DevilTea <ch19980814@gmail.com>",
	"license": "MIT",
	"repository": {
		"type": "git",
		"url": "git+https://github.com/DevilTea/valchecker.git",
		"directory": "packages/${pkgDirname}"
	},
	"bugs": {
		"url": "https://github.com/DevilTea/valchecker/issues"
	},
	"keywords": [],
	"sideEffects": false,
	"exports": {
		".": {
			"types": "./dist/index.d.mts",
			"import": "./dist/index.mjs",
			"default": "./dist/index.mjs"
		}
	},
	"main": "./dist/index.mjs",
	"types": "./dist/index.d.mts",
	"files": [
		"dist"
	],
	"scripts": {
		"build": "tsdown && pkg-size",
		"build:pack": "pnpm build && pnpm pack",
		"stub": "tsdown --watch",
		"typecheck": "pnpm typecheck:package && pnpm typecheck:test",
		"typecheck:package": "tsc --project ./tsconfig.package.json --noEmit",
		"typecheck:test": "tsc --project ./tsconfig.tests.json --noEmit"
	}
}
	`.trim(),
	'tsdown.config.ts': `
import { defineConfig } from 'tsdown'

export default defineConfig({
	entry: 'src/index.ts',
	format: ['esm'],
	clean: true,
	dts: {
		resolve: true,
		tsconfig: './tsconfig.package.json',
		compilerOptions: {
			composite: false,
		},
	},
})
	`.trim(),
	'src/index.ts': `
export {}
	`.trim(),
	'tests/some.test.ts': `
import { describe, expect, it } from 'vitest'

describe('hello', () => {
	it('is ok', () => {
		expect(true).toBe(true)
	})
})
	`.trim(),
	'tsconfig.json': `
{
	"references": [
		{ "path": "./tsconfig.package.json" },
		{ "path": "./tsconfig.tests.json" }
	],
	"files": []
}
	`.trim(),
	'tsconfig.package.json': `
{
	"extends": "@deviltea/tsconfig/base",
	"compilerOptions": {
		"composite": true
	},
	"include": [
		"./src/**/*.ts"
	]
}
	`.trim(),
	'tsconfig.tests.json': `
{
	"extends": "@deviltea/tsconfig/node",
	"compilerOptions": {
		"composite": true
	},
	"include": [
		"./src/**/*.ts",
		"./tests/**/*.ts"
	]
}
	`.trim(),
}

for (const [filename, content] of Object.entries(templates)) {
	await writeFile(join(packageDir, filename), `${content}\n`)
}

const rootTsConfig = JSON.parse((await $`cat ${join(root, 'tsconfig.json')}`).stdout)
const pkgTsConfigPath = `./packages/${pkgDirname}/tsconfig.json`
if (rootTsConfig.extends.includes(pkgTsConfigPath) === false) {
	rootTsConfig.extends.push(pkgTsConfigPath)
	await writeFile(join(root, 'tsconfig.json'), `${JSON.stringify(rootTsConfig, null, '\t')}\n`)
}

outro(`Package "${pkgName}" created.`)
