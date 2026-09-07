export const securitySeverityThreshold = 'moderate' as const
export const releaseSensitiveToolRoots = ['@clack/prompts', 'bumpp', 'tsx', 'zx'] as const

export type SecuritySeverity = 'info' | 'low' | 'moderate' | 'high' | 'critical'

export interface SecurityAcknowledgement {
	advisory: string
	dependency: string
	maxSeverity: SecuritySeverity
	allowedRoots: string[]
	exposure: 'development-tooling'
	exposureRationale: string
	remediationBlocker: string
	acknowledgedOn: string
	expiresOn: string
	reviewCondition: string
}

export interface SecurityAcknowledgementFile {
	schemaVersion: 1
	acknowledgements: SecurityAcknowledgement[]
}

export interface NormalizedAdvisory {
	advisory: string
	dependency: string
	severity: SecuritySeverity
	roots: string[]
	paths: string[]
	rows: number
	url: string
}

export interface SecurityPolicyFailure {
	advisory: string
	dependency: string
	reason: 'production-exposure' | 'release-sensitive-tooling' | 'new-advisory' | 'severity-worsened' | 'exposure-worsened' | 'expired-acknowledgement' | 'stale-acknowledgement'
	detail: string
}

export interface SecurityPolicyReport {
	threshold: typeof securitySeverityThreshold
	production: NormalizedAdvisory[]
	acknowledged: Array<NormalizedAdvisory & { acknowledgement: SecurityAcknowledgement }>
	failures: SecurityPolicyFailure[]
	fullAuditRowsAtThreshold: number
	productionAuditRowsAtThreshold: number
	ignoredBelowThreshold: number
}

const severityRank: Record<SecuritySeverity, number> = {
	info: 0,
	low: 1,
	moderate: 2,
	high: 3,
	critical: 4,
}

const severityNames = new Set<SecuritySeverity>(['info', 'low', 'moderate', 'high', 'critical'])
const ghsaPattern = /\/advisories\/(GHSA-[0-9a-z-]+)$/i
const datePattern = /^\d{4}-\d{2}-\d{2}$/

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function requireString(value: unknown, field: string): string {
	if (typeof value !== 'string' || value.trim() === '')
		throw new Error(`${field} must be a non-empty string`)
	return value
}

function requireSeverity(value: unknown, field: string): SecuritySeverity {
	if (typeof value !== 'string' || !severityNames.has(value as SecuritySeverity))
		throw new Error(`${field} must be one of ${[...severityNames].join(', ')}`)
	return value as SecuritySeverity
}

function assertDate(value: unknown, field: string): string {
	const date = requireString(value, field)
	if (!datePattern.test(date))
		throw new Error(`${field} must be YYYY-MM-DD`)
	const parsed = new Date(`${date}T00:00:00Z`)
	if (Number.isNaN(parsed.getTime()) || parsed.toISOString()
		.slice(0, 10) !== date) {
		throw new Error(`${field} is not a real calendar date: ${date}`)
	}
	return date
}

function advisoryKey(advisory: string, dependency: string): string {
	return `${advisory}\0${dependency}`
}

function directRoot(path: string): string {
	if (!path.startsWith('.>'))
		throw new Error(`Cannot classify pnpm audit dependency path: ${path}`)
	const root = path.slice(2)
		.split('>', 1)[0]
	if (!root)
		throw new Error(`Cannot classify pnpm audit dependency path: ${path}`)
	return root
}

function maxSeverity(left: SecuritySeverity, right: SecuritySeverity): SecuritySeverity {
	return severityRank[left] >= severityRank[right] ? left : right
}

export function parseAcknowledgements(value: unknown): SecurityAcknowledgementFile {
	if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.acknowledgements))
		throw new Error('security acknowledgement file must have schemaVersion 1 and an acknowledgements array')
	const seen = new Set<string>()
	const acknowledgements = value.acknowledgements.map((raw, index) => {
		if (!isRecord(raw))
			throw new Error(`acknowledgements[${index}] must be an object`)
		const advisory = requireString(raw.advisory, `acknowledgements[${index}].advisory`)
			.toUpperCase()
		if (!/^GHSA-[0-9A-Z-]+$/.test(advisory))
			throw new Error(`acknowledgements[${index}].advisory must be a GHSA id`)
		const dependency = requireString(raw.dependency, `acknowledgements[${index}].dependency`)
		const maxSeverityValue = requireSeverity(raw.maxSeverity, `acknowledgements[${index}].maxSeverity`)
		if (!Array.isArray(raw.allowedRoots) || raw.allowedRoots.length === 0 || !raw.allowedRoots.every(root => typeof root === 'string' && root.length > 0))
			throw new Error(`acknowledgements[${index}].allowedRoots must be a non-empty string array`)
		const allowedRoots = [...new Set(raw.allowedRoots as string[])].sort()
		if (allowedRoots.some(root => (releaseSensitiveToolRoots as readonly string[]).includes(root)))
			throw new Error(`${advisory}/${dependency} cannot acknowledge release/security-sensitive tooling`)
		if (raw.exposure !== 'development-tooling')
			throw new Error(`acknowledgements[${index}].exposure must be development-tooling`)
		const acknowledgedOn = assertDate(raw.acknowledgedOn, `acknowledgements[${index}].acknowledgedOn`)
		const expiresOn = assertDate(raw.expiresOn, `acknowledgements[${index}].expiresOn`)
		if (expiresOn < acknowledgedOn)
			throw new Error(`${advisory}/${dependency} expires before it was acknowledged`)
		const acknowledgement: SecurityAcknowledgement = {
			advisory,
			dependency,
			maxSeverity: maxSeverityValue,
			allowedRoots,
			exposure: 'development-tooling',
			exposureRationale: requireString(raw.exposureRationale, `acknowledgements[${index}].exposureRationale`),
			remediationBlocker: requireString(raw.remediationBlocker, `acknowledgements[${index}].remediationBlocker`),
			acknowledgedOn,
			expiresOn,
			reviewCondition: requireString(raw.reviewCondition, `acknowledgements[${index}].reviewCondition`),
		}
		const key = advisoryKey(advisory, dependency)
		if (seen.has(key))
			throw new Error(`Duplicate security acknowledgement for ${advisory}/${dependency}`)
		seen.add(key)
		return acknowledgement
	})
	return { schemaVersion: 1, acknowledgements }
}

export function normalizePnpmAudit(value: unknown): { advisories: NormalizedAdvisory[], ignoredBelowThreshold: number } {
	if (!isRecord(value) || !isRecord(value.advisories))
		throw new Error('pnpm audit JSON must contain an advisories object')
	const grouped = new Map<string, NormalizedAdvisory>()
	let ignoredBelowThreshold = 0
	for (const [rowId, raw] of Object.entries(value.advisories)) {
		if (!isRecord(raw))
			throw new Error(`pnpm audit advisory ${rowId} must be an object`)
		const severity = requireSeverity(raw.severity, `advisories.${rowId}.severity`)
		if (severityRank[severity] < severityRank[securitySeverityThreshold]) {
			ignoredBelowThreshold++
			continue
		}
		const dependency = requireString(raw.module_name, `advisories.${rowId}.module_name`)
		const url = requireString(raw.url, `advisories.${rowId}.url`)
		const ghsa = ghsaPattern.exec(url)?.[1]?.toUpperCase()
		if (!ghsa)
			throw new Error(`advisories.${rowId}.url does not end in a GHSA id: ${url}`)
		if (!Array.isArray(raw.findings) || raw.findings.length === 0)
			throw new Error(`advisories.${rowId}.findings must be a non-empty array`)
		const paths: string[] = []
		for (const [findingIndex, finding] of raw.findings.entries()) {
			if (!isRecord(finding) || !Array.isArray(finding.paths) || finding.paths.length === 0)
				throw new Error(`advisories.${rowId}.findings[${findingIndex}].paths must be non-empty`)
			for (const path of finding.paths) {
				if (typeof path !== 'string' || path.length === 0)
					throw new Error(`advisories.${rowId}.findings[${findingIndex}] contains an invalid path`)
				paths.push(path)
			}
		}
		const key = advisoryKey(ghsa, dependency)
		const existing = grouped.get(key)
		if (existing) {
			existing.severity = maxSeverity(existing.severity, severity)
			existing.paths = [...new Set([...existing.paths, ...paths])].sort()
			existing.roots = [...new Set(existing.paths.map(directRoot))].sort()
			existing.rows++
		}
		else {
			grouped.set(key, {
				advisory: ghsa,
				dependency,
				severity,
				roots: [...new Set(paths.map(directRoot))].sort(),
				paths: [...new Set(paths)].sort(),
				rows: 1,
				url,
			})
		}
	}
	return {
		advisories: [...grouped.values()].sort((a, b) => advisoryKey(a.advisory, a.dependency)
			.localeCompare(advisoryKey(b.advisory, b.dependency))),
		ignoredBelowThreshold,
	}
}

export function evaluateSecurityAudit(options: {
	fullAudit: unknown
	productionAudit: unknown
	acknowledgementFile: unknown
	now: string
}): SecurityPolicyReport {
	const full = normalizePnpmAudit(options.fullAudit)
	const production = normalizePnpmAudit(options.productionAudit)
	const acknowledgementFile = parseAcknowledgements(options.acknowledgementFile)
	const today = assertDate(options.now, 'now')
	const productionKeys = new Set(production.advisories.map(item => advisoryKey(item.advisory, item.dependency)))
	const currentKeys = new Set(full.advisories.map(item => advisoryKey(item.advisory, item.dependency)))
	const acknowledgements = new Map(acknowledgementFile.acknowledgements.map(item => [advisoryKey(item.advisory, item.dependency), item]))
	const failures: SecurityPolicyFailure[] = []
	const acknowledged: Array<NormalizedAdvisory & { acknowledgement: SecurityAcknowledgement }> = []

	for (const advisory of full.advisories) {
		const key = advisoryKey(advisory.advisory, advisory.dependency)
		if (productionKeys.has(key)) {
			failures.push({ advisory: advisory.advisory, dependency: advisory.dependency, reason: 'production-exposure', detail: 'The advisory is present in pnpm audit --prod and therefore reaches production/consumer dependencies.' })
			continue
		}
		const sensitiveRoots = advisory.roots.filter(root => (releaseSensitiveToolRoots as readonly string[]).includes(root))
		if (sensitiveRoots.length > 0) {
			failures.push({ advisory: advisory.advisory, dependency: advisory.dependency, reason: 'release-sensitive-tooling', detail: `The advisory reaches release/security-sensitive direct tool root(s): ${sensitiveRoots.join(', ')}.` })
			continue
		}
		const acknowledgement = acknowledgements.get(key)
		if (!acknowledgement) {
			failures.push({ advisory: advisory.advisory, dependency: advisory.dependency, reason: 'new-advisory', detail: 'No bounded acknowledgement exists for this non-production tooling advisory.' })
			continue
		}
		if (severityRank[advisory.severity] > severityRank[acknowledgement.maxSeverity]) {
			failures.push({ advisory: advisory.advisory, dependency: advisory.dependency, reason: 'severity-worsened', detail: `Severity ${advisory.severity} exceeds acknowledged ceiling ${acknowledgement.maxSeverity}.` })
			continue
		}
		const newRoots = advisory.roots.filter(root => !acknowledgement.allowedRoots.includes(root))
		if (newRoots.length > 0) {
			failures.push({ advisory: advisory.advisory, dependency: advisory.dependency, reason: 'exposure-worsened', detail: `Advisory gained unacknowledged direct root(s): ${newRoots.join(', ')}.` })
			continue
		}
		if (today > acknowledgement.expiresOn) {
			failures.push({ advisory: advisory.advisory, dependency: advisory.dependency, reason: 'expired-acknowledgement', detail: `Acknowledgement expired on ${acknowledgement.expiresOn}.` })
			continue
		}
		acknowledged.push({ ...advisory, acknowledgement })
	}

	for (const acknowledgement of acknowledgementFile.acknowledgements) {
		const key = advisoryKey(acknowledgement.advisory, acknowledgement.dependency)
		if (!currentKeys.has(key)) {
			failures.push({ advisory: acknowledgement.advisory, dependency: acknowledgement.dependency, reason: 'stale-acknowledgement', detail: 'Acknowledgement no longer matches a current advisory at the policy threshold and must be removed.' })
		}
	}

	return {
		threshold: securitySeverityThreshold,
		production: production.advisories,
		acknowledged,
		failures,
		fullAuditRowsAtThreshold: full.advisories.reduce((sum, advisory) => sum + advisory.rows, 0),
		productionAuditRowsAtThreshold: production.advisories.reduce((sum, advisory) => sum + advisory.rows, 0),
		ignoredBelowThreshold: full.ignoredBelowThreshold,
	}
}
