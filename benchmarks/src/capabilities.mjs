/**
 * Every adapter's declared capabilities, in one module that imports nothing.
 *
 * They live here rather than inside each adapter because two readers need them and
 * only one of the two can load a library. The adapters are the first reader and take
 * their `capabilities` from here, so there is one statement of what a library supports
 * instead of a declaration and a copy. `scripts/check-benchmark-coverage.ts` is the
 * second: deciding whether a step has a cross-library comparison at all is a question
 * about which adapters can participate in a scenario, and that gate must answer it
 * without importing zod or valibot, because `benchmarks/` is installed separately and
 * its libraries may be absent.
 *
 * A feature name exists only for a schema capability at least one adapter genuinely
 * lacks, so every entry below is a claim about a pinned build rather than a
 * convenience. Three things keep the claims honest: `zod-factory.mjs` detects each
 * capability from the live module and refuses to load when detection disagrees with
 * the list here; a build key missing from an adapter that claims the feature fails the
 * run with an actionable message; and `pnpm --dir benchmarks verify` executes every
 * full-tier scenario on every adapter. `benchmarks/README.md` carries the long-form
 * reason for each gate.
 */

/** Every adapter key, in the order the runner defaults to. */
export const adapterKeys = ['valchecker', 'zod3', 'zod4', 'zod4-jitless', 'valibot']

/** The pinned competitors: every adapter except the one under test. */
export const competitorKeys = adapterKeys.filter(key => key !== 'valchecker')

// The two Zod 4 adapters are one pin measured twice, with and without JIT, so they
// support exactly the same schema kinds; only `generatedCode` separates them, and that
// is read from the live `z.config()` rather than declared.
const zod4 = ['zod4', 'zod4-jitless']

/**
 * Which adapters support each gated feature. Valchecker appears in every entry: a
 * feature name is created only where a competitor lacks something Valchecker has, so
 * an entry without it would be a feature nothing needs.
 */
export const featureSupport = {
	// Zod 3 has no file schema.
	'file': ['valchecker', ...zod4, 'valibot'],
	// Zod 3 and Valibot have no template-literal schema.
	'template literal': ['valchecker', ...zod4],
	// Zod 4 ships `z.ipv4()` and `z.ipv6()` separately and nothing accepting either,
	// which is what `isIp()` does by default.
	'combined IPv4/IPv6': ['valchecker', 'zod3', 'valibot'],
	// Valibot has neither action.
	'base64url': ['valchecker', 'zod3', ...zod4],
	'JWT': ['valchecker', 'zod3', ...zod4],
	// Zod 3 has neither string method.
	'hex': ['valchecker', ...zod4, 'valibot'],
	'MAC address': ['valchecker', ...zod4, 'valibot'],
	// `url()` is a whole-URL check in Valibot, not a bare hostname one, and Zod 3 has
	// no hostname format.
	'hostname': ['valchecker', ...zod4],
	// `z.stringbool()`. Zod 3 has none, and `z.coerce.boolean()` is not one — it is
	// `Boolean()` truthiness and maps `'false'` to `true`. Valibot has none either, and
	// unlike the number conversions there is no native function to delegate to, so a
	// mapping table written in an adapter would be a stand-in for a built-in.
	'boolean string parsing': ['valchecker', ...zod4],
	// `z.coerce.bigint()` reports an issue for an unparseable string. Valibot's only
	// spelling, `v.transform(BigInt)`, throws a `SyntaxError` out of `safeParse`.
	'bigint coercion': ['valchecker', 'zod3', ...zod4],
	// Neither Zod pin has `trimStart`/`trimEnd`.
	'one-sided trim': ['valchecker', 'valibot'],
	// Zod 3 has no `normalize()`.
	'Unicode normalization': ['valchecker', ...zod4, 'valibot'],
	// `z.unknown().nonoptional()` and `v.nonOptional()`. Zod 3 has no `nonoptional`.
	'undefined rejection': ['valchecker', ...zod4, 'valibot'],
	// Neither Zod pin has a `nonnullable` or a non-nullish schema, as a method or as a
	// top-level function.
	'null rejection': ['valchecker', 'valibot'],
	'nullish rejection': ['valchecker', 'valibot'],
	// Neither Zod pin has a blob schema. Deliberately separate from `file`: Zod 4 ships
	// `z.file()` and declares `file`, so a scenario gated that way would demand a build
	// key Zod 4 cannot provide.
	'Blob': ['valchecker', 'valibot'],
	// `parseJson()`/`stringifyJson()` report a failed conversion as an issue, which is
	// what `toJSONValue()`/`toJSONString()` do. Zod's only spelling is a `transform`
	// callback, and a throw inside one escapes `safeParse`.
	'JSON conversion failure reporting': ['valchecker', 'valibot'],
	// Valchecker only, which is why `json` is allowlisted in the coverage gate rather
	// than counted as compared. Zod 3 and Valibot have nothing comparable, and Zod 4's
	// `z.json()` is a recursive JSON-*value* schema rather than a check that a string
	// parses.
	'JSON string validation': ['valchecker'],
}

/**
 * Which explicit diagnostic policies each adapter can express. Zod exposes no
 * whole-parse abort, so it never participates in a `first`-policy scenario; this is
 * declared here for the same reason the features are — the coverage gate has to know
 * whether a scenario has any competitor at all, and `first` is the other way a
 * scenario can exclude one.
 */
export const issuePolicySupport = {
	'valchecker': ['first', 'all'],
	'zod3': ['all'],
	'zod4': ['all'],
	'zod4-jitless': ['all'],
	'valibot': ['first', 'all'],
}

function assertKnownAdapter(adapter) {
	if (!adapterKeys.includes(adapter))
		throw new Error(`Unknown benchmark adapter: ${adapter}. Add it to \`adapterKeys\` in capabilities.mjs.`)
}

/** The features one adapter declares, in the order they are listed above. */
export function featuresFor(adapter) {
	assertKnownAdapter(adapter)
	return Object.entries(featureSupport)
		.filter(([, adapters]) => adapters.includes(adapter))
		.map(([feature]) => feature)
}

export function issuePoliciesFor(adapter) {
	assertKnownAdapter(adapter)
	return issuePolicySupport[adapter]
}

/**
 * Fails when an adapter's live capability detection disagrees with the list above.
 * Only the Zod adapters can call this, because they are the only ones that detect
 * rather than assert — which is exactly where a future pin bump would silently make
 * this file wrong.
 */
export function assertDetectedFeatures(adapter, detected) {
	const declared = featuresFor(adapter)
	const missing = declared.filter(feature => !detected.includes(feature))
	const unexpected = detected.filter(feature => !declared.includes(feature))
	if (missing.length === 0 && unexpected.length === 0)
		return
	throw new Error(
		`${adapter}: the installed build disagrees with the declared capabilities in src/capabilities.mjs. `
		+ `${missing.length === 0 ? '' : `Declared but absent: ${missing.join(', ')}. `}`
		+ `${unexpected.length === 0 ? '' : `Present but undeclared: ${unexpected.join(', ')}. `}`
		+ 'Update the declaration — a scenario gated on a feature this adapter really has is a comparison the suite is not making.',
	)
}
