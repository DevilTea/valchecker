export const primitive = {
  valid: 'abc-123',
  invalidEarly: 42,
  invalidLate: 'ABC!',
}

export const flatObject = {
  valid: Object.freeze({
    id: 'user-1',
    name: 'Ada Lovelace',
    age: 37,
    active: true,
    role: 'admin',
    email: 'ada@example.com',
    score: 99.5,
    verified: true,
    nickname: 'ada',
    attempts: 3,
  }),
  invalidFirst: Object.freeze({
    id: 1,
    name: 'Ada Lovelace',
    age: 37,
    active: true,
    role: 'admin',
    email: 'ada@example.com',
    score: 99.5,
    verified: true,
    nickname: 'ada',
    attempts: 3,
  }),
  invalidLast: Object.freeze({
    id: 'user-1',
    name: 'Ada Lovelace',
    age: 37,
    active: true,
    role: 'admin',
    email: 'ada@example.com',
    score: 99.5,
    verified: true,
    nickname: 'ada',
    attempts: -1,
  }),
  extra: Object.freeze({
    id: 'user-1',
    name: 'Ada Lovelace',
    age: 37,
    active: true,
    role: 'admin',
    email: 'ada@example.com',
    score: 99.5,
    verified: true,
    nickname: 'ada',
    attempts: 3,
    unexpected: true,
  }),
}

export const nestedObject = {
  valid: Object.freeze({
    id: 'request-1',
    user: {
      profile: {
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        address: {
          city: 'London',
          country: 'GB',
          postalCode: 'SW1A1AA',
        },
      },
      permissions: ['read', 'write', 'admin'],
    },
  }),
  invalidDeep: Object.freeze({
    id: 'request-1',
    user: {
      profile: {
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        address: {
          city: 'London',
          country: 'GB',
          postalCode: 123,
        },
      },
      permissions: ['read', 'write', 'admin'],
    },
  }),
}

export function createRecords(length) {
  return Array.from({ length }, (_, index) => ({
    id: `item-${index}`,
    value: index,
    enabled: index % 2 === 0,
  }))
}

export function createInvalidRecords(length, invalidIndex) {
  const records = createRecords(length)
  records[invalidIndex] = {
    id: `item-${invalidIndex}`,
    value: 'invalid',
    enabled: true,
  }
  return records
}

export const unionInputs = {
  first: Object.freeze({ type: 'text', value: 'hello' }),
  middle: Object.freeze({ type: 'point', x: 10, y: 20 }),
  last: Object.freeze({ type: 'user', id: 'user-1', active: true }),
  invalid: Object.freeze({ type: 'unknown', value: null }),
}

export const transformInputs = {
  valid: '  Alice  ',
  invalid: 42,
  output: 'user:alice',
}

export const optionalHeavy = {
  sparse: Object.freeze({ id: 'config-1', enabled: true }),
  full: Object.freeze({
    id: 'config-1',
    enabled: true,
    name: 'production',
    region: 'eu-west',
    retries: 3,
    timeout: 5000,
    endpoint: 'https://example.com',
    cache: true,
    debug: false,
    owner: 'platform',
    team: 'runtime',
    description: 'Production config',
    priority: 2,
    batchSize: 100,
    parallelism: 4,
    tag: 'stable',
  }),
  invalid: Object.freeze({ id: 'config-1', enabled: true, retries: 'three' }),
}
