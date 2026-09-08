import { v } from 'valchecker'

export const payloadSchema = v.string()
	.toJSONValue({ message: 'Invalid JSON format' })
	.fallback(() => ({ items: [] }))
	.use(v.object({
		items: v.array(
			v.object({
				id: v.string()
					.toTrimmed()
					.isNotEmpty(),
				quantity: v.number()
					.isFinite()
					.isInteger()
					.isAtLeast(1),
			}),
		),
	}))
