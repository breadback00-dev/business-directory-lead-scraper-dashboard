import { type Infer, v } from 'convex/values'
import { mutation, query } from './_generated/server'

const leadStatus = v.union(
  v.literal('New'),
  v.literal('Contacted'),
  v.literal('Qualified'),
  v.literal('Rejected'),
)

const leadInput = v.object({
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
})

const now = () => Date.now()
const normalizeDedupValue = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim()
const buildDedupKey = (lead: { businessName: string; city: string; email: string; phone: string }) =>
  [
    normalizeDedupValue(lead.businessName),
    normalizeDedupValue(lead.city),
    normalizeDedupValue(lead.email),
    normalizeDedupValue(lead.phone),
  ].join('|')

type LeadInput = Infer<typeof leadInput>

const normalizeLead = (lead: LeadInput) => {
  const businessName = lead.businessName.trim()
  if (!businessName) return null

  const normalizedLead = {
    ...lead,
    businessName,
    category: lead.category.trim() || 'Uncategorized',
    city: lead.city.trim() || 'Unknown city',
    directory: lead.directory.trim() || 'CSV import',
    website: lead.website.trim(),
    email: lead.email.trim(),
    phone: lead.phone.trim(),
    address: lead.address.trim(),
    sourceUrl: lead.sourceUrl.trim(),
    score: Math.max(0, Math.min(100, lead.score)),
    signals: lead.signals.map((signal) => signal.trim()).filter(Boolean),
  }

  return {
    ...normalizedLead,
    dedupKey: buildDedupKey(normalizedLead),
  }
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('leads').collect()
  },
})

export const listImports = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('imports').withIndex('by_createdAt').order('desc').take(5)
  },
})

export const importMany = mutation({
  args: {
    fileName: v.string(),
    rowsReceived: v.number(),
    leads: v.array(leadInput),
  },
  handler: async (ctx, args) => {
    const createdAt = now()
    let leadsCreated = 0
    let duplicatesSkipped = 0
    let invalidRowsSkipped = Math.max(0, args.rowsReceived - args.leads.length)
    const seenInBatch = new Set<string>()

    for (const lead of args.leads) {
      const normalizedLead = normalizeLead(lead)
      if (!normalizedLead) {
        invalidRowsSkipped += 1
        continue
      }

      if (seenInBatch.has(normalizedLead.dedupKey)) {
        duplicatesSkipped += 1
        continue
      }
      seenInBatch.add(normalizedLead.dedupKey)

      const existing = await ctx.db
        .query('leads')
        .withIndex('by_dedupKey', (q) => q.eq('dedupKey', normalizedLead.dedupKey))
        .first()

      if (existing) {
        duplicatesSkipped += 1
        continue
      }

      await ctx.db.insert('leads', {
        ...normalizedLead,
        sourceType: 'import',
        createdAt,
        updatedAt: createdAt,
      })
      leadsCreated += 1
    }

    await ctx.db.insert('imports', {
      fileName: args.fileName,
      rowsReceived: args.rowsReceived,
      leadsCreated,
      duplicatesSkipped,
      invalidRowsSkipped,
      status: 'completed',
      createdAt,
    })

    return { leadsCreated, duplicatesSkipped, invalidRowsSkipped }
  },
})

export const updateStatus = mutation({
  args: {
    leadId: v.id('leads'),
    status: leadStatus,
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.leadId, {
      status: args.status,
      updatedAt: now(),
    })
  },
})

export const replaceWithDemoData = mutation({
  args: {
    leads: v.array(leadInput),
  },
  handler: async (ctx, args) => {
    const currentLeads = await ctx.db.query('leads').collect()
    for (const lead of currentLeads) {
      await ctx.db.delete(lead._id)
    }

    const createdAt = now()
    for (const lead of args.leads) {
      const normalizedLead = normalizeLead(lead)
      if (!normalizedLead) continue

      await ctx.db.insert('leads', {
        ...normalizedLead,
        sourceType: 'demo',
        createdAt,
        updatedAt: createdAt,
      })
    }

    return { leadsCreated: args.leads.length }
  },
})
