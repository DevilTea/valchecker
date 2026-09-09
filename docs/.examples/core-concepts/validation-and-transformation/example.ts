import { v } from 'valchecker'

export const validationOnly = v.string()
	.check(value => value.trim().length > 0)

export const validationResult = validationOnly.execute('  Alice  ')

export const normalized = v.string()
	.transform(value => value.trim())
	.check(value => value.length > 0)

export const transformationResult = normalized.execute('  Alice  ')
