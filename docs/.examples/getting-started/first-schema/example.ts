import { v } from 'valchecker'

export const userSchema = v.object({
	name: v.string()
		.toTrimmed(),
	age: v.looseNumber(),
})

export const userInput = {
	name: '  Alice  ',
	age: '25',
} as const

export const userResult = userSchema.execute(userInput)
