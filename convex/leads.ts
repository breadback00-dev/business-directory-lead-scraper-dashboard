import { v } from 'convex/values'
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
  dedupKey: v.string(),
})

const now = () => Date.now()

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('leads').collect()
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
    const seenInBatch = new Set<string>()

    for (const lead of args.leads) {
      if (seenInBatch.has(lead.dedupKey)) {
        duplicatesSkipped += 1
        continue
      }
      seenInBatch.add(lead.dedupKey)

      const existing = await ctx.db
        .query('leads')
        .withIndex('by_dedupKey', (q) => q.eq('dedupKey', lead.dedupKey))
        .first()

      if (existing) {
        duplicatesSkipped += 1
        continue
      }

      await ctx.db.insert('leads', {
        ...lead,
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
      invalidRowsSkipped: Math.max(0, args.rowsReceived - args.leads.length),
      status: 'completed',
      createdAt,
    })

    return { leadsCreated, duplicatesSkipped }
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
      await ctx.db.insert('leads', {
        ...lead,
        sourceType: 'demo',
        createdAt,
        updatedAt: createdAt,
      })
    }

    return { leadsCreated: args.leads.length }
  },
})
