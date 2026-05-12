import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

const leadStatus = v.union(
  v.literal('New'),
  v.literal('Contacted'),
  v.literal('Qualified'),
  v.literal('Rejected'),
)

const scrapeRunStatus = v.union(
  v.literal('queued'),
  v.literal('running'),
  v.literal('completed'),
  v.literal('failed'),
)

export default defineSchema({
  leads: defineTable({
    businessName: v.string(),
    category: v.string(),
    city: v.string(),
    directory: v.string(),
    website: v.string(),
    email: v.string(),
    phone: v.string(),
    address: v.string(),
    sourceUrl: v.string(),
    score: v.number(),
    signals: v.array(v.string()),
    status: leadStatus,
    dedupKey: v.string(),
    sourceType: v.union(v.literal('demo'), v.literal('import'), v.literal('scrape')),
    importId: v.optional(v.id('imports')),
    scrapeRunId: v.optional(v.id('scrapeRuns')),
    leadSourceId: v.optional(v.id('leadSources')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_dedupKey', ['dedupKey'])
    .index('by_status', ['status'])
    .index('by_category', ['category'])
    .index('by_city', ['city'])
    .index('by_sourceType', ['sourceType']),

  imports: defineTable({
    fileName: v.string(),
    rowsReceived: v.number(),
    leadsCreated: v.number(),
    duplicatesSkipped: v.number(),
    invalidRowsSkipped: v.number(),
    status: v.union(v.literal('completed'), v.literal('failed')),
    message: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_createdAt', ['createdAt'])
    .index('by_status', ['status']),

  scrapeRuns: defineTable({
    status: scrapeRunStatus,
    leadSourceId: v.optional(v.id('leadSources')),
    targetCategory: v.string(),
    targetLocation: v.string(),
    maxPages: v.optional(v.number()),
    pagesChecked: v.number(),
    leadsFound: v.number(),
    leadsSaved: v.number(),
    duplicatesSkipped: v.number(),
    failures: v.number(),
    summary: v.optional(v.string()),
    logLines: v.array(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_status', ['status'])
    .index('by_createdAt', ['createdAt'])
    .index('by_leadSourceId', ['leadSourceId']),

  leadSources: defineTable({
    name: v.string(),
    type: v.union(v.literal('directory'), v.literal('website'), v.literal('csv')),
    baseUrl: v.string(),
    termsUrl: v.optional(v.string()),
    notes: v.optional(v.string()),
    enabled: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_enabled', ['enabled'])
    .index('by_type', ['type']),
})
