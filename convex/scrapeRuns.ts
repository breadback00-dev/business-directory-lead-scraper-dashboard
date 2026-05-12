import { type Infer, v } from 'convex/values'
import { mutation, query } from './_generated/server'

const leadStatus = v.union(
  v.literal('New'),
  v.literal('Contacted'),
  v.literal('Qualified'),
  v.literal('Rejected'),
)

const scrapedLeadInput = v.object({
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
  status: v.optional(leadStatus),
  leadSourceId: v.optional(v.id('leadSources')),
})

const scrapeRunProgress = v.object({
  pagesChecked: v.optional(v.number()),
  leadsFound: v.optional(v.number()),
  leadsSaved: v.optional(v.number()),
  duplicatesSkipped: v.optional(v.number()),
  failures: v.optional(v.number()),
  summary: v.optional(v.string()),
})

type ScrapeRunProgress = Infer<typeof scrapeRunProgress>
type ScrapedLeadInput = Infer<typeof scrapedLeadInput>

const now = () => Date.now()
const normalizeDedupValue = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim()
const buildDedupKey = (lead: { businessName: string; city: string; email: string; phone: string }) =>
  [
    normalizeDedupValue(lead.businessName),
    normalizeDedupValue(lead.city),
    normalizeDedupValue(lead.email),
    normalizeDedupValue(lead.phone),
  ].join('|')

const normalizeScrapedLead = (lead: ScrapedLeadInput) => {
  const businessName = lead.businessName.trim()
  if (!businessName) return null

  const normalizedLead = {
    ...lead,
    businessName,
    category: lead.category.trim() || 'Uncategorized',
    city: lead.city.trim() || 'Unknown city',
    directory: lead.directory.trim() || 'Scraper worker',
    website: lead.website.trim(),
    email: lead.email.trim(),
    phone: lead.phone.trim(),
    address: lead.address.trim(),
    sourceUrl: lead.sourceUrl.trim(),
    score: Math.max(0, Math.min(100, lead.score)),
    signals: lead.signals.map((signal) => signal.trim()).filter(Boolean),
    status: lead.status ?? 'New',
  }

  return {
    ...normalizedLead,
    dedupKey: buildDedupKey(normalizedLead),
  }
}

const mergeProgress = (progress: ScrapeRunProgress) => ({
  ...(progress.pagesChecked !== undefined ? { pagesChecked: progress.pagesChecked } : {}),
  ...(progress.leadsFound !== undefined ? { leadsFound: progress.leadsFound } : {}),
  ...(progress.leadsSaved !== undefined ? { leadsSaved: progress.leadsSaved } : {}),
  ...(progress.duplicatesSkipped !== undefined ? { duplicatesSkipped: progress.duplicatesSkipped } : {}),
  ...(progress.failures !== undefined ? { failures: progress.failures } : {}),
  ...(progress.summary !== undefined ? { summary: progress.summary } : {}),
})

export const listRecent = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('scrapeRuns').withIndex('by_createdAt').order('desc').take(5)
  },
})

export const create = mutation({
  args: {
    targetCategory: v.string(),
    targetLocation: v.string(),
    maxPages: v.optional(v.number()),
    leadSourceId: v.optional(v.id('leadSources')),
  },
  handler: async (ctx, args) => {
    const createdAt = now()

    return await ctx.db.insert('scrapeRuns', {
      status: 'queued',
      leadSourceId: args.leadSourceId,
      targetCategory: args.targetCategory.trim() || 'Uncategorized',
      targetLocation: args.targetLocation.trim() || 'Unknown location',
      maxPages: args.maxPages,
      pagesChecked: 0,
      leadsFound: 0,
      leadsSaved: 0,
      duplicatesSkipped: 0,
      failures: 0,
      logLines: ['Run queued.'],
      createdAt,
      updatedAt: createdAt,
    })
  },
})

export const markRunning = mutation({
  args: {
    scrapeRunId: v.id('scrapeRuns'),
    logLine: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.scrapeRunId)
    if (!run) throw new Error('Scrape run not found.')

    const updatedAt = now()
    await ctx.db.patch(args.scrapeRunId, {
      status: 'running',
      startedAt: run.startedAt ?? updatedAt,
      updatedAt,
      logLines: [...run.logLines, args.logLine?.trim() || 'Run started.'],
    })
  },
})

export const updateProgress = mutation({
  args: {
    scrapeRunId: v.id('scrapeRuns'),
    progress: scrapeRunProgress,
    logLine: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.scrapeRunId)
    if (!run) throw new Error('Scrape run not found.')

    const logLine = args.logLine?.trim()
    await ctx.db.patch(args.scrapeRunId, {
      ...mergeProgress(args.progress),
      ...(logLine ? { logLines: [...run.logLines, logLine] } : {}),
      updatedAt: now(),
    })
  },
})

export const attachLead = mutation({
  args: {
    scrapeRunId: v.id('scrapeRuns'),
    leadId: v.id('leads'),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.scrapeRunId)
    const lead = await ctx.db.get(args.leadId)
    if (!run) throw new Error('Scrape run not found.')
    if (!lead) throw new Error('Lead not found.')

    const updatedAt = now()
    await ctx.db.patch(args.leadId, {
      scrapeRunId: args.scrapeRunId,
      updatedAt,
    })
    await ctx.db.patch(args.scrapeRunId, {
      leadsSaved: run.leadsSaved + 1,
      updatedAt,
      logLines: [...run.logLines, `Attached lead: ${lead.businessName}.`],
    })
  },
})

export const recordLead = mutation({
  args: {
    scrapeRunId: v.id('scrapeRuns'),
    lead: scrapedLeadInput,
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.scrapeRunId)
    if (!run) throw new Error('Scrape run not found.')

    const normalizedLead = normalizeScrapedLead(args.lead)
    if (!normalizedLead) throw new Error('Business name is required.')

    const updatedAt = now()
    const existing = await ctx.db
      .query('leads')
      .withIndex('by_dedupKey', (q) => q.eq('dedupKey', normalizedLead.dedupKey))
      .first()

    if (existing) {
      await ctx.db.patch(args.scrapeRunId, {
        leadsFound: run.leadsFound + 1,
        duplicatesSkipped: run.duplicatesSkipped + 1,
        updatedAt,
        logLines: [...run.logLines, `Duplicate skipped: ${normalizedLead.businessName}.`],
      })

      return { leadId: existing._id, created: false }
    }

    const leadId = await ctx.db.insert('leads', {
      businessName: normalizedLead.businessName,
      category: normalizedLead.category,
      city: normalizedLead.city,
      directory: normalizedLead.directory,
      website: normalizedLead.website,
      email: normalizedLead.email,
      phone: normalizedLead.phone,
      address: normalizedLead.address,
      sourceUrl: normalizedLead.sourceUrl,
      score: normalizedLead.score,
      signals: normalizedLead.signals,
      status: normalizedLead.status,
      dedupKey: normalizedLead.dedupKey,
      sourceType: 'scrape',
      scrapeRunId: args.scrapeRunId,
      leadSourceId: normalizedLead.leadSourceId,
      createdAt: updatedAt,
      updatedAt,
    })

    await ctx.db.patch(args.scrapeRunId, {
      leadsFound: run.leadsFound + 1,
      leadsSaved: run.leadsSaved + 1,
      updatedAt,
      logLines: [...run.logLines, `Saved lead: ${normalizedLead.businessName}.`],
    })

    return { leadId, created: true }
  },
})

export const complete = mutation({
  args: {
    scrapeRunId: v.id('scrapeRuns'),
    progress: v.optional(scrapeRunProgress),
    summary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.scrapeRunId)
    if (!run) throw new Error('Scrape run not found.')

    const completedAt = now()
    const summary = args.summary?.trim() || args.progress?.summary || 'Run completed.'
    await ctx.db.patch(args.scrapeRunId, {
      ...(args.progress ? mergeProgress(args.progress) : {}),
      status: 'completed',
      summary,
      completedAt,
      updatedAt: completedAt,
      logLines: [...run.logLines, summary],
    })
  },
})

export const fail = mutation({
  args: {
    scrapeRunId: v.id('scrapeRuns'),
    summary: v.string(),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.scrapeRunId)
    if (!run) throw new Error('Scrape run not found.')

    const completedAt = now()
    const summary = args.summary.trim() || 'Run failed.'
    await ctx.db.patch(args.scrapeRunId, {
      status: 'failed',
      summary,
      failures: run.failures + 1,
      completedAt,
      updatedAt: completedAt,
      logLines: [...run.logLines, summary],
    })
  },
})

export const createManualCompletedRun = mutation({
  args: {},
  handler: async (ctx) => {
    const createdAt = now()
    const completedAt = createdAt + 120000

    return await ctx.db.insert('scrapeRuns', {
      status: 'completed',
      targetCategory: 'Dentists',
      targetLocation: 'Manchester',
      maxPages: 2,
      pagesChecked: 2,
      leadsFound: 8,
      leadsSaved: 5,
      duplicatesSkipped: 2,
      failures: 1,
      summary: 'Manual dry run completed for worker contract verification.',
      logLines: [
        'Run queued.',
        'Worker claimed run and checked directory pages.',
        'Saved 5 leads, skipped 2 duplicates, logged 1 failed listing.',
      ],
      startedAt: createdAt,
      completedAt,
      createdAt,
      updatedAt: completedAt,
    })
  },
})
