import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const INTERNAL_PKG_SRC = path.resolve(__dirname, '../packages/internal/src')

const IGNORED_FILES = ['index.ts', 'types.ts']
const IGNORED_DIRS = ['shared'] // Shared utils might not need benchmarks or are tested via steps

function getStepName(fileName: string): string {
	return fileName.replace('.ts', '')
}

function generateBenchContent(stepName: string, relativePathToSrc: string): string {
	const importPath = relativePathToSrc
		.split('/')
		.map(() => '..')
		.join('/') || '.'

	let validSmall = 'undefined'
	let validLarge = 'undefined'
	let invalid = 'undefined'
	let baseline = ''

	// Simple heuristics for common types
	if (stepName === 'string') {
		validSmall = '\'hello\''
		validLarge = '\'x\'.repeat(1000)'
		invalid = '123'
		baseline = `
	describe('baselines', () => {
		bench('native typeof check', () => {
			typeof 'hello' === 'string'
		})
	})`
	}
	else if (stepName === 'number') {
		validSmall = '123'
		validLarge = 'Number.MAX_SAFE_INTEGER'
		invalid = '\'123\''
		baseline = `
	describe('baselines', () => {
		bench('native typeof check', () => {
			typeof 123 === 'number'
		})
	})`
	}
	else if (stepName === 'boolean') {
		validSmall = 'true'
		validLarge = 'false'
		invalid = '\'true\''
		baseline = `
	describe('baselines', () => {
		bench('native typeof check', () => {
			typeof true === 'boolean'
		})
	})`
	}
	else if (stepName === 'array') {
		validSmall = '[1, 2, 3]'
		validLarge = 'Array.from({ length: 1000 }, (_, i) => i)'
		invalid = '\'[]\''
		baseline = `
	describe('baselines', () => {
		bench('native Array.isArray', () => {
			Array.isArray([1, 2, 3])
		})
	})`
	}
	else if (stepName === 'object') {
		validSmall = '{ a: 1 }'
		validLarge = 'Object.fromEntries(Array.from({ length: 100 }, (_, i) => [i, i]))'
		invalid = 'null'
	}

	return `/**
 * Benchmark plan for ${stepName}:
 * - Operations benchmarked: ${stepName} validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, ${stepName} } from '${importPath}'

const v = createValchecker({ steps: [${stepName}] })

describe('${stepName} benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.${stepName}().execute(${validSmall})
		})

		bench('valid input - large', () => {
			v.${stepName}().execute(${validLarge})
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.${stepName}().execute(${invalid})
		})
	})
${baseline}
})
`
}

function processDirectory(dir: string) {
	const entries = fs.readdirSync(dir, { withFileTypes: true })

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name)

		if (entry.isDirectory()) {
			if (IGNORED_DIRS.includes(entry.name))
				continue
			processDirectory(fullPath)
		}
		else if (entry.isFile() && entry.name.endsWith('.ts')) {
			if (IGNORED_FILES.includes(entry.name))
				continue
			if (entry.name.endsWith('.test.ts'))
				continue
			if (entry.name.endsWith('.bench.ts'))
				continue
			if (entry.name.endsWith('.d.ts'))
				continue
			if (entry.name.endsWith('.config.ts'))
				continue

			const benchFileName = entry.name.replace('.ts', '.bench.ts')
			const benchFilePath = path.join(dir, benchFileName)

			if (fs.existsSync(benchFilePath)) {
				console.log(`Skipping existing benchmark: ${benchFilePath}`)
				continue
			}

			const stepName = getStepName(entry.name)
			// Calculate relative path from file dir to src dir to determine import depth
			// dir is e.g. .../packages/internal/src/steps/string
			// INTERNAL_PKG_SRC is .../packages/internal/src
			const relativeToSrc = path.relative(dir, INTERNAL_PKG_SRC)

			const content = generateBenchContent(stepName, relativeToSrc)
			fs.writeFileSync(benchFilePath, content)
			console.log(`Created benchmark: ${benchFilePath}`)
		}
	}
}

console.log('Generating benchmark files...')
processDirectory(INTERNAL_PKG_SRC)
console.log('Done.')
