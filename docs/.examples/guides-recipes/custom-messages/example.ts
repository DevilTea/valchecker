import { allSteps, createValchecker } from 'valchecker'

export const v = createValchecker({
	steps: allSteps,
	message: ({ code }) => `Global message for ${code}`,
})

export const nameSchema = v.string({
	message: 'Name must be text',
})

export const ageSchema = v.number()
	.isAtLeast(18)
