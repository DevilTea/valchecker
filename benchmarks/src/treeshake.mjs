import { Buffer } from 'node:buffer'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { cpus, platform, release } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { brotliCompressSync, gzipSync, constants as zlibConstants } from 'node:zlib'
import { rollup, VERSION as rollupVersion } from 'rollup'
import { minify } from 'terser'
import { compareBundleImpact } from './bundle-impact.mjs'
import { consumerResolver } from './consumer-resolver.mjs'
import { createPackedValcheckerConsumer } from './packed-valchecker.mjs'

const require = createRequire(import.meta.url)
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const unrelatedMarkers = ['strictObject', 'intersection', 'toUppercase', 'toJSONValue', 'toSorted', 'record:', 'tuple:', 'templateLiteral:', 'date:expected_date', 'toDate:', 'isEmail:']

function argumentValue(argv, name) {
	const index = argv.indexOf(name)
	return index >= 0 ? argv[index + 1] ?? null : null
}

function args(argv) {
	const output = argumentValue(argv, '--output')
	const baseRoot = argumentValue(argv, '--base-root')
	const candidateRoot = argumentValue(argv, '--candidate-root')
	return {
		output: output == null ? resolve(repoRoot, 'artifacts/tree-shaking') : resolve(process.cwd(), output),
		baseRoot: baseRoot == null ? null : resolve(process.cwd(), baseRoot),
		candidateRoot: candidateRoot == null ? repoRoot : resolve(process.cwd(), candidateRoot),
		baseCommit: argumentValue(argv, '--base-commit'),
		candidateCommit: argumentValue(argv, '--candidate-commit') ?? process.env.REPORT_COMMIT ?? process.env.GITHUB_SHA ?? null,
		failOnRegression: argv.includes('--fail-on-regression'),
	}
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

function size(code) {
	return {
		rawBytes: Buffer.byteLength(code),
		gzipBytes: gzipSync(code, { level: 9 }).byteLength,
		brotliBytes: brotliCompressSync(code, {
			params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11 },
		}).byteLength,
	}
}
const bytes = value => value < 1024 ? `${value} B` : `${(value / 1024).toFixed(2)} KiB`
const percent = value => `${(value * 100).toFixed(1)}%`
function html(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll('\'', '&#039;')
}

function scenario(id, library, mode, group, code, { forbiddenMarkers = [], requiredMarkers = [] } = {}) {
	return {
		id,
		library,
		mode,
		group,
		code,
		forbiddenMarkers,
		requiredMarkers,
	}
}
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
	scenario('valchecker-union-schema-only', 'Valchecker', 'Union without shorthand providers', 'Union shorthand isolation', `
import { createValchecker, string, union } from 'valchecker'
const v = createValchecker({ steps: [string, union] })
export const schema = v.union([v.string()])
export const result = schema.execute('value')
`, {
		forbiddenMarkers: ['literal:expected_literal', 'null:expected_null', 'undefined:expected_undefined'],
	}),
	scenario('valchecker-union-shorthand', 'Valchecker', 'Union with shorthand providers', 'Union shorthand isolation', `
import { createValchecker, literal, null_, number, undefined_, union } from 'valchecker'
const v = createValchecker({ steps: [literal, null_, number, undefined_, union] })
export const schema = v.union(['auto', null, undefined, v.number()])
export const result = schema.execute('auto')
`, {
		requiredMarkers: ['literal:expected_literal', 'null:expected_null', 'undefined:expected_undefined'],
	}),
	scenario('valchecker-variant-free', 'Valchecker', 'Selective object schema without variant', 'Variant isolation', `
import { createValchecker, object, string } from 'valchecker'
const v = createValchecker({ steps: [object, string] })
export const schema = v.object({ type: v.string() })
export const result = schema.execute({ type: 'value' })
`, {
		forbiddenMarkers: ['variant:expected_object', 'variant:invalid_discriminator'],
	}),
	scenario('valchecker-variant-selective', 'Valchecker', 'Selective direct variant schema', 'Variant isolation', `
import { createValchecker, literal, number, object, variant } from 'valchecker'
const v = createValchecker({ steps: [literal, number, object, variant] })
export const schema = v.variant({ discriminator: 'type', variants: {
	circle: v.object({ type: v.literal('circle'), radius: v.number() }),
	square: v.object({ type: v.literal('square'), size: v.number() }),
} })
export const result = schema.execute({ type: 'square', size: 2 })
`, {
		requiredMarkers: ['variant:expected_object', 'variant:invalid_discriminator'],
	}),
	scenario('valchecker-collection-free', 'Valchecker', 'Selective chain without collections', 'Map and Set isolation', `
import { createValchecker, string } from 'valchecker'
const v = createValchecker({ steps: [string] })
export const schema = v.string()
export const result = schema.execute('value')
`, {
		forbiddenMarkers: ['map:expected_map', 'map:duplicate_transformed_key', 'set:expected_set', 'set:duplicate_transformed_item'],
	}),
	scenario('valchecker-map-set-selective', 'Valchecker', 'Selective Map and Set schemas', 'Map and Set isolation', `
import { createValchecker, map, number, set, string } from 'valchecker'
const v = createValchecker({ steps: [map, number, set, string] })
export const mapSchema = v.map({ key: v.string(), value: v.number() })
export const setSchema = v.set(v.string())
export const result = {
	map: mapSchema.execute(new Map([['a', 1]])),
	set: setSchema.execute(new Set(['a'])),
}
`, {
		requiredMarkers: ['map:expected_map', 'map:duplicate_transformed_key', 'set:expected_set', 'set:duplicate_transformed_item'],
	}),
	scenario('valchecker-record-tuple-selective', 'Valchecker', 'Selective record and tuple schemas', 'Record and tuple isolation', `
import { array, createValchecker, number, record, string, tuple } from 'valchecker'
const v = createValchecker({ steps: [array, number, record, string, tuple] })
export const recordSchema = v.record({ key: v.string(), value: v.number() })
export const tupleSchema = v.tuple([v.string(), '...', v.array(v.number())])
export const result = {
	record: recordSchema.execute({ a: 1 }),
	tuple: tupleSchema.execute(['a', 1, 2]),
}
`, {
		requiredMarkers: ['record:expected_object', 'record:duplicate_transformed_key', 'tuple:expected_array', 'tuple:unexpected_length'],
	}),
	scenario('valchecker-collection-capabilities-free', 'Valchecker', 'Collections without size and membership plugins', 'Collection capability isolation', `
import { createValchecker, map, number, set, string } from 'valchecker'
const v = createValchecker({ steps: [map, number, set, string] })
export const result = {
	map: v.map({ key: v.string(), value: v.number() }).execute(new Map([['a', 1]])),
	set: v.set(v.string()).execute(new Set(['a'])),
}
`, {
		forbiddenMarkers: ['isSizeAtLeast:expected_size_at_least', 'isSizeAtMost:expected_size_at_most', 'isSizeExactly:expected_size_exactly', 'isIncludingKey:expected_including_key', 'isIncludingValue:expected_including_value'],
	}),
	scenario('valchecker-collection-capabilities', 'Valchecker', 'Selective collection size and membership', 'Collection capability isolation', `
import { createValchecker, isIncluding, isIncludingKey, isIncludingValue, isSizeAtLeast, isSizeAtMost, isSizeExactly, map, number, set, string, toSize } from 'valchecker'
const v = createValchecker({ steps: [isIncluding, isIncludingKey, isIncludingValue, isSizeAtLeast, isSizeAtMost, isSizeExactly, map, number, set, string, toSize] })
export const result = {
	map: v.map({ key: v.string(), value: v.number() }).isSizeAtLeast(1).isIncludingKey('a').isIncludingValue(1).toSize().execute(new Map([['a', 1]])),
	set: v.set(v.string()).isSizeAtMost(2).isSizeExactly(1).isIncluding('a').execute(new Set(['a'])),
}
`, {
		requiredMarkers: ['isSizeAtLeast:expected_size_at_least', 'isSizeAtMost:expected_size_at_most', 'isSizeExactly:expected_size_exactly', 'isIncludingKey:expected_including_key', 'isIncludingValue:expected_including_value'],
	}),
	scenario('valchecker-collection-representations-free', 'Valchecker', 'Collections without representation transforms', 'Collection representation isolation', `
import { createValchecker, map, number, set, string } from 'valchecker'
const v = createValchecker({ steps: [map, number, set, string] })
export const result = {
	map: v.map({ key: v.string(), value: v.number() }).execute(new Map([['a', 1]])),
	set: v.set(v.string()).execute(new Set(['a'])),
}
`, {
		forbiddenMarkers: ['toArray', 'toKeys', 'toValues', 'toEntries'],
	}),
	scenario('valchecker-collection-representations', 'Valchecker', 'Selective collection representations', 'Collection representation isolation', `
import { createValchecker, map, number, set, string, toArray, toEntries, toKeys, toValues } from 'valchecker'
const v = createValchecker({ steps: [map, number, set, string, toArray, toEntries, toKeys, toValues] })
export const result = {
	items: v.set(v.string()).toArray().execute(new Set(['a'])),
	keys: v.map({ key: v.string(), value: v.number() }).toKeys().execute(new Map([['a', 1]])),
	values: v.map({ key: v.string(), value: v.number() }).toValues().execute(new Map([['a', 1]])),
	entries: v.map({ key: v.string(), value: v.number() }).toEntries().execute(new Map([['a', 1]])),
}
`, {
		requiredMarkers: ['toArray', 'toKeys', 'toValues', 'toEntries'],
	}),
	scenario('valchecker-collection-callbacks-free', 'Valchecker', 'Collections without callback transforms', 'Collection callback isolation', `
import { createValchecker, map, number, set, string } from 'valchecker'
const v = createValchecker({ steps: [map, number, set, string] })
export const result = {
	map: v.map({ key: v.string(), value: v.number() }).execute(new Map([['a', 1]])),
	set: v.set(v.string()).execute(new Set(['a'])),
}
`, {
		forbiddenMarkers: ['toMapped:callback_failed', 'toMapped:duplicate_mapped_item', 'toFiltered:callback_failed', 'toMappedKeys:callback_failed', 'toMappedKeys:duplicate_mapped_key', 'toMappedValues:callback_failed'],
	}),
	scenario('valchecker-collection-callbacks', 'Valchecker', 'Selective collection callback transforms', 'Collection callback isolation', `
import { createValchecker, map, number, set, string, toFiltered, toMapped, toMappedKeys, toMappedValues } from 'valchecker'
const v = createValchecker({ steps: [map, number, set, string, toFiltered, toMapped, toMappedKeys, toMappedValues] })
export const result = {
	mappedItems: v.set(v.string()).toMapped(value => value.length).execute(new Set(['a'])),
	filteredItems: v.set(v.string()).toFiltered(value => value.length > 1).execute(new Set(['a', 'bb'])),
	mappedKeys: v.map({ key: v.string(), value: v.number() }).toMappedKeys(key => key.toUpperCase()).execute(new Map([['a', 1]])),
	mappedValues: v.map({ key: v.string(), value: v.number() }).toMappedValues(value => value * 2).execute(new Map([['a', 1]])),
}
`, {
		requiredMarkers: ['toMapped:callback_failed', 'toMapped:duplicate_mapped_item', 'toFiltered:callback_failed', 'toMappedKeys:callback_failed', 'toMappedKeys:duplicate_mapped_key', 'toMappedValues:callback_failed'],
	}),
	scenario('valchecker-string-formats-free', 'Valchecker', 'Selective string chain without format validators', 'String format isolation', `
import { createValchecker, string } from 'valchecker'
const v = createValchecker({ steps: [string] })
export const result = v.string().execute('value')
`, {
		forbiddenMarkers: ['isEmail:expected_email', 'isUuid:expected_uuid', 'isIsoDateTime:expected_iso_date_time'],
	}),
	scenario('valchecker-string-formats-selective', 'Valchecker', 'Selective string format validators', 'String format isolation', `
import { createValchecker, isEmail, isIsoDateTime, isUuid, string } from 'valchecker'
const v = createValchecker({ steps: [isEmail, isIsoDateTime, isUuid, string] })
export const result = {
	email: v.string().isEmail().execute('ada@example.com'),
	uuid: v.string().isUuid().execute('3f333df6-90a4-4fda-8dd3-9485d27cee36'),
	isoDateTime: v.string().isIsoDateTime().execute('2024-03-05T08:09:10.123Z'),
}
`, {
		requiredMarkers: ['isEmail:expected_email', 'isUuid:expected_uuid', 'isIsoDateTime:expected_iso_date_time'],
	}),
	scenario('valchecker-date-free', 'Valchecker', 'Selective string chain without date or template-literal plugins', 'Date and template-literal isolation', `
import { createValchecker, string } from 'valchecker'
const v = createValchecker({ steps: [string] })
export const result = v.string().execute('value')
`, {
		forbiddenMarkers: ['date:expected_date', 'date:invalid_date', 'toDate:conversion_failed', 'templateLiteral:expected_template_literal'],
	}),
	scenario('valchecker-date-selective', 'Valchecker', 'Selective date, conversion, and template-literal schemas', 'Date and template-literal isolation', `
import { createValchecker, date, literal, number, string, templateLiteral, toDate, union } from 'valchecker'
const v = createValchecker({ steps: [date, literal, number, string, templateLiteral, toDate, union] })
export const result = {
	date: v.date().execute(new Date()),
	converted: v.string().toDate().execute('2024-03-05T08:09:10.123Z'),
	template: v.templateLiteral([v.number(), v.union(['px', 'em'])]).execute('12px'),
}
`, {
		requiredMarkers: ['date:expected_date', 'date:invalid_date', 'toDate:conversion_failed', 'templateLiteral:expected_template_literal'],
	}),
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

// A scenario may export one execution result or a bag of them. Walking the bag
// matters because a top-level-only check passes vacuously for a nested export,
// which is how a broken selective bundle could report `healthy`. Every member of
// a bag must carry a result, so an entry that vanishes is a failure rather than
// a silently smaller check.
function assertBundleSucceeded(id, value, path = 'result') {
	const visit = (node, nodePath) => {
		if (node == null || typeof node !== 'object')
			return 0
		if (node.issues || node.success === false)
			throw new Error(`Generated bundle for ${id} failed its success fixture at ${nodePath}`)
		if ('value' in node || 'data' in node || 'output' in node || 'success' in node)
			return 1
		const entries = Array.isArray(node)
			? node.map((entry, index) => [index, entry])
			: Object.entries(node)
		let verified = 0
		for (const [key, nested] of entries) {
			const nestedPath = `${nodePath}.${key}`
			if (visit(nested, nestedPath) === 0)
				throw new Error(`Generated bundle for ${id} exports no execution result at ${nestedPath}`)
			verified++
		}
		return verified
	}
	if (visit(value, path) === 0)
		throw new Error(`Generated bundle for ${id} exports no recognizable execution result`)
}

async function bundleScenario(item, output, consumer, side = 'candidate') {
	const warnings = []
	const bundle = await rollup({
		input: 'virtual:entry',
		plugins: [consumerResolver(item.code, consumer)],
		// `tryCatchDeoptimization` is left at Rollup's default `true` on purpose.
		// Setting it to `false` hides a class of retention that a downstream Vite or
		// Rollup consumer really pays: with the default, Rollup abandons analysis of
		// a `try` block, so a module-scope `try`/`catch` survives even in a bundle
		// that imports nothing near it. `isEmoji`'s registered-set capability probe
		// was exactly that — 132 B and one `new RegExp(…, 'gv')` at import for an
		// entry importing only `string` and `isEmail` — and this gate could not see
		// it. A gate that measures a friendlier configuration than its consumers use
		// is not a gate.
		// Primary consumer profile: package manifests decide module side effects, and Rollup's
		// ordinary property-read semantics remain enabled. Aggressive theoretical assumptions
		// are deliberately not part of the consumer gate.
		treeshake: { annotations: true },
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
		compress: { passes: 2 },
		mangle: true,
		format: { comments: false },
	})
	if (!result.code)
		throw new Error(`Terser produced no code for ${item.id}`)
	const bundlePath = join(output, 'bundles', side, `${item.id}.mjs`)
	await mkdir(dirname(bundlePath), { recursive: true })
	await writeFile(bundlePath, `${result.code}\n`)
	if (item.group !== 'Full-library reference') {
		const module = await import(`${pathToFileURL(bundlePath).href}?run=${Date.now()}`)
		if (!('result' in module))
			throw new Error(`Generated bundle for ${item.id} exports no result`)
		assertBundleSucceeded(item.id, module.result)
	}
	return {
		...item,
		code: undefined,
		...size(result.code),
		warnings,
		retainedMarkers: item.library === 'Valchecker'
			? unrelatedMarkers.filter(marker => result.code.includes(marker))
			: [],
		retainedForbiddenMarkers: item.forbiddenMarkers.filter(marker => result.code.includes(marker)),
		retainedRequiredMarkers: item.requiredMarkers.filter(marker => result.code.includes(marker)),
		bundlePath: relative(repoRoot, bundlePath),
	}
}

function byId(results, id) {
	const result = results.find(value => value.id === id)
	if (!result)
		throw new Error(`Missing scenario result: ${id}`)
	return result
}
function comparison(subject, reference, label) {
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
	const unionSchemaOnly = byId(results, 'valchecker-union-schema-only')
	const unionShorthand = byId(results, 'valchecker-union-shorthand')
	const variantFree = byId(results, 'valchecker-variant-free')
	const variantSelective = byId(results, 'valchecker-variant-selective')
	const collectionFree = byId(results, 'valchecker-collection-free')
	const mapSetSelective = byId(results, 'valchecker-map-set-selective')
	const collectionCapabilitiesFree = byId(results, 'valchecker-collection-capabilities-free')
	const collectionCapabilities = byId(results, 'valchecker-collection-capabilities')
	const collectionRepresentationsFree = byId(results, 'valchecker-collection-representations-free')
	const collectionRepresentations = byId(results, 'valchecker-collection-representations')
	const collectionCallbacksFree = byId(results, 'valchecker-collection-callbacks-free')
	const collectionCallbacks = byId(results, 'valchecker-collection-callbacks')
	const recordTupleSelective = byId(results, 'valchecker-record-tuple-selective')
	const stringFormatsFree = byId(results, 'valchecker-string-formats-free')
	const stringFormatsSelective = byId(results, 'valchecker-string-formats-selective')
	const dateFree = byId(results, 'valchecker-date-free')
	const dateSelective = byId(results, 'valchecker-date-selective')
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
	const unionProviderMarkersAbsent = unionSchemaOnly.retainedForbiddenMarkers.length === 0
	const unionProviderMarkersPresent = unionShorthand.retainedRequiredMarkers.length === unionShorthand.requiredMarkers.length
	const variantMarkersAbsent = variantFree.retainedForbiddenMarkers.length === 0
	const variantMarkersPresent = variantSelective.retainedRequiredMarkers.length === variantSelective.requiredMarkers.length
	const collectionMarkersAbsent = collectionFree.retainedForbiddenMarkers.length === 0
	const collectionMarkersPresent = mapSetSelective.retainedRequiredMarkers.length === mapSetSelective.requiredMarkers.length
	const collectionCapabilityMarkersAbsent = collectionCapabilitiesFree.retainedForbiddenMarkers.length === 0
	const collectionCapabilityMarkersPresent = collectionCapabilities.retainedRequiredMarkers.length === collectionCapabilities.requiredMarkers.length
	const collectionRepresentationMarkersAbsent = collectionRepresentationsFree.retainedForbiddenMarkers.length === 0
	const collectionRepresentationMarkersPresent = collectionRepresentations.retainedRequiredMarkers.length === collectionRepresentations.requiredMarkers.length
	const collectionCallbackMarkersAbsent = collectionCallbacksFree.retainedForbiddenMarkers.length === 0
	const collectionCallbackMarkersPresent = collectionCallbacks.retainedRequiredMarkers.length === collectionCallbacks.requiredMarkers.length
	const recordTupleMarkersPresent = recordTupleSelective.retainedRequiredMarkers.length === recordTupleSelective.requiredMarkers.length
	const stringFormatMarkersAbsent = stringFormatsFree.retainedForbiddenMarkers.length === 0
	const stringFormatMarkersPresent = stringFormatsSelective.retainedRequiredMarkers.length === stringFormatsSelective.requiredMarkers.length
	const dateMarkersAbsent = dateFree.retainedForbiddenMarkers.length === 0
	const dateMarkersPresent = dateSelective.retainedRequiredMarkers.length === dateSelective.requiredMarkers.length
	const checks = [
		{ name: 'Selective minimal chain is materially smaller than default v', passed: stringReduction >= 0.2, value: percent(stringReduction) },
		{ name: 'Selective object schema is materially smaller than default v', passed: objectReduction >= 0.2, value: percent(objectReduction) },
		{ name: 'Selective minimal chain retains at most 75% of forced full library', passed: selectiveRetained <= 0.75, value: percent(selectiveRetained) },
		{ name: 'Unselected Valchecker step markers are absent from the minimal selective bundle', passed: markersAbsent, value: markersAbsent ? 'none retained' : selectiveString.retainedMarkers.join(', ') },
		{ name: 'Union without shorthand providers excludes provider issue markers', passed: unionProviderMarkersAbsent, value: unionProviderMarkersAbsent ? 'none retained' : unionSchemaOnly.retainedForbiddenMarkers.join(', ') },
		{ name: 'Union shorthand retains every registered provider marker', passed: unionProviderMarkersPresent, value: unionProviderMarkersPresent ? unionShorthand.retainedRequiredMarkers.join(', ') : `${unionShorthand.retainedRequiredMarkers.length}/${unionShorthand.requiredMarkers.length} retained` },
		{ name: 'Selective builds without variant exclude variant issue markers', passed: variantMarkersAbsent, value: variantMarkersAbsent ? 'none retained' : variantFree.retainedForbiddenMarkers.join(', ') },
		{ name: 'Selective variant retains every owned issue marker', passed: variantMarkersPresent, value: variantMarkersPresent ? variantSelective.retainedRequiredMarkers.join(', ') : `${variantSelective.retainedRequiredMarkers.length}/${variantSelective.requiredMarkers.length} retained` },
		{ name: 'Selective builds without Map and Set exclude collection issue markers', passed: collectionMarkersAbsent, value: collectionMarkersAbsent ? 'none retained' : collectionFree.retainedForbiddenMarkers.join(', ') },
		{ name: 'Selective Map and Set schemas retain every collection issue marker', passed: collectionMarkersPresent, value: collectionMarkersPresent ? mapSetSelective.retainedRequiredMarkers.join(', ') : `${mapSetSelective.retainedRequiredMarkers.length}/${mapSetSelective.requiredMarkers.length} retained` },
		{ name: 'Collections without size/membership plugins exclude their issue markers', passed: collectionCapabilityMarkersAbsent, value: collectionCapabilityMarkersAbsent ? 'none retained' : collectionCapabilitiesFree.retainedForbiddenMarkers.join(', ') },
		{ name: 'Selective collection size/membership retains every issue marker', passed: collectionCapabilityMarkersPresent, value: collectionCapabilityMarkersPresent ? collectionCapabilities.retainedRequiredMarkers.join(', ') : `${collectionCapabilities.retainedRequiredMarkers.length}/${collectionCapabilities.requiredMarkers.length} retained` },
		{ name: 'Collections without representation transforms exclude their method markers', passed: collectionRepresentationMarkersAbsent, value: collectionRepresentationMarkersAbsent ? 'none retained' : collectionRepresentationsFree.retainedForbiddenMarkers.join(', ') },
		{ name: 'Selective collection representations retain every method marker', passed: collectionRepresentationMarkersPresent, value: collectionRepresentationMarkersPresent ? collectionRepresentations.retainedRequiredMarkers.join(', ') : `${collectionRepresentations.retainedRequiredMarkers.length}/${collectionRepresentations.requiredMarkers.length} retained` },
		{ name: 'Collections without callback transforms exclude their issue markers', passed: collectionCallbackMarkersAbsent, value: collectionCallbackMarkersAbsent ? 'none retained' : collectionCallbacksFree.retainedForbiddenMarkers.join(', ') },
		{ name: 'Selective collection callbacks retain every issue marker', passed: collectionCallbackMarkersPresent, value: collectionCallbackMarkersPresent ? collectionCallbacks.retainedRequiredMarkers.join(', ') : `${collectionCallbacks.retainedRequiredMarkers.length}/${collectionCallbacks.requiredMarkers.length} retained` },
		{ name: 'Selective record and tuple schemas retain every owned issue marker', passed: recordTupleMarkersPresent, value: recordTupleMarkersPresent ? recordTupleSelective.retainedRequiredMarkers.join(', ') : `${recordTupleSelective.retainedRequiredMarkers.length}/${recordTupleSelective.requiredMarkers.length} retained` },
		{ name: 'Selective builds without format validators exclude their issue markers', passed: stringFormatMarkersAbsent, value: stringFormatMarkersAbsent ? 'none retained' : stringFormatsFree.retainedForbiddenMarkers.join(', ') },
		{ name: 'Selective format validators retain every owned issue marker', passed: stringFormatMarkersPresent, value: stringFormatMarkersPresent ? stringFormatsSelective.retainedRequiredMarkers.join(', ') : `${stringFormatsSelective.retainedRequiredMarkers.length}/${stringFormatsSelective.requiredMarkers.length} retained` },
		{ name: 'Selective builds without date or template-literal plugins exclude their markers', passed: dateMarkersAbsent, value: dateMarkersAbsent ? 'none retained' : dateFree.retainedForbiddenMarkers.join(', ') },
		{ name: 'Selective date and template-literal schemas retain every owned marker', passed: dateMarkersPresent, value: dateMarkersPresent ? dateSelective.retainedRequiredMarkers.join(', ') : `${dateSelective.retainedRequiredMarkers.length}/${dateSelective.requiredMarkers.length} retained` },
	]
	return {
		status: checks.every(check => check.passed) ? 'healthy' : 'needs-attention',
		checks,
		findings: comparisons.map(value => value.finding),
		metrics: { stringReduction, objectReduction, selectiveRetained, crossLibraryDifferences: comparisons.map(value => value.difference) },
	}
}

function table(results) {
	const rows = results.map(result => `| ${result.library} | ${result.mode} | ${bytes(result.rawBytes)} | ${bytes(result.gzipBytes)} | ${bytes(result.brotliBytes)} |`)
		.join('\n')
	return `| Library | API mode | Minified | Gzip | Brotli |\n| --- | --- | ---: | ---: | ---: |\n${rows}`
}

function signedPercent(value) {
	return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`
}

function impactTable(impact) {
	if (impact == null)
		return 'No base artifact was supplied, so this run has structural tree-shaking evidence only and makes no impact claim.'
	const rows = impact.rows.map(row => `| ${row.id} | ${bytes(row.baseBrotliBytes)} | ${bytes(row.candidateBrotliBytes)} | ${row.deltaBytes >= 0 ? '+' : ''}${row.deltaBytes} B | ${signedPercent(row.delta)} | ${row.classification} |`)
		.join('\n')
	return `Policy threshold: **>${percent(impact.threshold)} Brotli increase is a bundle regression**. Every byte delta is still reported; the threshold is a review/blocking policy, not measurement uncertainty.\n\n| Scenario | Base Brotli | Candidate Brotli | Bytes | Change | Classification |\n| --- | ---: | ---: | ---: | ---: | --- |\n${rows}`
}

function markdown(report, concise = false) {
	const checks = report.analysis.checks.map(check => `- ${check.passed ? 'PASS' : 'WARN'} — ${check.name}: **${check.value}**`)
		.join('\n')
	const findings = report.analysis.findings.map(value => `- ${value}`)
		.join('\n')
	const headline = report.impact == null
		? report.analysis.status === 'healthy'
			? 'Packed consumer tree-shaking guardrails are healthy. No base artifact was supplied, so this run makes no impact verdict.'
			: 'The current packed consumer tree-shaking guardrails need investigation. No base artifact was supplied, so this run makes no impact verdict.'
		: report.status === 'healthy'
			? 'Packed consumer tree-shaking is healthy and no meaningful bundle regression was measured.'
			: report.impact.verdict === 'regression'
				? 'The candidate has a meaningful Brotli regression against the packed base artifact.'
				: 'The current packed consumer tree-shaking guardrails need investigation.'
	const context = `Generated with Rollup ${report.environment.rollup}, Terser ${report.environment.terser}, Node.js ${report.environment.node}. Brotli is the primary impact metric. The primary profile respects packed package sideEffects metadata, Rollup property-read side effects, and ordinary Terser getter semantics.`
	const body = concise
		? table(report.results.filter(result => result.group === 'Minimal string pipeline'))
		: ['Minimal string pipeline', 'Object schema', 'Union shorthand isolation', 'Variant isolation', 'Map and Set isolation', 'Record and tuple isolation', 'Collection capability isolation', 'Collection representation isolation', 'Collection callback isolation', 'String format isolation', 'Date and template-literal isolation', 'Full-library reference']
				.map(group => `## ${group}\n\n${table(report.results.filter(result => result.group === group))}`)
				.join('\n\n')
	return `# Bundle size ${concise ? 'summary' : 'report'}\n\nStatus: **${report.status}**${report.impact == null ? '' : ` · impact: **${report.impact.verdict}**`} · structural tree-shaking: **${report.analysis.status}**\n\n**${headline}**\n\n## Base vs candidate impact\n\n${impactTable(report.impact)}\n\n## Current packed-artifact guardrails\n\n${checks}\n\n### Cross-library context\n\n${findings}\n\n${body}\n\n${context}\n`
}

function htmlReport(report) {
	const rows = report.results.map(result => `<tr><td>${html(result.library)}</td><td>${html(result.mode)}</td><td>${bytes(result.rawBytes)}</td><td>${bytes(result.gzipBytes)}</td><td>${bytes(result.brotliBytes)}</td></tr>`)
		.join('')
	const impactRows = report.impact?.rows.map(row => `<tr><td>${html(row.id)}</td><td>${bytes(row.baseBrotliBytes)}</td><td>${bytes(row.candidateBrotliBytes)}</td><td>${html(signedPercent(row.delta))}</td><td>${html(row.classification)}</td></tr>`)
		.join('') ?? ''
	const impact = report.impact == null
		? '<p>No base artifact supplied; no impact claim.</p>'
		: `<p>Impact: <strong>${html(report.impact.verdict)}</strong>; regression policy: &gt;${html(percent(report.impact.threshold))} Brotli.</p><table><thead><tr><th>Scenario</th><th>Base Brotli</th><th>Candidate Brotli</th><th>Change</th><th>Classification</th></tr></thead><tbody>${impactRows}</tbody></table>`
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Bundle size impact</title></head><body><h1>Bundle size impact</h1><p>Status: <strong>${html(report.status)}</strong> · structural: <strong>${html(report.analysis.status)}</strong></p>${impact}<h2>Candidate packed-artifact sizes</h2><table><thead><tr><th>Library</th><th>API mode</th><th>Minified</th><th>Gzip</th><th>Brotli</th></tr></thead><tbody>${rows}</tbody></table></body></html>`
}

async function main() {
	const options = args(process.argv.slice(2))
	await rm(options.output, { recursive: true, force: true })
	await mkdir(join(options.output, 'bundles'), { recursive: true })

	const candidateConsumer = await createPackedValcheckerConsumer(options.candidateRoot)
	const baseConsumer = options.baseRoot == null ? null : await createPackedValcheckerConsumer(options.baseRoot)
	try {
		const results = []
		for (const item of scenarios)
			results.push(await bundleScenario(item, options.output, candidateConsumer, 'candidate'))

		let baseResults = null
		let impact = null
		if (baseConsumer != null) {
			baseResults = []
			for (const item of scenarios.filter(item => item.library === 'Valchecker'))
				baseResults.push(await bundleScenario(item, options.output, baseConsumer, 'base'))
			impact = compareBundleImpact(baseResults, results.filter(result => result.library === 'Valchecker'))
		}

		const analysis = analyze(results)
		const status = analysis.status !== 'healthy' || impact?.verdict === 'regression' ? 'needs-attention' : 'healthy'
		const report = {
			schemaVersion: 2,
			generatedAt: new Date()
				.toISOString(),
			status,
			commits: { base: options.baseCommit, candidate: options.candidateCommit },
			profile: {
				name: 'packed-consumer',
				packageSideEffects: 'manifest',
				rollup: { annotations: true, propertyReadSideEffects: true },
				terser: { passes: 2, pureGetters: false },
			},
			packedManifests: {
				base: baseConsumer?.manifests ?? null,
				candidate: candidateConsumer.manifests,
			},
			environment: {
				node: process.version,
				platform: `${platform()} ${release()}`,
				cpu: cpus()[0]?.model ?? 'unknown',
				rollup: rollupVersion,
				terser: packageVersion('terser'),
				versions: {
					valchecker: candidateConsumer.manifests.valchecker.version,
					zod3: packageVersion('zod3', 'zod'),
					zod4: packageVersion('zod4', 'zod'),
					valibot: packageVersion('valibot'),
				},
			},
			baseResults,
			results,
			impact,
			analysis,
		}
		await Promise.all([
			writeFile(join(options.output, 'raw.json'), `${JSON.stringify(report, null, 2)}\n`),
			writeFile(join(options.output, 'summary.md'), markdown(report, true)),
			writeFile(join(options.output, 'report.md'), markdown(report)),
			writeFile(join(options.output, 'report.html'), htmlReport(report)),
		])
		process.stdout.write(`${markdown(report, true)}\n`)
		if (analysis.status !== 'healthy' || (options.failOnRegression && impact?.verdict === 'regression'))
			process.exitCode = 1
	}
	finally {
		await Promise.all([candidateConsumer.cleanup(), baseConsumer?.cleanup()])
	}
}

main()
	.catch((error) => {
		console.error(error)
		process.exitCode = 1
	})
