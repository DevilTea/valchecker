import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { evaluateSecurityAudit } from './security-audit-policy'

const root = resolve(import.meta.dirname, '..')
const acknowledgementsPath = resolve(root, 'security-audit-acknowledgements.json')
const reportPath = resolve(root, 'artifacts/security-audit/report.json')

interface CommandResult {
	code: number | null
	stdout: string
	stderr: string
}

function run(command: string, args: string[]): Promise<CommandResult> {
	return new Promise((resolvePromise, reject) => {
		const child = spawn(command, args, { cwd: root, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] })
		let stdout = ''
		let stderr = ''
		child.stdout.setEncoding('utf8')
		child.stderr.setEncoding('utf8')
		child.stdout.on('data', chunk => stdout += chunk)
		child.stderr.on('data', chunk => stderr += chunk)
		child.once('error', reject)
		child.once('exit', code => resolvePromise({ code, stdout, stderr }))
	})
}

async function pnpmAudit(productionOnly: boolean): Promise<unknown> {
	const args = ['audit', '--json', '--audit-level=moderate']
	if (productionOnly)
		args.splice(1, 0, '--prod')
	const result = await run('pnpm', args)
	if (result.code !== 0 && result.code !== 1)
		throw new Error(`pnpm ${args.join(' ')} failed with ${String(result.code)}:\n${result.stderr || result.stdout}`)
	try {
		return JSON.parse(result.stdout) as unknown
	}
	catch (error) {
		throw new Error(`pnpm ${args.join(' ')} did not return valid audit JSON (exit ${String(result.code)}): ${error instanceof Error ? error.message : String(error)}\n${result.stderr || result.stdout}`)
	}
}

function todayUtc(): string {
	return new Date()
		.toISOString()
		.slice(0, 10)
}

function markdownSummary(report: ReturnType<typeof evaluateSecurityAudit>): string {
	const lines = [
		'## Exposure-based security audit',
		'',
		`- Policy threshold: **${report.threshold}**`,
		`- Production/consumer advisories: **${report.production.length}** (${report.productionAuditRowsAtThreshold} pnpm rows)`,
		`- Full audit advisories at threshold: **${report.acknowledged.length + report.failures.filter(item => item.reason !== 'stale-acknowledgement').length}** (${report.fullAuditRowsAtThreshold} pnpm rows)`,
		`- Acknowledged development-tool advisories: **${report.acknowledged.length}**`,
		`- Blocking policy findings: **${report.failures.length}**`,
	]
	if (report.acknowledged.length > 0) {
		lines.push('', '### Acknowledged bounded debt', '')
		for (const item of report.acknowledged) {
			lines.push(`- ${item.advisory} · \`${item.dependency}\` · ${item.severity} · roots: ${item.roots.map(root => `\`${root}\``)
				.join(', ')} · expires ${item.acknowledgement.expiresOn}`)
		}
	}
	if (report.failures.length > 0) {
		lines.push('', '### Blocking findings', '')
		for (const failure of report.failures)
			lines.push(`- **${failure.reason}** · ${failure.advisory} · \`${failure.dependency}\`: ${failure.detail}`)
	}
	return `${lines.join('\n')}\n`
}

async function main(): Promise<void> {
	const acknowledgementFile = JSON.parse(await readFile(acknowledgementsPath, 'utf8')) as unknown
	const [fullAudit, productionAudit] = await Promise.all([pnpmAudit(false), pnpmAudit(true)])
	const report = evaluateSecurityAudit({
		fullAudit,
		productionAudit,
		acknowledgementFile,
		now: todayUtc(),
	})
	await mkdir(dirname(reportPath), { recursive: true })
	await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
	const summary = markdownSummary(report)
	process.stdout.write(summary)
	if (process.env.GITHUB_STEP_SUMMARY)
		await writeFile(process.env.GITHUB_STEP_SUMMARY, summary, { flag: 'a' })
	if (report.failures.length > 0)
		process.exitCode = 1
}

await main()
