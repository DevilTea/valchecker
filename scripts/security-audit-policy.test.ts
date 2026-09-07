import { describe, expect, it } from 'vitest'
import {
	evaluateSecurityAudit,
	normalizePnpmAudit,
	parseAcknowledgements,
	releaseSensitiveToolRoots,
} from './security-audit-policy'

function audit(rows: Array<{
	id: number
	ghsa: string
	dependency: string
	severity?: string
	paths?: string[]
}>) {
	return {
		actions: [],
		advisories: Object.fromEntries(rows.map(row => [String(row.id), {
			id: row.id,
			module_name: row.dependency,
			severity: row.severity ?? 'high',
			url: `https://github.com/advisories/${row.ghsa}`,
			findings: [{ version: '1.0.0', paths: row.paths ?? [`.>eslint>${row.dependency}`] }],
		}])),
		metadata: {},
	}
}

function acknowledgement(overrides: Record<string, unknown> = {}) {
	return {
		advisory: 'GHSA-aaaa-bbbb-cccc',
		dependency: 'fixture-dependency',
		maxSeverity: 'high',
		allowedRoots: ['eslint'],
		exposure: 'development-tooling',
		exposureRationale: 'Fixture reaches only a non-production lint tool.',
		remediationBlocker: 'Fixture requires an upstream tooling migration.',
		acknowledgedOn: '2026-09-05',
		expiresOn: '2026-10-05',
		reviewCondition: 'Review on exposure/severity change or by expiry.',
		...overrides,
	}
}

function acknowledgementFile(entries = [acknowledgement()]) {
	return { schemaVersion: 1, acknowledgements: entries }
}

function fixtureAudit(overrides: { severity?: string, paths?: string[] } = {}) {
	return audit([{
		id: 1,
		ghsa: 'GHSA-aaaa-bbbb-cccc',
		dependency: 'fixture-dependency',
		...overrides,
	}])
}

describe('security audit policy', () => {
	it('merges pnpm rows for one GHSA/dependency and retains every direct root', () => {
		const normalized = normalizePnpmAudit(audit([
			{ id: 1, ghsa: 'GHSA-aaaa-bbbb-cccc', dependency: 'fixture-dependency', paths: ['.>eslint>fixture-dependency'] },
			{ id: 2, ghsa: 'GHSA-aaaa-bbbb-cccc', dependency: 'fixture-dependency', paths: ['.>@deviltea/eslint-config>fixture-dependency'] },
		]))
		expect(normalized.advisories)
			.toEqual([expect.objectContaining({
				advisory: 'GHSA-AAAA-BBBB-CCCC',
				dependency: 'fixture-dependency',
				roots: ['@deviltea/eslint-config', 'eslint'],
				rows: 2,
			})])
	})

	it('allows unchanged acknowledged non-production tooling debt', () => {
		const report = evaluateSecurityAudit({
			fullAudit: fixtureAudit(),
			productionAudit: audit([]),
			acknowledgementFile: acknowledgementFile(),
			now: '2026-09-05',
		})
		expect(report.failures)
			.toEqual([])
		expect(report.acknowledged)
			.toHaveLength(1)
	})

	it('fails a new non-production tooling advisory instead of silently allowing devDependencies', () => {
		const report = evaluateSecurityAudit({
			fullAudit: fixtureAudit(),
			productionAudit: audit([]),
			acknowledgementFile: acknowledgementFile([]),
			now: '2026-09-05',
		})
		expect(report.failures)
			.toContainEqual(expect.objectContaining({ reason: 'new-advisory' }))
	})

	it('fails production exposure even when an acknowledgement exists', () => {
		const current = fixtureAudit()
		const report = evaluateSecurityAudit({
			fullAudit: current,
			productionAudit: current,
			acknowledgementFile: acknowledgementFile(),
			now: '2026-09-05',
		})
		expect(report.failures)
			.toContainEqual(expect.objectContaining({ reason: 'production-exposure' }))
		expect(report.acknowledged)
			.toEqual([])
	})

	it('fails release/security-sensitive tooling even when acknowledged', () => {
		const root = releaseSensitiveToolRoots[0]
		const report = evaluateSecurityAudit({
			fullAudit: fixtureAudit({ paths: [`.>${root}>fixture-dependency`] }),
			productionAudit: audit([]),
			acknowledgementFile: { schemaVersion: 1, acknowledgements: [] },
			now: '2026-09-05',
		})
		expect(report.failures)
			.toContainEqual(expect.objectContaining({ reason: 'release-sensitive-tooling' }))
	})

	it('refuses acknowledgements that try to whitelist a release-sensitive root', () => {
		expect(() => parseAcknowledgements(acknowledgementFile([
			acknowledgement({ allowedRoots: [releaseSensitiveToolRoots[0]] }),
		])))
			.toThrow('cannot acknowledge release/security-sensitive tooling')
	})

	it('fails when severity worsens beyond the acknowledged ceiling', () => {
		const report = evaluateSecurityAudit({
			fullAudit: fixtureAudit({ severity: 'high' }),
			productionAudit: audit([]),
			acknowledgementFile: acknowledgementFile([acknowledgement({ maxSeverity: 'moderate' })]),
			now: '2026-09-05',
		})
		expect(report.failures)
			.toContainEqual(expect.objectContaining({ reason: 'severity-worsened' }))
	})

	it('fails when an acknowledged advisory gains a new direct exposure root', () => {
		const report = evaluateSecurityAudit({
			fullAudit: fixtureAudit({ paths: ['.>eslint>fixture-dependency', '.>vitest>fixture-dependency'] }),
			productionAudit: audit([]),
			acknowledgementFile: acknowledgementFile(),
			now: '2026-09-05',
		})
		expect(report.failures)
			.toContainEqual(expect.objectContaining({ reason: 'exposure-worsened' }))
	})

	it('fails an expired acknowledgement but accepts it through its expiry date', () => {
		const onExpiry = evaluateSecurityAudit({
			fullAudit: fixtureAudit(),
			productionAudit: audit([]),
			acknowledgementFile: acknowledgementFile(),
			now: '2026-10-05',
		})
		expect(onExpiry.failures)
			.toEqual([])
		const afterExpiry = evaluateSecurityAudit({
			fullAudit: fixtureAudit(),
			productionAudit: audit([]),
			acknowledgementFile: acknowledgementFile(),
			now: '2026-10-06',
		})
		expect(afterExpiry.failures)
			.toContainEqual(expect.objectContaining({ reason: 'expired-acknowledgement' }))
	})

	it('fails stale debt records once the advisory is gone', () => {
		const report = evaluateSecurityAudit({
			fullAudit: audit([]),
			productionAudit: audit([]),
			acknowledgementFile: acknowledgementFile(),
			now: '2026-09-05',
		})
		expect(report.failures)
			.toContainEqual(expect.objectContaining({ reason: 'stale-acknowledgement' }))
	})

	it('rejects malformed or duplicate acknowledgement records', () => {
		expect(() => parseAcknowledgements(acknowledgementFile([
			acknowledgement(),
			acknowledgement(),
		])))
			.toThrow('Duplicate security acknowledgement')
		expect(() => parseAcknowledgements(acknowledgementFile([
			acknowledgement({ remediationBlocker: '' }),
		])))
			.toThrow('remediationBlocker must be a non-empty string')
	})

	it('fails closed when pnpm emits a dependency path whose exposure cannot be classified', () => {
		expect(() => normalizePnpmAudit(fixtureAudit({ paths: ['workspace>fixture-dependency'] })))
			.toThrow('Cannot classify pnpm audit dependency path')
	})
})
