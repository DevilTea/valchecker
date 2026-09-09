import { v } from 'valchecker'

export const orderSchema = v.object({
	id: v.string()
		.toTrimmed()
		.isNotEmpty(),
	items: v.array(v.object({
		sku: v.string()
			.toTrimmed()
			.isNotEmpty(),
		quantity: v.looseNumber()
			.isFinite()
			.isInteger()
			.isAtLeast(1),
	}))
		.isNotEmpty(),
	note: [v.string()
		.toTrimmed()],
	status: v.union([
		v.literal('draft'),
		v.literal('submitted'),
	]),
})
