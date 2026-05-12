import { ConvexHttpClient } from 'convex/browser'
import { existsSync, readFileSync } from 'node:fs'
import { api } from '../convex/_generated/api.js'

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 50
const REQUEST_TIMEOUT_MS = 10000
const REQUEST_DELAY_MS = 1000
const RETRY_DELAY_MS = 2000
const MAX_RETRIES = 1
const DEFAULT_USER_AGENT = 'business-directory-lead-scraper-dashboard/1.0'

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const isOption = (value) => value.startsWith('--')
const asCleanText = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()

const loadLocalEnv = () => {
  if (process.env.CONVEX_URL || process.env.VITE_CONVEX_URL || !existsSync('.env.local')) return

  const lines = readFileSync('.env.local', 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const match = line.match(/^\s*(VITE_CONVEX_URL|CONVEX_URL)\s*=\s*(.+?)\s*$/)
    if (!match) continue
    process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
  }
}

const parseArgs = (argv) => {
  const options = {
    dryRun: true,
    limit: DEFAULT_LIMIT,
    url: '',
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]
    const takeValue = () => {
      if (!next || isOption(next)) throw new Error(`Missing value for ${arg}.`)
      index += 1
      return next
    }

    if (arg === '--limit') options.limit = Number(takeValue())
    else if (arg === '--url') options.url = takeValue()
    else if (arg === '--write') options.dryRun = false
    else if (arg === '--dry-run') options.dryRun = true
    else if (arg === '--help' || arg === '-h') options.help = true
    else throw new Error(`Unknown option: ${arg}`)
  }

  return options
}

const printHelp = () => {
  console.log(`
Usage:
  npm run enrich:homepage -- --url "https://example.com" --dry-run
  CONVEX_URL="https://your-deployment.convex.cloud" npm run enrich:homepage -- --limit 10 --write

Options:
  --url       Fetch and inspect one homepage without reading Convex
  --limit     Maximum Convex leads to inspect, capped at ${MAX_LIMIT}
  --dry-run   Log enrichment output without writing to Convex (default)
  --write     Read website leads from Convex and update email, score, and signals
`)
}

const validateOptions = (options) => {
  if (options.help) return
  options.url = asCleanText(options.url)
  options.limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(options.limit || DEFAULT_LIMIT)))
}

const normalizeUrl = (value) => {
  const trimmed = asCleanText(value)
  if (!trimmed) return ''
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

  try {
    return new URL(withProtocol).toString()
  } catch {
    return ''
  }
}

const fetchHomepage = async (url, attempt = 0) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      headers: {
        'user-agent': process.env.ENRICHMENT_USER_AGENT || DEFAULT_USER_AGENT,
        accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: controller.signal,
    })

    if (!response.ok) {
      if (attempt < MAX_RETRIES && [408, 429, 500, 502, 503, 504].includes(response.status)) {
        await wait(RETRY_DELAY_MS)
        return await fetchHomepage(url, attempt + 1)
      }
      throw new Error(`Homepage returned ${response.status}`)
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      throw new Error(`Homepage returned non-HTML content: ${contentType || 'unknown'}`)
    }

    return {
      finalUrl: response.url,
      html: await response.text(),
    }
  } finally {
    clearTimeout(timeout)
  }
}

const decodeHtml = (value) =>
  value
    .replaceAll('&amp;', '&')
    .replaceAll('&#64;', '@')
    .replaceAll('%40', '@')
    .replaceAll('[at]', '@')
    .replaceAll('(at)', '@')

const extractEmails = (html) => {
  const normalized = decodeHtml(html)
  const matches = normalized.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []

  return Array.from(
    new Set(
      matches
        .map((email) => email.toLowerCase())
        .filter((email) => !email.endsWith('.png') && !email.endsWith('.jpg') && !email.endsWith('.webp')),
    ),
  ).slice(0, 5)
}

const extractLinks = (html, baseUrl) => {
  const links = []
  const linkPattern = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi
  let match = linkPattern.exec(html)

  while (match) {
    try {
      const url = new URL(decodeHtml(match[1]), baseUrl)
      if (['http:', 'https:', 'mailto:'].includes(url.protocol)) links.push(url.toString())
    } catch {
      // Ignore malformed links from real-world pages.
    }
    match = linkPattern.exec(html)
  }

  return Array.from(new Set(links))
}

const detectSocialLinks = (links) =>
  links.filter((link) =>
    /(?:linkedin\.com|facebook\.com|instagram\.com|x\.com|twitter\.com|youtube\.com|tiktok\.com)/i.test(link),
  )

const detectContactLinks = (links) =>
  links.filter((link) => /(?:contact|enquiry|enquiries|get-in-touch|appointments?)/i.test(link)).slice(0, 5)

const detectBookingSignal = (html, links) => {
  const haystack = [html, ...links].join(' ').toLowerCase()
  return /(?:book now|online booking|appointment|calendly|acuityscheduling|cliniko|phorest|treatwell|opentable|resdiary)/i.test(
    haystack,
  )
}

const buildSignals = ({ emails, socialLinks, contactLinks, hasBookingSignal }) => {
  const signals = ['Homepage checked']
  if (emails.length > 0) signals.push('Email found on website')
  if (contactLinks.length > 0) signals.push('Contact page found')
  if (socialLinks.length > 0) signals.push('Social links found')
  if (hasBookingSignal) signals.push('Booking/contact form signal')
  if (emails.length === 0 && contactLinks.length === 0) signals.push('Needs manual contact enrichment')
  return signals
}

const scoreDeltaFor = ({ emails, socialLinks, contactLinks, hasBookingSignal }) =>
  Math.min(
    40,
    (emails.length > 0 ? 18 : 0) +
      (contactLinks.length > 0 ? 8 : 0) +
      (socialLinks.length > 0 ? 6 : 0) +
      (hasBookingSignal ? 8 : 0),
  )

const inspectHomepage = async (website) => {
  const url = normalizeUrl(website)
  if (!url) throw new Error(`Invalid website URL: ${website}`)

  await wait(REQUEST_DELAY_MS)
  const { finalUrl, html } = await fetchHomepage(url)
  const links = extractLinks(html, finalUrl)
  const emails = extractEmails(html)
  const socialLinks = detectSocialLinks(links)
  const contactLinks = detectContactLinks(links)
  const hasBookingSignal = detectBookingSignal(html, links)
  const enrichment = {
    website: finalUrl,
    email: emails[0] ?? '',
    emails,
    contactLinks,
    socialLinks,
    hasBookingSignal,
  }

  return {
    ...enrichment,
    signals: buildSignals(enrichment),
    scoreDelta: scoreDeltaFor(enrichment),
  }
}

const getConvexClient = () => {
  const convexUrl = process.env.CONVEX_URL || process.env.VITE_CONVEX_URL
  if (!convexUrl) throw new Error('Set CONVEX_URL or VITE_CONVEX_URL before reading or writing Convex leads.')
  return new ConvexHttpClient(convexUrl)
}

const enrichOne = async ({ lead, dryRun, client }) => {
  try {
    const enrichment = await inspectHomepage(lead.website)
    const payload = {
      leadId: lead._id,
      email: enrichment.email,
      signals: enrichment.signals,
      scoreDelta: enrichment.scoreDelta,
      logLine: `Homepage enrichment checked ${enrichment.website}.`,
    }

    console.log(
      JSON.stringify({
        businessName: lead.businessName,
        website: lead.website,
        email: enrichment.email,
        scoreDelta: enrichment.scoreDelta,
        signals: enrichment.signals,
        contactLinks: enrichment.contactLinks,
        socialLinks: enrichment.socialLinks,
        write: !dryRun,
      }),
    )

    if (!dryRun) await client.mutation(api.leads.applyHomepageEnrichment, payload)

    return { enriched: 1, failed: 0 }
  } catch (error) {
    console.error(
      JSON.stringify({
        businessName: lead.businessName,
        website: lead.website,
        error: error instanceof Error ? error.message : String(error),
      }),
    )
    return { enriched: 0, failed: 1 }
  }
}

const main = async () => {
  loadLocalEnv()
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }
  validateOptions(options)

  if (options.url) {
    const enrichment = await inspectHomepage(options.url)
    console.log(JSON.stringify(enrichment, null, 2))
    console.log('Dry run complete. No Convex records were written.')
    return
  }

  const client = getConvexClient()
  const leads = await client.query(api.leads.listForEnrichment, { limit: options.limit })
  console.log(`Mode: ${options.dryRun ? 'dry run' : 'write to Convex'}`)
  console.log(`Leads with websites selected: ${leads.length}`)

  let enriched = 0
  let failed = 0
  for (const lead of leads) {
    const result = await enrichOne({ lead, dryRun: options.dryRun, client })
    enriched += result.enriched
    failed += result.failed
  }

  console.log(`Homepage enrichment complete: ${enriched} enriched, ${failed} failed.`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
