import * as z from 'zod4'
import { createZodAdapter } from './zod-factory.mjs'

export default createZodAdapter(z, { adapter: 'zod4', name: 'Zod 4', specifier: 'zod4' })
