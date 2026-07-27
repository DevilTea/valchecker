import * as z from 'zod3'
import { createZodAdapter } from './zod-factory.mjs'

export default createZodAdapter(z, { adapter: 'zod3', name: 'Zod 3', specifier: 'zod3' })
