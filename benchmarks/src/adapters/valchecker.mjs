import { v } from '../../../packages/valchecker/dist/index.mjs'

const fields = {
  id: v.string(),
  name: v.string(),
  age: v.number().integer().min(0),
  active: v.boolean(),
  role: v.literal('admin'),
  email: v.string().check(value => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)),
  score: v.number(),
  verified: v.boolean(),
  nickname: [v.string()],
  attempts: v.number().integer().min(0),
}

const optionalFields = {
  id: v.string(),
  enabled: v.boolean(),
  name: [v.string()],
  region: [v.string()],
  retries: [v.number().integer()],
  timeout: [v.number()],
  endpoint: [v.string()],
  cache: [v.boolean()],
  debug: [v.boolean()],
  owner: [v.string()],
  team: [v.string()],
  description: [v.string()],
  priority: [v.number()],
  batchSize: [v.number()],
  parallelism: [v.number()],
  tag: [v.string()],
}

export default {
  name: 'Valchecker',
  version: 'workspace',
  build: {
    primitive: () => v.string()
      .min(3)
      .max(32)
      .check(value => /^[a-z0-9-]+$/.test(value)),
    flatObject: () => v.object(fields),
    strictFlatObject: () => v.strictObject(fields),
    nestedObject: () => v.object({
      id: v.string(),
      user: v.object({
        profile: v.object({
          name: v.string(),
          email: v.string().check(value => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)),
          address: v.object({
            city: v.string(),
            country: v.string().check(value => value.length === 2),
            postalCode: v.string(),
          }),
        }),
        permissions: v.array(v.string()),
      }),
    }),
    recordArray: () => v.array(v.object({
      id: v.string(),
      value: v.number(),
      enabled: v.boolean(),
    })),
    union: () => v.union([
      v.object({ type: v.literal('text'), value: v.string() }),
      v.object({ type: v.literal('count'), value: v.number() }),
      v.object({ type: v.literal('point'), x: v.number(), y: v.number() }),
      v.object({ type: v.literal('flag'), enabled: v.boolean() }),
      v.object({ type: v.literal('user'), id: v.string(), active: v.boolean() }),
    ]),
    transform: () => v.string()
      .toTrimmed()
      .toLowercase()
      .transform(value => `user:${value}`),
    optionalHeavy: () => v.object(optionalFields),
  },
  parse(schema, input) {
    return schema.execute(input)
  },
  normalize(result) {
    return 'value' in result
      ? { success: true, output: result.value }
      : { success: false }
  },
}
