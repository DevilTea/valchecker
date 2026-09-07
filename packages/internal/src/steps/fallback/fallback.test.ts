import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, Next, TStepPluginDef } from '../../core'
import { describe, expect, it, vi } from 'vitest'
import { blob, check, createValchecker, fallback, implStepPlugin, isMatching, isMimeType, number, strictObject, string, union } from '../..'
import { markIssueSnapshotPayload, snapshotIssuesForConsumer } from '../../core/core'
import { syncResult } from '../../test-utils/helpers'

type FatalIssue = ExecutionIssue<'fatal:failed', { value: unknown }, 'internal'>
type FatalMeta = DefineStepMethodMeta<{
	Name: 'fatal'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: FatalIssue
}>
interface FatalPluginDef extends TStepPluginDef {
	fatal: DefineStepMethod<
		FatalMeta,
		this['CurrentValchecker'] extends FatalMeta['ExpectedCurrentValchecker']
			? () => Next<{ issue: FatalIssue }, this['CurrentValchecker']>
			: never
	>
}
const fatal = implStepPlugin<FatalPluginDef>({
	fatal: ({ utils: { addSuccessStep, createIssue, failure } }) => {
		addSuccessStep(value => failure(createIssue({
			code: 'fatal:failed',
			category: 'internal',
			payload: { value },
			defaultMessage: 'Fatal failure.',
		})))
	},
})

const v = createValchecker({ steps: [blob, check, fallback, isMatching, isMimeType, string, number, strictObject, union, fatal] })

function expectedNumberIssue(value: unknown) {
	return {
		code: 'number:expected_number',
		category: 'validation',
		message: 'Expected a number.',
		path: [],
		payload: { value },
	}
}

describe('fallback plugin', () => {
	it('does not run when the previous step succeeds', () => {
		expect(v.string()
			.fallback(() => 'fallback')
			.execute('hello'))
			.toEqual({ value: 'hello' })
	})

	it('recovers validation failures and passes the original issues', () => {
		let captured: unknown
		const result = v.number()
			.fallback((issues) => {
				captured = issues
				return 42
			})
			.execute('bad')
		expect(result)
			.toEqual({ value: 42 })
		expect(captured)
			.toEqual([expectedNumberIssue('bad')])
	})

	it('recovers an operation failure and passes its issues to the callback', () => {
		const error = new Error('Check callback error')
		let captured: unknown
		const result = v.string()
			.check(() => { throw error })
			.fallback((issues) => {
				captured = issues
				return 'recovered'
			})
			.execute('input')
		expect(result)
			.toEqual({ value: 'recovered' })
		expect(captured)
			.toMatchObject([{
				code: 'check:callback_failed',
				category: 'operation',
				payload: { phase: 'throw', value: 'input', error },
			}])
	})

	it('supports asynchronous recovery', async () => {
		await expect(v.number()
			.fallback(async () => 42)
			.execute('bad'))
			.resolves.toEqual({ value: 42 })
	})

	it('bypasses the callback for internal failures', () => {
		const run = vi.fn(() => 'recovered')
		const result = v.fatal()
			.fallback(run)
			.execute('input')
		expect(run).not.toHaveBeenCalled()
		expect(result)
			.toEqual({
				issues: [{
					code: 'fatal:failed',
					category: 'internal',
					message: 'Fatal failure.',
					path: [],
					payload: { value: 'input' },
				}],
			})
	})

	it('preserves original issues when the callback throws', () => {
		const error = new Error('Fallback error')
		const original = expectedNumberIssue('bad')
		const result = v.number()
			.fallback(() => { throw error })
			.execute('bad')
		expect(result)
			.toEqual({
				issues: [
					original,
					{
						code: 'fallback:failed',
						category: 'operation',
						message: 'Fallback failed.',
						path: [],
						payload: { receivedIssues: [original], error },
					},
				],
			})
	})

	it('preserves original issues when the callback rejects', async () => {
		const error = new Error('Rejected fallback error')
		const original = expectedNumberIssue('bad')
		await expect(v.number()
			.fallback(async () => { throw error })
			.execute('bad'))
			.resolves.toEqual({
				issues: [
					original,
					{
						code: 'fallback:failed',
						category: 'operation',
						message: 'Fallback failed.',
						path: [],
						payload: { receivedIssues: [original], error },
					},
				],
			})
	})

	it('isolates callback mutations from preserved original issues', () => {
		const error = new Error('Mutating fallback error')
		const original = expectedNumberIssue('bad')
		const result = v.number()
			.fallback((issues) => {
				const issue = issues[0]!
				issue.path.push('mutated')
				if (issue.code !== 'number:expected_number')
					throw new Error(`Unexpected issue: ${issue.code}`)
				issue.payload.value = 'mutated'
				issues.splice(0, issues.length)
				throw error
			})
			.execute('bad')
		expect(result)
			.toEqual({
				issues: [
					original,
					{
						code: 'fallback:failed',
						category: 'operation',
						message: 'Fallback failed.',
						path: [],
						payload: { receivedIssues: [original], error },
					},
				],
			})
	})

	it('isolates Valchecker-owned nested payload containers from callback mutation', () => {
		const error = new Error('Nested payload mutation')
		const result = v.strictObject({ a: v.string() })
			.fallback((issues) => {
				const issue = issues[0]!
				if (issue.code !== 'strictObject:unexpected_keys')
					throw new Error(`Unexpected issue: ${issue.code}`)
				issue.payload.keys.push('INJECTED')
				issue.payload.expectedKeys.push('FAKE_EXPECTED')
				throw error
			})
			.execute({ a: 'ok', extra: 1 })

		expect(result)
			.toMatchObject({
				issues: [
					{
						code: 'strictObject:unexpected_keys',
						payload: { keys: ['extra'], expectedKeys: ['a'] },
					},
					{
						code: 'fallback:failed',
						payload: {
							receivedIssues: [{
								code: 'strictObject:unexpected_keys',
								payload: { keys: ['extra'], expectedKeys: ['a'] },
							}],
							error,
						},
					},
				],
			})
	})

	it('composes construction snapshots with nested MIME diagnostic ownership', () => {
		const types = ['image/png', 'application/pdf']
		const error = new Error('MIME payload mutation')
		const schema = v.blob()
			.isMimeType(types)
			.fallback((issues) => {
				const issue = issues[0]!
				if (issue.code !== 'isMimeType:unexpected_mime_type')
					throw new Error(`Unexpected issue: ${issue.code}`)
				if (!Array.isArray(issue.payload.expected))
					throw new Error('Expected a MIME list diagnostic.')
				issue.payload.expected.push('text/plain')
				throw error
			})
		types.splice(0, types.length, 'text/plain')

		const input = new Blob(['data'], { type: 'text/plain' })
		expect(schema.execute(input))
			.toMatchObject({
				issues: [
					{
						code: 'isMimeType:unexpected_mime_type',
						payload: { expected: ['image/png', 'application/pdf'] },
					},
					{
						code: 'fallback:failed',
						payload: {
							receivedIssues: [{
								code: 'isMimeType:unexpected_mime_type',
								payload: { expected: ['image/png', 'application/pdf'] },
							}],
							error,
						},
					},
				],
			})
	})

	it('isolates Valchecker-owned nested diagnostic records from callback mutation', () => {
		const error = new Error('Pattern snapshot mutation')
		const result = v.string()
			.isMatching(/^foo$/i)
			.fallback((issues) => {
				const issue = issues[0]!
				if (issue.code !== 'isMatching:expected_matching')
					throw new Error(`Unexpected issue: ${issue.code}`)
				expect(Reflect.set(issue.payload.pattern, 'source', 'changed'))
					.toBe(true)
				throw error
			})
			.execute('bar')

		expect(result)
			.toMatchObject({
				issues: [
					{
						code: 'isMatching:expected_matching',
						payload: { pattern: { source: '^foo$', flags: 'i' } },
					},
					{
						code: 'fallback:failed',
						payload: {
							receivedIssues: [{
								code: 'isMatching:expected_matching',
								payload: { pattern: { source: '^foo$', flags: 'i' } },
							}],
							error,
						},
					},
				],
			})
	})

	it('copies context entry records instead of sharing them with callback snapshots', () => {
		const error = new Error('Context mutation')
		const result = v.union([v.string(), v.number()])
			.fallback((issues) => {
				const context = issues[0]!.context?.[0]
				if (context == null)
					throw new Error('Expected union context')
				context.type = 'mutated'
				context.branchIndex = 99
				throw error
			})
			.execute(false)

		expect(result)
			.toMatchObject({
				issues: [
					{ context: [{ type: 'union', branchIndex: 0 }] },
					{ context: [{ type: 'union', branchIndex: 1 }] },
					{ code: 'fallback:failed', payload: { error } },
				],
			})
	})

	it('preserves opaque payload value identity instead of deep-cloning user values', () => {
		const proxy = new Proxy({ proxy: true }, {})
		const values: unknown[] = [
			{ plain: true },
			['array'],
			new Error('opaque'),
			new Date(0),
			new Map([['key', 'value']]),
			proxy,
			() => 'callback',
			v.string(),
		]
		let received: unknown
		const schema = v.number()
			.fallback((issues) => {
				const issue = issues[0]!
				if (issue.code !== 'number:expected_number')
					throw new Error(`Unexpected issue: ${issue.code}`)
				received = issue.payload.value
				return 0
			})

		for (const value of values) {
			received = undefined
			expect(schema.execute(value))
				.toEqual({ value: 0 })
			expect(received)
				.toBe(value)
		}
	})

	it('recursively isolates nested execution issues carried by fallback payloads', () => {
		const firstError = new Error('First fallback failed')
		const secondError = new Error('Second fallback failed')
		const result = syncResult(v.number()
			.fallback(() => { throw firstError })
			.fallback((issues) => {
				const firstFallbackIssue = issues.find(issue => issue.code === 'fallback:failed')
				if (firstFallbackIssue?.code !== 'fallback:failed')
					throw new Error('Expected first fallback issue')
				const nested = firstFallbackIssue.payload.receivedIssues[0]!
				nested.path.push('mutated')
				if (nested.code === 'number:expected_number')
					nested.payload.value = 'mutated'
				firstFallbackIssue.payload.receivedIssues.splice(0, firstFallbackIssue.payload.receivedIssues.length)
				throw secondError
			})
			.execute('bad'))

		if (!v.isFailure(result))
			throw new Error('Expected failure')
		const fallbackIssues = result.issues.filter(issue => issue.code === 'fallback:failed')
		expect(fallbackIssues)
			.toHaveLength(2)
		const firstFallbackIssue = fallbackIssues[0]!
		if (firstFallbackIssue.code !== 'fallback:failed')
			throw new Error('Expected fallback issue')
		expect(firstFallbackIssue.payload)
			.toMatchObject({
				error: firstError,
				receivedIssues: [{
					code: 'number:expected_number',
					path: [],
					payload: { value: 'bad' },
				}],
			})
	})

	it('preserves a non-record payload identity while detaching the issue path', () => {
		const payload = ['caller-owned']
		const issue: ExecutionIssue<'foreign:opaque_payload', typeof payload> = {
			code: 'foreign:opaque_payload',
			category: 'validation',
			message: 'Opaque payload.',
			path: ['source'],
			payload,
		}

		const [snapshot] = snapshotIssuesForConsumer([issue])
		expect(snapshot).not.toBe(issue)
		expect(snapshot.path).not.toBe(issue.path)
		expect(snapshot.path)
			.toEqual(['source'])
		expect(snapshot.payload)
			.toBe(payload)
	})

	it('honors the versioned payload ownership protocol from another package copy', () => {
		const protocol = Symbol.for('valchecker.protocol.issueSnapshotPayload.v1')
		const owned = ['owned']
		const opaque = { identity: true }
		const policy: { owned: 'container' | 'issues' } = { owned: 'container' }
		const payload = { owned, opaque }
		Object.defineProperty(payload, protocol, { value: policy })
		const issue: ExecutionIssue<'foreign:issue', typeof payload> = {
			code: 'foreign:issue',
			category: 'validation',
			message: 'Foreign issue.',
			path: [],
			payload,
		}

		const [snapshot] = snapshotIssuesForConsumer([issue])
		expect(snapshot.payload.owned).not.toBe(owned)
		expect(snapshot.payload.owned)
			.toEqual(['owned'])
		snapshot.payload.owned.push('snapshot-only')
		expect(owned)
			.toEqual(['owned'])
		expect(snapshot.payload.opaque === opaque)
			.toBe(true)
		expect(Object.keys(snapshot.payload))
			.toEqual(['owned', 'opaque'])
		expect(Object.prototype.propertyIsEnumerable.call(snapshot.payload, protocol))
			.toBe(false)
		const snapshotPolicy = Reflect.get(snapshot.payload, protocol) as typeof policy
		expect(snapshotPolicy).not.toBe(policy)
		snapshotPolicy.owned = 'issues'
		expect(policy.owned)
			.toBe('container')
	})

	it('honors versioned shared diagnostic container protocols from another package copy', () => {
		const arrayProtocol = Symbol.for('valchecker.protocol.issueSnapshotArray.v1')
		const objectProtocol = Symbol.for('valchecker.protocol.issueSnapshotObject.v1')
		const ownedArray = ['owned']
		const ownedObject = { nested: 'owned' }
		Object.defineProperty(ownedArray, arrayProtocol, { value: true })
		Object.defineProperty(ownedObject, objectProtocol, { value: true })
		const payload = { ownedArray, ownedObject }
		const issue: ExecutionIssue<'foreign:shared_diagnostics', typeof payload> = {
			code: 'foreign:shared_diagnostics',
			category: 'validation',
			message: 'Foreign shared diagnostics.',
			path: [],
			payload,
		}

		const [snapshot] = snapshotIssuesForConsumer([issue])
		expect(snapshot.payload.ownedArray).not.toBe(ownedArray)
		expect(snapshot.payload.ownedArray)
			.toEqual(['owned'])
		expect(snapshot.payload.ownedObject).not.toBe(ownedObject)
		expect(snapshot.payload.ownedObject)
			.toEqual({ nested: 'owned' })
		expect(Object.prototype.propertyIsEnumerable.call(snapshot.payload.ownedArray, arrayProtocol))
			.toBe(false)
		expect(Object.prototype.propertyIsEnumerable.call(snapshot.payload.ownedObject, objectProtocol))
			.toBe(false)
		expect(Reflect.get(snapshot.payload.ownedArray, arrayProtocol))
			.toBe(true)
		expect(Reflect.get(snapshot.payload.ownedObject, objectProtocol))
			.toBe(true)
	})

	it('fails closed when owned-container marker lookup is hostile', () => {
		const arrayProtocol = Symbol.for('valchecker.protocol.issueSnapshotArray.v1')
		const objectProtocol = Symbol.for('valchecker.protocol.issueSnapshotObject.v1')
		const hostileArray = new Proxy(['array'], {
			get(target, property, receiver) {
				if (property === arrayProtocol)
					throw new Error('hostile array marker')
				return Reflect.get(target, property, receiver)
			},
		})
		const hostileObject = new Proxy({ object: true }, {
			get(target, property, receiver) {
				if (property === objectProtocol)
					throw new Error('hostile object marker')
				return Reflect.get(target, property, receiver)
			},
		})
		const opaqueDate = new Date(0)
		const payload = markIssueSnapshotPayload(
			{ hostileArray, hostileObject, opaqueDate },
			{ hostileArray: 'container', hostileObject: 'container', opaqueDate: 'container' },
		)
		const issue: ExecutionIssue<'owned:hostile_markers', typeof payload> = {
			code: 'owned:hostile_markers',
			category: 'validation',
			message: 'Owned containers with hostile marker lookup.',
			path: [],
			payload,
		}

		const [snapshot] = snapshotIssuesForConsumer([issue])
		expect(snapshot.payload.hostileArray).not.toBe(hostileArray)
		expect(snapshot.payload.hostileArray)
			.toEqual(['array'])
		expect(snapshot.payload.hostileObject).not.toBe(hostileObject)
		expect(snapshot.payload.hostileObject)
			.toEqual({ object: true })
		expect(snapshot.payload.opaqueDate)
			.toBe(opaqueDate)
	})

	it('copies an owned payload policy before retaining it', () => {
		const owned = ['owned']
		const policy: { owned: 'container' | 'issues' } = { owned: 'container' }
		const payload = markIssueSnapshotPayload({ owned }, policy)
		policy.owned = 'issues'
		const issue: ExecutionIssue<'owned:issue', typeof payload> = {
			code: 'owned:issue',
			category: 'validation',
			message: 'Owned issue.',
			path: [],
			payload,
		}

		const [snapshot] = snapshotIssuesForConsumer([issue])
		expect(snapshot.payload.owned).not.toBe(owned)
		expect(snapshot.payload.owned)
			.toEqual(['owned'])
	})

	it('preserves a nested opaque payload value when prototype inspection throws', () => {
		const opaque = new Proxy({}, {
			getPrototypeOf() {
				throw new Error('nested opaque proxy prototype')
			},
		})
		const payload = { opaque }
		const issue: ExecutionIssue<'foreign:nested_proxy_payload', typeof payload> = {
			code: 'foreign:nested_proxy_payload',
			category: 'validation',
			message: 'Nested proxy payload.',
			path: [],
			payload,
		}

		const [snapshot] = snapshotIssuesForConsumer([issue])
		expect(snapshot.payload !== payload)
			.toBe(true)
		expect(snapshot.payload.opaque === opaque)
			.toBe(true)
	})

	it('preserves an opaque payload when prototype inspection throws', () => {
		const payload = new Proxy({}, {
			getPrototypeOf() {
				throw new Error('opaque proxy prototype')
			},
		})
		const issue: ExecutionIssue<'foreign:proxy_payload', typeof payload> = {
			code: 'foreign:proxy_payload',
			category: 'validation',
			message: 'Proxy payload.',
			path: [],
			payload,
		}

		const [snapshot] = snapshotIssuesForConsumer([issue])
		expect(snapshot.payload)
			.toBe(payload)
	})

	it('stores public-safe snapshots of the issues received by the callback', () => {
		const result = syncResult(v.number({ message: () => 'Dynamic number issue' })
			.fallback(() => { throw new Error('failure') })
			.execute('bad'))
		expect(result)
			.toMatchObject({
				issues: [
					{ code: 'number:expected_number', message: 'Dynamic number issue' },
					{ code: 'fallback:failed' },
				],
			})
		if (v.isFailure(result)) {
			const callbackIssue = result.issues[1]
			if (callbackIssue?.code === 'fallback:failed') {
				const snapshot = callbackIssue.payload.receivedIssues[0]!
				expect(Object.getOwnPropertySymbols(snapshot))
					.toEqual([])
				expect(snapshot.path).not.toBe(result.issues[0]!.path)
				// The snapshot drops the non-enumerable message metadata, so a
				// dynamic message stays at its unresolved draft message (the step
				// default) even though the returned issue resolves to the dynamic
				// 'Dynamic number issue'.
				expect(result.issues[0]!.message)
					.toBe('Dynamic number issue')
				expect(snapshot.message)
					.toBe('Expected a number.')
			}
		}
	})

	it('snapshots union provenance received by a failing callback', () => {
		const result = syncResult(v.union([v.string(), v.number()])
			.fallback(() => { throw new Error('failure') })
			.execute(false))
		if (!v.isFailure(result))
			throw new Error('Expected failure')
		const callbackIssue = result.issues[2]
		if (callbackIssue?.code !== 'fallback:failed')
			throw new Error('Expected fallback issue')
		const snapshot = callbackIssue.payload.receivedIssues[0]!
		expect(snapshot.context)
			.toEqual([{ type: 'union', branchIndex: 0 }])
		expect(snapshot.context).not.toBe(result.issues[0]!.context)
	})

	it('uses the callback failure message override', () => {
		const original = expectedNumberIssue('bad')
		const result = v.number()
			.fallback(() => { throw new Error('failure') }, { message: 'Custom fallback message' })
			.execute('bad')
		expect(result)
			.toMatchObject({
				issues: [
					original,
					{
						code: 'fallback:failed',
						category: 'operation',
						message: 'Custom fallback message',
					},
				],
			})
	})
})
