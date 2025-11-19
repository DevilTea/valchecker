import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { $ } from 'zx'

const theDir = fileURLToPath(new URL('../packages/valchecker/src/schemas', import.meta.url))

async function run() {
	const files = (await $`find ${theDir} -type f`.text()).split('\n')
		.filter(Boolean)
	for (const file of files) {
		const filename = file.split('/')
			.pop()!.split('.')
			.shift()!
		const dir = `${theDir}/${filename}.ts`
		await $`mkdir -p ${dir}` // create dir
		await $`mv ${file} ${dir}` // remove .ts
		await writeFile(`${dir}/index.ts`, `export * from './${filename}'\n`) // create index.ts
	}
}

run()
