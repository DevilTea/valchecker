import * as z from 'zod4'
import { createZodAdapter } from './zod-factory.mjs'

z.config({ jitless: true })

export default createZodAdapter(z, 'Zod 4 (jitless)', '4.4.3')
