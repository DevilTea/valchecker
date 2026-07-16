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
const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '../..')
const packageAliases = new Map([
	['valchecker', resolve(repoRoot, 'packages/valchecker/dist/index.mjs')],
	['@valchecker/all-steps', resolve(repoRoot, 'packages/all-steps/dist/index.mjs')],
	['@valchecker/internal', resolve(repoRoot, 'packages/internal/dist/index.mjs')],
])
const unrelatedValcheckerMarkers = [
	'strictObject',
	'intersection',
	'toUppercase',
	'parseJSON',
	'toSorted',
]

function parseArguments(argv) {
	const options = { output: resolve(repoRoot, 'artifacts/tree-shaking') }
	for (let index = 0; index < argv.length; index++) {
		if (argv[index] === '--output' && argv[index + 1])
			options.output = resolve(process.cwd(), argv[++index])
	}
	return options
}

function packageVersion(name) {
	try {
		let current = dirname(require.resolve(name))
		while (true) {
			const packagePath = join(current, 'package.json')
			if (existsSync(packagePath))
				return JSON.parse(readFileSync(packagePath, 'utf8')).version ?? 'unknown'
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

function formatBytes(value) {
	return value < 1024 ? `${value} B` : `${(value / 1024).toFixed(2)} KiB`
}

function formatPercent(value) {
	return `${(value * 100).toFixed(1)}%`
}

function escapeHtml(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#039;')
}

function compressedSizes(code) {
	return {
		rawBytes: Buffer.byteLength(code),
		gzipBytes: gzipSync(code, { level: 9 }).byteLength,
		brotliBytes: brotliCompressSync(code, {
			params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11 },
		}).byteLength,
	}
}

function resolver(entryCode) {
	return {
		name: 'tree-shaking-benchmark-resolver',
		resolveId(source) {
			if (source === 'virtual:entry')
				return '\0virtual:entry'
			if (packageAliases.has(source))
				return { id: packageAliases.get(source), moduleSideEffects: false }
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

const scenarios = [
	{
		id: 'valchecker-selective-string',
		library: 'Valchecker',
		mode: 'Selective chain',
		group: 'Minimal string pipeline',
		code: `
import { createValchecker, min, string, toTrimmed } from 'valchecker'
const v = createValchecker({ steps: [string, min, toTrimmed] })
export const schema = v.string().min(1).toTrimmed()
export const result = schema.execute(' value ')
`,
	},
	{
		id: 'valchecker-default-string',
		library: 'Valchecker',
		mode: 'Default all-steps chain',
		group: 'Minimal string pipeline',
		code: `
import { v } from 'valchecker'
export const schema = v.string().min(1).toTrimmed()
export const result = schema.execute(' value ')
`,
	},
	{
		id: 'zod3-string',
		library: 'Zod 3',
		mode: 'Classic chain',
		group: 'Minimal string pipeline',
		code: `
import { z } from 'zod3'
export const schema = z.string().min(1).trim()
export const result = schema.safeParse(' value ')
`,
	},
	{
		id: 'zod4-string',
		library: 'Zod 4',
		mode: 'Classic chain',
		group: 'Minimal string pipeline',
		code: `
import { z } from 'zod4'
export const schema = z.string().min(1).trim()
export const result = schema.safeParse(' value ')
`,
	},
	{
		id: 'valibot-string',
		library: 'Valibot',
		mode: 'Functional pipe',
		group: 'Minimal string pipeline',
		code: `
import * as v from 'valibot'
export const schema = v.pipe(v.string(), v.minLength(1), v.trim())
export const result = v.safeParse(schema, ' value ')
`,
	},
	{
		id: 'valchecker-selective-object',
		library: 'Valchecker',
		mode: 'Selective chain',
		group: 'Object schema',
		code: `
import { createValchecker, integer, min, number, object, string, toTrimmed } from 'valchecker'
const v = createValchecker({ steps: [string, number, object, integer, min, toTrimmed] })
export const schema = v.object({
	name: v.string().toTrimmed(),
	age: v.number().integer().min(0),
})
export const result = schema.execute({ name: ' Alice ', age: 25 })
`,
	},
	{
		id: 'valchecker-default-object',
		library: 'Valchecker',
		mode: 'Default all-steps chain',
		group: 'Object schema',
		code: `
import { v } from 'valchecker'
export const schema = v.object({
	name: v.string().toTrimmed(),
	age: v.number().integer().min(0),
})
export const result = schema.execute({ name: ' Alice ', age: 25 })
`,
	},
	{
		id: 'zod3-object',
		library: 'Zod 3',
		mode: 'Classic chain',
		group: 'Object schema',
		code: `
import { z } from 'zod3'
export const schema = z.object({
	name: z.string().trim(),
	age: z.number().int().min(0),
})
export const result = schema.safeParse({ name: ' Alice ', age: 25 })
`,
	},
	{
		id: 'zod4-object',
		library: 'Zod 4',
		mode: 'Classic chain',
		group: 'Object schema',
		code: `
import { z } from 'zod4'
export const schema = z.object({
	name: z.string().trim(),
	age: z.number().int().min(0),
})
export const result = schema.safeParse({ name: ' Alice ', age: 25 })
`,
	},
	{
		id: 'valibot-object',
		library: 'Valibot',
		mode: 'Functional pipe',
		group: 'Object schema',
		code: `
import * as v from 'valibot'
export const schema = v.object({
	name: v.pipe(v.string(), v.trim()),
	age: v.pipe(v.number(), v.integer(), v.minValue(0)),
})
export const result = v.safeParse(schema, { name: ' Alice ', age: 25 })
`,
	},
	...[
		['valchecker-full', 'Valchecker', 'valchecker'],
		['zod3-full', 'Zod 3', 'zod3'],
		['zod4-full', 'Zod 4', 'zod4'],
		['valibot-full', 'Valibot', 'valibot'],
	].map(([id, library, specifier]) => ({
		id,
		library,
		mode: 'Forced full namespace',
		group: 'Full-library reference',
		code: `
import * as library from '${specifier}'
globalThis.__treeShakeBenchmark = library
export { library }
`,
	})),
]

async function bundleScenario(scenario, outputDirectory) {
	const warnings = []
	const bundle = await rollup({
		input: 'virtual:entry',
		plugins: [resolver(scenario.code)],
		treeshake: {
			annotations: true,
			moduleSideEffects: false,
			propertyReadSideEffects: false,
			tryCatchDeoptimization: false,
		},
		onwarn(warning) {
			if (warning.code !== 'CIRCULAR_DEPENDENCY')
				warnings.push(warning.message)
		},
	})
	const generated = await bundle.generate({
		format: 'esm',
		compact: true,
		minifyInternalExports: true,
	})
	await bundle.close()
	const chunk = generated.output.find(output => output.type === 'chunk')
	if (!chunk)
		throw new Error(`No JavaScript chunk generated for ${scenario.id}`)

	const minified = await minify(chunk.code, {
		module: true,
		compress: { passes: 2, pure_getters: true },
		mangle: true,
		format: { comments: false },
	})
	if (!minified.code)
		throw new Error(`Terser produced no code for ${scenario.id}`)

	const bundlePath = join(outputDirectory, 'bundles', `${scenario.id}.mjs`)
	await writeFile(bundlePath, `${minified.code}\n`)
	if (scenario.group !== 'Full-library reference') {
		const module = await import(`${pathToFileURL(bundlePath).href}?run=${Date.now()}`)
		if (!('result' in module))
			throw new Error(`Generated bundle for ${scenario.id} did not export result`)
		if (module.result?.success === false || module.result?.issues)
			throw new Error(`Generated bundle for ${scenario.id} failed its success fixture`)
	}

	return {
		id: scenario.id,
		library: scenario.library,
		mode: scenario.mode,
		group: scenario.group,
		...compressedSizes(minified.code),
		warnings,
		retainedMarkers: scenario.library === 'Valchecker'
			? unrelatedValcheckerMarkers.filter(marker => minified.code.includes(marker))
			: [],
		bundlePath: relative(repoRoot, bundlePath),
	}
}

function getResult(results, id) {
	const result = results.find(item => item.id === id)
	if (!result)
		throw new Error(`Missing scenario result: ${id}`)
	return result
}

function analyze(results) {
	const selectiveString = getResult(results, 'valchecker-selective-string')
	const defaultString = getResult(results, 'valchecker-default-string')
	const selectiveObject = getResult(results, 'valchecker-selective-object')
	const defaultObject = getResult(results, 'valchecker-default-object')
	const full = getResult(results, 'valchecker-full')
	const zod4String = getResult(results, 'zod4-string')
	const zod4Object = getResult(results, 'zod4-object')
	const valibotString = getResult(results, 'valibot-string')
	const valibotObject = getResult(results, 'valibot-object')

	const metrics = {
		stringReduction: 1 - selectiveString.brotliBytes / defaultString.brotliBytes,
		objectReduction: 1 - selectiveObject.brotliBytes / defaultObject.brotliBytes,
		selectiveRetained: selectiveString.brotliBytes / full.brotliBytes,
		stringVsZod4Reduction: 1 - selectiveString.brotliBytes / zod4String.brotliBytes,
		objectVsZod4Reduction: 1 - selectiveObject.brotliBytes / zod4Object.brotliBytes,
		stringPremiumOverValibot: selectiveString.brotliBytes / valibotString.brotliBytes - 1,
		objectPremiumOverValibot: selectiveObject.brotliBytes / valibotObject.brotliBytes - 1,
	}
	const unrelatedMarkersEliminated = selectiveString.retainedMarkers.length === 0
	const checks = [
		{
			name: 'Selective minimal chain is materially smaller than default v',
			passed: metrics.stringReduction >= 0.2,
			value: formatPercent(metrics.stringReduction),
		},
		{
			name: 'Selective object schema is materially smaller than default v',
			passed: metrics.objectReduction >= 0.2,
			value: formatPercent(metrics.objectReduction),
		},
		{
			name: 'Selective minimal chain retains at most 75% of forced full library',
			passed: metrics.selectiveRetained <= 0.75,
			value: formatPercent(metrics.selectiveRetained),
		},
		{
			name: 'Unselected Valchecker step markers are absent from the minimal selective bundle',
			passed: unrelatedMarkersEliminated,
			value: unrelatedMarkersEliminated
				? 'none retained'
				: selectiveString.retainedMarkers.join(', '),
		},
	]

	return {
		status: checks.every(check => check.passed) ? 'healthy' : 'needs-attention',
		checks,
		findings: [
			`Selective Valchecker is ${formatPercent(metrics.stringVsZod4Reduction)} smaller than Zod 4 classic for the string pipeline.`,
			`Selective Valchecker is ${formatPercent(metrics.objectVsZod4Reduction)} smaller than Zod 4 classic for the object schema.`,
			`Selective Valchecker is ${formatPercent(metrics.stringPremiumOverValibot)} larger than Valibot for the string pipeline.`,
			`Selective Valchecker is ${formatPercent(metrics.objectPremiumOverValibot)} larger than Valibot for the object schema.`,
		],
		metrics,
	}
}

function markdownTable(results) {
	const rows = results
		.map(result => `| ${result.library} | ${result.mode} | ${formatBytes(result.rawBytes)} | ${formatBytes(result.gzipBytes)} | ${formatBytes(result.brotliBytes)} |`)
		.join('\n')
	return `| Library | API mode | Minified | Gzip | Brotli |\n| --- | --- | ---: | ---: | ---: |\n${rows}`
}

function generateMarkdown(report, concise = false) {
	const groups = ['Minimal string pipeline', 'Object schema', 'Full-library reference']
	const sections = groups.map((group) => {
		const rows = report.results.filter(result => result.group === group)
		return `## ${group}\n\n${markdownTable(rows)}`
	}).join('\n\n')
	const checks = report.analysis.checks
		.map(check => `- ${check.passed ? 'PASS' : 'WARN'} — ${check.name}: **${check.value}**`)
		.join('\n')
	const findings = report.analysis.findings.map(finding => `- ${finding}`).join('\n')
	const headline = report.analysis.status === 'healthy'
		? 'Selective Valchecker builds show a material tree-shaking benefit.'
		: 'The current selective-build signal is weaker than the report thresholds and needs investigation.'
	const context = `Generated with Rollup ${report.environment.rollup}, Terser ${report.environment.terser}, Node.js ${report.environment.node}. Sizes include schema construction and one successful validation call; Brotli is the primary comparison metric.`
	if (concise) {
		return `# Tree-shaking summary\n\n**${headline}**\n\n${checks}\n\n## Key comparisons\n\n${findings}\n\n${markdownTable(report.results.filter(result => result.group === 'Minimal string pipeline'))}\n\n${context}\n`
	}
	return `# Tree-shaking report\n\n**${headline}**\n\n${checks}\n\n## Key comparisons\n\n${findings}\n\n${sections}\n\n## Methodology\n\n- The same Rollup and Terser configuration bundles every scenario.\n- Package modules are treated as side-effect-free, matching their published package metadata.\n- Each realistic scenario constructs an equivalent schema and performs one successful validation so execution code remains in the bundle.\n- Valchecker is measured in both default \`v\` mode and selective \`createValchecker({ steps })\` mode. The default instance intentionally registers every built-in step and is not expected to shrink to only the methods used in a chain.\n- The selective minimal bundle is scanned for unrelated built-in method markers to prove that size reduction corresponds to actual step elimination.\n- Raw, gzip, and Brotli sizes are reported; Brotli is used for automated health checks.\n\n${context}\n`
}

function generateHtml(report) {
	const groupHtml = ['Minimal string pipeline', 'Object schema', 'Full-library reference']
		.map((group) => {
			const rows = report.results
				.filter(result => result.group === group)
				.map(result => `<tr><td>${escapeHtml(result.library)}</td><td>${escapeHtml(result.mode)}</td><td>${formatBytes(result.rawBytes)}</td><td>${formatBytes(result.gzipBytes)}</td><td>${formatBytes(result.brotliBytes)}</td></tr>`)
				.join('')
			return `<h2>${escapeHtml(group)}</h2><table><thead><tr><th>Library</th><th>API mode</th><th>Minified</th><th>Gzip</th><th>Brotli</th></tr></thead><tbody>${rows}</tbody></table>`
		}).join('')
	const checks = report.analysis.checks
		.map(check => `<li><strong>${check.passed ? 'PASS' : 'WARN'}</strong> — ${escapeHtml(check.name)}: ${escapeHtml(check.value)}</li>`)
		.join('')
	const findings = report.analysis.findings.map(finding => `<li>${escapeHtml(finding)}</li>`).join('')
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Valchecker tree-shaking report</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:1100px;margin:40px auto;padding:0 20px;color:#17202a}table{border-collapse:collapse;width:100%;margin:12px 0 32px}th,td{border:1px solid #d5d8dc;padding:8px 10px;text-align:left}th{background:#f4f6f7}td:nth-child(n+3),th:nth-child(n+3){text-align:right}code{background:#f4f6f7;padding:2px 4px;border-radius:4px}</style></head><body><h1>Tree-shaking report</h1><p>Status: <strong>${escapeHtml(report.analysis.status)}</strong></p><ul>${checks}</ul><h2>Key comparisons</h2><ul>${findings}</ul>${groupHtml}<h2>Methodology</h2><p>All scenarios use the same Rollup and Terser configuration. Realistic scenarios construct a schema and retain one successful validation call. Valchecker is measured with both the default all-steps <code>v</code> instance and a selective <code>createValchecker({ steps })</code> instance.</p></body></html>`
}

async function main() {
	const options = parseArguments(process.argv.slice(2))
	await rm(options.output, { recursive: true, force: true })
	await mkdir(join(options.output, 'bundles'), { recursive: true })

	const results = []
	for (const scenario of scenarios)
		results.push(await bundleScenario(scenario, options.output))

	const valcheckerPackage = JSON.parse(await readFile(resolve(repoRoot, 'packages/valchecker/package.json'), 'utf8'))
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
				valchecker: valcheckerPackage.version,
				zod3: packageVersion('zod3'),
				zod4: packageVersion('zod4'),
				valibot: packageVersion('valibot'),
			},
		},
		results,
		analysis: analyze(results),
	}

	await Promise.all([
		writeFile(join(options.output, 'raw.json'), `${JSON.stringify(report, null, 2)}\n`),
		writeFile(join(options.output, 'summary.md'), generateMarkdown(report, true)),
		writeFile(join(options.output, 'report.md'), generateMarkdown(report)),
		writeFile(join(options.output, 'report.html'), generateHtml(report)),
	])

	console.log(generateMarkdown(report, true))
	if (report.analysis.status !== 'healthy')
		process.exitCode = 1
}

main().catch((error) => {
	console.error(error)
	process.exitCode = 1
})
