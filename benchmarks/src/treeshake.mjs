import { existsSync, readFileSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { cpus, platform, release } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { brotliCompressSync, constants as zlibConstants, gzipSync } from 'node:zlib'
import { rollup, VERSION as rollupVersion } from 'rollup'
import { minify } from 'terser'

const require = createRequire(import.meta.url)
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const aliases = new Map([
	['valchecker', resolve(repoRoot, 'packages/valchecker/dist/index.mjs')],
	['@valchecker/all-steps', resolve(repoRoot, 'packages/all-steps/dist/index.mjs')],
	['@valchecker/internal', resolve(repoRoot, 'packages/internal/dist/index.mjs')],
])
const unrelatedMarkers = ['strictObject', 'intersection', 'toUppercase', 'toJSONValue', 'toSorted']

function args(argv) {
	const outputIndex = argv.indexOf('--output')
	return { output: outputIndex >= 0 && argv[outputIndex + 1]
		? resolve(process.cwd(), argv[outputIndex + 1])
		: resolve(repoRoot, 'artifacts/tree-shaking') }
}

function packageVersion(specifier, expectedName = specifier) {
	try {
		let current = dirname(require.resolve(specifier))
		while (true) {
			const path = join(current, 'package.json')
			if (existsSync(path)) {
				const data = JSON.parse(readFileSync(path, 'utf8'))
				if (data.name === expectedName)
					return data.version ?? 'unknown'
			}
			const parent = dirname(current)
			if (parent === current)
				return 'unknown'
			current = parent
		}
	}
	catch {
		return 'unknown'
	}
}

const size = code => ({
	rawBytes: Buffer.byteLength(code),
	gzipBytes: gzipSync(code, { level: 9 }).byteLength,
	brotliBytes: brotliCompressSync(code, {
		params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11 },
	}).byteLength,
})
const bytes = value => value < 1024 ? `${value} B` : `${(value / 1024).toFixed(2)} KiB`
const percent = value => `${(value * 100).toFixed(1)}%`
const html = value => String(value)
	.replaceAll('&', '&amp;')
	.replaceAll('<', '&lt;')
	.replaceAll('>', '&gt;')
	.replaceAll('"', '&quot;')
	.replaceAll("'", '&#039;')

function resolver(entryCode) {
	return {
		name: 'tree-shaking-benchmark-resolver',
		resolveId(source) {
			if (source === 'virtual:entry')
				return '\0virtual:entry'
			if (aliases.has(source))
				return { id: aliases.get(source), moduleSideEffects: false }
			if (source.startsWith('.') || source.startsWith('/') || source.startsWith('\0'))
				return null
			try {
				const url = import.meta.resolve(source)
				return url.startsWith('file:')
					? { id: fileURLToPath(url), moduleSideEffects: false }
					: null
			}
			catch {
				return null
			}
		},
		load(id) {
			return id === '\0virtual:entry' ? entryCode : null
		},
	}
}

const scenario = (id, library, mode, group, code) => ({ id, library, mode, group, code })
const scenarios = [
	scenario('valchecker-selective-string', 'Valchecker', 'Selective chain', 'Minimal string pipeline', `
import { createValchecker, isLengthAtLeast, string, toTrimmed } from 'valchecker'
const v = createValchecker({ steps: [string, isLengthAtLeast, toTrimmed] })
export const schema = v.string().isLengthAtLeast(1).toTrimmed()
export const result = schema.execute(' value ')
`),
	scenario('valchecker-default-string', 'Valchecker', 'Default all-steps chain', 'Minimal string pipeline', `
import { v } from 'valchecker'
export const schema = v.string().isLengthAtLeast(1).toTrimmed()
export const result = schema.execute(' value ')
`),
	scenario('zod3-string', 'Zod 3', 'Classic chain', 'Minimal string pipeline', `
import { z } from 'zod3'
export const schema = z.string().min(1).trim()
export const result = schema.safeParse(' value ')
`),
	scenario('zod4-string', 'Zod 4', 'Classic chain', 'Minimal string pipeline', `
import { z } from 'zod4'
export const schema = z.string().min(1).trim()
export const result = schema.safeParse(' value ')
`),
	scenario('zod4-mini-string', 'Zod 4 Mini', 'Functional checks', 'Minimal string pipeline', `
import * as z from 'zod4/mini'
export const schema = z.string().check(z.minLength(1), z.trim())
export const result = schema.safeParse(' value ')
`),
	scenario('valibot-string', 'Valibot', 'Functional pipe', 'Minimal string pipeline', `
import * as v from 'valibot'
export const schema = v.pipe(v.string(), v.minLength(1), v.trim())
export const result = v.safeParse(schema, ' value ')
`),
	scenario('valchecker-selective-object', 'Valchecker', 'Selective chain', 'Object schema', `
import { createValchecker, isAtLeast, isInteger, number, object, string, toTrimmed } from 'valchecker'
const v = createValchecker({ steps: [string, number, object, isInteger, isAtLeast, toTrimmed] })
export const schema = v.object({ name: v.string().toTrimmed(), age: v.number().isInteger().isAtLeast(0) })
export const result = schema.execute({ name: ' Alice ', age: 25 })
`),
	scenario('valchecker-default-object', 'Valchecker', 'Default all-steps chain', 'Object schema', `
import { v } from 'valchecker'
export const schema = v.object({ name: v.string().toTrimmed(), age: v.number().isInteger().isAtLeast(0) })
export const result = schema.execute({ name: ' Alice ', age: 25 })
`),
	scenario('zod3-object', 'Zod 3', 'Classic chain', 'Object schema', `
import { z } from 'zod3'
export const schema = z.object({ name: z.string().trim(), age: z.number().int().min(0) })
export const result = schema.safeParse({ name: ' Alice ', age: 25 })
`),
	scenario('zod4-object', 'Zod 4', 'Classic chain', 'Object schema', `
import { z } from 'zod4'
export const schema = z.object({ name: z.string().trim(), age: z.number().int().min(0) })
export const result = schema.safeParse({ name: ' Alice ', age: 25 })
`),
	scenario('zod4-mini-object', 'Zod 4 Mini', 'Functional checks', 'Object schema', `
import * as z from 'zod4/mini'
export const schema = z.object({ name: z.string().check(z.trim()), age: z.int().check(z.minimum(0)) })
export const result = schema.safeParse({ name: ' Alice ', age: 25 })
`),
	scenario('valibot-object', 'Valibot', 'Functional pipe', 'Object schema', `
import * as v from 'valibot'
export const schema = v.object({ name: v.pipe(v.string(), v.trim()), age: v.pipe(v.number(), v.integer(), v.minValue(0)) })
export const result = v.safeParse(schema, { name: ' Alice ', age: 25 })
`),
	...[
		['valchecker-full', 'Valchecker', 'valchecker'],
		['zod3-full', 'Zod 3', 'zod3'],
		['zod4-full', 'Zod 4', 'zod4'],
		['zod4-mini-full', 'Zod 4 Mini', 'zod4/mini'],
		['valibot-full', 'Valibot', 'valibot'],
	].map(([id, library, specifier]) => scenario(id, library, 'Forced full namespace', 'Full-library reference', `
import * as library from '${specifier}'
globalThis.__treeShakeBenchmark = library
export { library }
`)),
]

async function bundleScenario(item, output) {
	const warnings = []
	const bundle = await rollup({
		input: 'virtual:entry',
		plugins: [resolver(item.code)],
		treeshake: { annotations: true, moduleSideEffects: false, propertyReadSideEffects: false, tryCatchDeoptimization: false },
		onwarn(warning) {
			if (warning.code !== 'CIRCULAR_DEPENDENCY')
				warnings.push(warning.message)
		},
	})
	const generated = await bundle.generate({ format: 'esm', compact: true, minifyInternalExports: true })
	await bundle.close()
	const chunk = generated.output.find(value => value.type === 'chunk')
	if (!chunk)
		throw new Error(`No JavaScript chunk generated for ${item.id}`)
	const result = await minify(chunk.code, {
		module: true,
		compress: { passes: 2, pure_getters: true },
		mangle: true,
		format: { comments: false },
	})
	if (!result.code)
		throw new Error(`Terser produced no code for ${item.id}`)
	const bundlePath = join(output, 'bundles', `${item.id}.mjs`)
	await writeFile(bundlePath, `${result.code}\n`)
	if (item.group !== 'Full-library reference') {
		const module = await import(`${pathToFileURL(bundlePath).href}?run=${Date.now()}`)
		if (!('result' in module) || module.result?.success === false || module.result?.issues)
			throw new Error(`Generated bundle for ${item.id} failed its success fixture`)
	}
	return {
		...item,
		code: undefined,
		...size(result.code),
		warnings,
		retainedMarkers: item.library === 'Valchecker'
			? unrelatedMarkers.filter(marker => result.code.includes(marker))
			: [],
		bundlePath: relative(repoRoot, bundlePath),
	}
}

const byId = (results, id) => {
	const result = results.find(value => value.id === id)
	if (!result)
		throw new Error(`Missing scenario result: ${id}`)
	return result
}
const comparison = (subject, reference, label) => {
	const difference = subject.brotliBytes / reference.brotliBytes - 1
	return {
		difference,
		finding: `Selective Valchecker is ${percent(Math.abs(difference))} ${difference <= 0 ? 'smaller' : 'larger'} than ${reference.library} for the ${label}.`,
	}
}

function analyze(results) {
	const selectiveString = byId(results, 'valchecker-selective-string')
	const defaultString = byId(results, 'valchecker-default-string')
	const selectiveObject = byId(results, 'valchecker-selective-object')
	const defaultObject = byId(results, 'valchecker-default-object')
	const full = byId(results, 'valchecker-full')
	const comparisons = [
		comparison(selectiveString, byId(results, 'zod4-string'), 'string pipeline'),
		comparison(selectiveObject, byId(results, 'zod4-object'), 'object schema'),
		comparison(selectiveString, byId(results, 'zod4-mini-string'), 'string pipeline'),
		comparison(selectiveObject, byId(results, 'zod4-mini-object'), 'object schema'),
		comparison(selectiveString, byId(results, 'valibot-string'), 'string pipeline'),
		comparison(selectiveObject, byId(results, 'valibot-object'), 'object schema'),
	]
	const stringReduction = 1 - selectiveString.brotliBytes / defaultString.brotliBytes
	const objectReduction = 1 - selectiveObject.brotliBytes / defaultObject.brotliBytes
	const selectiveRetained = selectiveString.brotliBytes / full.brotliBytes
	const markersAbsent = selectiveString.retainedMarkers.length === 0
	const checks = [
		{ name: 'Selective minimal chain is materially smaller than default v', passed: stringReduction >= 0.2, value: percent(stringReduction) },
		{ name: 'Selective object schema is materially smaller than default v', passed: objectReduction >= 0.2, value: percent(objectReduction) },
		{ name: 'Selective minimal chain retains at most 75% of forced full library', passed: selectiveRetained <= 0.75, value: percent(selectiveRetained) },
		{ name: 'Unselected Valchecker step markers are absent from the minimal selective bundle', passed: markersAbsent, value: markersAbsent ? 'none retained' : selectiveString.retainedMarkers.join(', ') },
	]
	return {
		status: checks.every(check => check.passed) ? 'healthy' : 'needs-attention',
		checks,
		findings: comparisons.map(value => value.finding),
		metrics: { stringReduction, objectReduction, selectiveRetained, crossLibraryDifferences: comparisons.map(value => value.difference) },
	}
}

function table(results) {
	const rows = results.map(result => `| ${result.library} | ${result.mode} | ${bytes(result.rawBytes)} | ${bytes(result.gzipBytes)} | ${bytes(result.brotliBytes)} |`).join('\n')
	return `| Library | API mode | Minified | Gzip | Brotli |\n| --- | --- | ---: | ---: | ---: |\n${rows}`
}

function markdown(report, concise = false) {
	const checks = report.analysis.checks.map(check => `- ${check.passed ? 'PASS' : 'WARN'} — ${check.name}: **${check.value}**`).join('\n')
	const findings = report.analysis.findings.map(value => `- ${value}`).join('\n')
	const headline = report.analysis.status === 'healthy'
		? 'Selective Valchecker builds show a material tree-shaking benefit.'
		: 'The current selective-build signal is weaker than the report thresholds and needs investigation.'
	const context = `Generated with Rollup ${report.environment.rollup}, Terser ${report.environment.terser}, Node.js ${report.environment.node}. Brotli is the primary comparison metric.`
	const body = concise
		? table(report.results.filter(result => result.group === 'Minimal string pipeline'))
		: ['Minimal string pipeline', 'Object schema', 'Full-library reference']
			.map(group => `## ${group}\n\n${table(report.results.filter(result => result.group === group))}`)
			.join('\n\n')
	return `# Tree-shaking ${concise ? 'summary' : 'report'}\n\n**${headline}**\n\n${checks}\n\n## Key comparisons\n\n${findings}\n\n${body}\n\n${context}\n`
}

function htmlReport(report) {
	const rows = report.results.map(result => `<tr><td>${html(result.library)}</td><td>${html(result.mode)}</td><td>${bytes(result.rawBytes)}</td><td>${bytes(result.gzipBytes)}</td><td>${bytes(result.brotliBytes)}</td></tr>`).join('')
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Valchecker tree-shaking report</title></head><body><h1>Tree-shaking report</h1><p>Status: <strong>${html(report.analysis.status)}</strong></p><table><thead><tr><th>Library</th><th>API mode</th><th>Minified</th><th>Gzip</th><th>Brotli</th></tr></thead><tbody>${rows}</tbody></table></body></html>`
}

async function main() {
	const { output } = args(process.argv.slice(2))
	await rm(output, { recursive: true, force: true })
	await mkdir(join(output, 'bundles'), { recursive: true })
	const results = []
	for (const item of scenarios)
		results.push(await bundleScenario(item, output))
	const packageData = JSON.parse(await readFile(resolve(repoRoot, 'packages/valchecker/package.json'), 'utf8'))
	const report = {
		generatedAt: new Date().toISOString(),
		commit: process.env.REPORT_COMMIT ?? process.env.GITHUB_SHA ?? null,
		environment: {
			node: process.version,
			platform: `${platform()} ${release()}`,
			cpu: cpus()[0]?.model ?? 'unknown',
			rollup: rollupVersion,
			terser: packageVersion('terser'),
			versions: {
				valchecker: packageData.version,
				zod3: packageVersion('zod3', 'zod'),
				zod4: packageVersion('zod4', 'zod'),
				valibot: packageVersion('valibot'),
			},
		},
		results,
		analysis: analyze(results),
	}
	await Promise.all([
		writeFile(join(output, 'raw.json'), `${JSON.stringify(report, null, 2)}\n`),
		writeFile(join(output, 'summary.md'), markdown(report, true)),
		writeFile(join(output, 'report.md'), markdown(report)),
		writeFile(join(output, 'report.html'), htmlReport(report)),
	])
	console.log(markdown(report, true))
	if (report.analysis.status !== 'healthy')
		process.exitCode = 1
}

main().catch((error) => {
	console.error(error)
	process.exitCode = 1
})