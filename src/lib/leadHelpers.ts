import type { Doc } from '../../convex/_generated/dataModel'
import { statuses, type Lead, type LeadInput, type LeadStatus } from '../types'

export const normalizeKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')

export const csvEscape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`

export const uniqueOptions = (items: string[]) => Array.from(new Set(items.filter(Boolean))).sort()

export const getRecordValue = (record: Record<string, unknown>, aliases: string[]) => {
  const normalizedRecord = Object.fromEntries(
    Object.entries(record).map(([key, value]) => [normalizeKey(key), String(value ?? '').trim()]),
  )

  for (const alias of aliases) {
    const value = normalizedRecord[normalizeKey(alias)]
    if (value) return value
  }

  return ''
}

export const parseSignals = (value: string) =>
  value
    .split(/[;|]/)
    .map((signal) => signal.trim())
    .filter(Boolean)

export const normalizeStatus = (value: string): LeadStatus =>
  statuses.find((status) => status.toLowerCase() === value.trim().toLowerCase()) ?? 'New'

export const generateId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `lead-${Date.now()}-${Math.random().toString(16).slice(2)}`

type ScorableLead = Omit<Lead, 'id' | 'score' | 'status'>

export const calculateScore = (lead: ScorableLead) => {
  const score =
    45 +
    (lead.email ? 18 : 0) +
    (lead.phone ? 10 : 0) +
    (lead.website ? 12 : 0) +
    (lead.sourceUrl ? 5 : 0) +
    Math.min(10, lead.signals.length * 3)

  return Math.min(100, score)
}

export const buildLeadFromRecord = (
  record: Record<string, unknown>,
  createId: () => string = generateId,
): Lead | null => {
  const businessName = getRecordValue(record, ['Business Name', 'Company', 'Name'])
  if (!businessName) return null

  const baseLead = {
    businessName,
    category: getRecordValue(record, ['Category', 'Industry', 'Business Type']) || 'Uncategorized',
    city: getRecordValue(record, ['City', 'Location', 'Town', 'Market']) || 'Unknown city',
    directory: getRecordValue(record, ['Directory', 'Source', 'Lead Source']) || 'CSV import',
    website: getRecordValue(record, ['Website', 'Domain', 'URL']),
    email: getRecordValue(record, ['Email', 'Email Address']),
    phone: getRecordValue(record, ['Phone', 'Phone Number', 'Telephone']),
    address: getRecordValue(record, ['Address', 'Street Address']),
    sourceUrl: getRecordValue(record, ['Source URL', 'Directory URL', 'Listing URL']),
    signals: parseSignals(getRecordValue(record, ['Signals', 'Tags', 'Notes'])),
  }
  const scoreInput = getRecordValue(record, ['Score', 'Lead Score'])
  const scoreValue = Number(scoreInput)
  const score =
    scoreInput && Number.isFinite(scoreValue)
      ? Math.max(0, Math.min(100, scoreValue))
      : calculateScore(baseLead)

  return {
    ...baseLead,
    id: createId(),
    score,
    status: normalizeStatus(getRecordValue(record, ['Status', 'Lead Status'])),
  }
}

export const toLeadInput = (lead: Lead): LeadInput => {
  return {
    businessName: lead.businessName,
    category: lead.category,
    city: lead.city,
    directory: lead.directory,
    website: lead.website,
    email: lead.email,
    phone: lead.phone,
    address: lead.address,
    sourceUrl: lead.sourceUrl,
    score: lead.score,
    signals: lead.signals,
    status: lead.status,
  }
}

export const toClientLead = (lead: Doc<'leads'>): Lead => ({
  id: lead._id,
  businessName: lead.businessName,
  category: lead.category,
  city: lead.city,
  directory: lead.directory,
  website: lead.website,
  email: lead.email,
  phone: lead.phone,
  address: lead.address,
  sourceUrl: lead.sourceUrl,
  score: lead.score,
  signals: lead.signals,
  status: lead.status,
})

export const scoreLabel = (score: number) => {
  if (score >= 85) return 'Hot'
  if (score >= 72) return 'Warm'
  return 'Nurture'
}
