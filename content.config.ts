import { defineContentConfig, defineCollection } from '@nuxt/content'
import { z } from 'zod'

const docsSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
  badge: z.string().optional(),
  draft: z.boolean().default(false)
})

export default defineContentConfig({
  collections: {
    docs_en: defineCollection({
      type: 'page',
      source: 'docs/en/**/*.md',
      schema: docsSchema
    }),
    docs_hr: defineCollection({
      type: 'page',
      source: 'docs/hr/**/*.md',
      schema: docsSchema
    })
  }
})
