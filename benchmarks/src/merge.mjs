// Joins the shard results of one sharded run into a single `raw.json` that
// `report`, `summary`, and `compare` read unchanged. The joining rules and every
// consistency check live in `sharding.mjs`, so they can be tested directly; this
// file is only the file I/O around them.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { mergeShardResults } from './sharding.mjs'

const benchmarkRoot = fileURLToPath(new URL('..', import.meta.url))

function parseArguments(argv) {
	const options = {
		inputs: [],
		output: resolve(benchmarkRoot, 'results/raw.json'),
	}
	for (let index = 0; index < argv.length; index++) {
		const argument = argv[index]
		const value = argv[index + 1]
		if (argument === '--input' && value) {
			options.inputs.push(resolve(benchmarkRoot, value))
			index++
		}
		else if (argument === '--output' && value) {
			options.output = resolve(benchmarkRoot, value)
			index++
		}
		else {
			throw new Error(`Unknown or incomplete argument: ${argument}`)
		}
	}
	if (options.inputs.length === 0)
		throw new Error('At least one --input shard result is required')
	return options
}

const options = parseArguments(process.argv.slice(2))
// eslint-disable-next-line antfu/no-top-level-await -- top-level await in an ESM benchmark entry script executed to completion at load
const shards = await Promise.all(options.inputs.map(path => readFile(path, 'utf8')
	.then(JSON.parse)))
const merged = mergeShardResults(shards)
// eslint-disable-next-line antfu/no-top-level-await -- top-level await in an ESM benchmark entry script executed to completion at load
await mkdir(dirname(options.output), { recursive: true })
// eslint-disable-next-line antfu/no-top-level-await -- top-level await in an ESM benchmark entry script executed to completion at load
await writeFile(options.output, `${JSON.stringify(merged, null, 2)}\n`)
console.error(`[benchmark] merged ${shards.length} shard${shards.length === 1 ? '' : 's'} covering ${merged.scenarioCatalog.length} scenarios into ${options.output}`)
