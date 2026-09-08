import { v } from 'valchecker'

export const profileSchema = v.object({
	user: v.object({
		profile: v.object({
			email: v.string()
				.check(value => value.includes('@')),
		}),
	}),
})

export const nestedFailure = profileSchema.execute({
	user: {
		profile: {
			email: 'invalid',
		},
	},
})

export const unionSchema = v.union([
	v.string(),
	v.number(),
])

export const unionFailure = unionSchema.execute(false)
