import { createValchecker, literal, number, object, variant } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [literal, number, object, variant] })

const schema = v.variant({
	discriminator: 'type',
	variants: {
		circle: v.object({ type: v.literal('circle'), radius: v.number() }),
		square: v.object({ type: v.literal('square'), size: v.number() }),
		triangle: v.object({ type: v.literal('triangle'), base: v.number(), height: v.number() }),
	},
})

const selected = { type: 'triangle', base: 2, height: 3 }
const unknownDiscriminator = { type: 'hexagon', sides: 6 }

// `variant` dispatches to one branch through a key lookup: it has no child loop to make
// non-empty and no `collectAllIssues` option, so a collect-all cell would measure the
// branch schema's policy rather than this step's.
stepBench('variant', [
	{
		name: 'selected-valid',
		group: 'warm/success',
		expect: { success: true },
		batch: 20,
		run: () => schema.execute(selected),
	},
	{
		name: 'invalid-discriminator',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['variant:invalid_discriminator'] },
		batch: 20,
		run: () => schema.execute(unknownDiscriminator),
	},
])
