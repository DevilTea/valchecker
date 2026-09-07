import assert from 'node:assert/strict'
import { test } from 'node:test'
import { moduleSideEffectsFromManifest } from './package-side-effects.mjs'

const root = '/consumer/node_modules/example'
const modulePath = `${root}/dist/deep/module.mjs`

test('sideEffects false makes every packed module removable when unused', () => {
	assert.equal(moduleSideEffectsFromManifest({ name: 'example', sideEffects: false }, root, modulePath), false)
})

test('missing or true sideEffects stays conservative', () => {
	assert.equal(moduleSideEffectsFromManifest({ name: 'example' }, root, modulePath), true)
	assert.equal(moduleSideEffectsFromManifest({ name: 'example', sideEffects: true }, root, modulePath), true)
})

test('a precise sideEffects list marks only matching modules', () => {
	const manifest = { name: 'example', sideEffects: ['register.mjs', 'dist/polyfills/**'] }
	assert.equal(moduleSideEffectsFromManifest(manifest, root, `${root}/dist/register.mjs`), true)
	assert.equal(moduleSideEffectsFromManifest(manifest, root, `${root}/dist/polyfills/global.mjs`), true)
	assert.equal(moduleSideEffectsFromManifest(manifest, root, modulePath), false)
})

test('malformed sideEffects metadata fails closed instead of forcing an optimization', () => {
	assert.throws(
		() => moduleSideEffectsFromManifest({ name: 'example', sideEffects: 1 }, root, modulePath),
		/invalid sideEffects declaration/,
	)
})
