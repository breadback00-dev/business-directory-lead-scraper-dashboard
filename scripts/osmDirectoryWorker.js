import { ConvexHttpClient } from 'convex/browser'
import { api } from '../convex/_generated/api.js'

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter'
const SOURCE_NAME = 'OpenStreetMap Overpass API'
const SOURCE_RULES_URL = 'https://wiki.openstreetmap.org/wiki/Overpass_API'
const OSM_COPYRIGHT_URL = 'https://www.openstreetmap.org/copyright'
const DEFAULT_USER_AGENT = 'business-directory-lead-scraper-dashboard/1.0'
const REQUEST_DELAY_MS = 1500
const RETRY_DELAY_MS = 3000
const MAX_RETRIES = 2
const MAX_RESULTS_CAP = 50

const categoryFilters = {
  accountant: { key: 'office', value: 'accountant', label: 'Accountants' },
  accountants: { key: 'office', value: 'accountant', label: 'Accountants' },
  cafe: { key: 'amenity', value: 'cafe', label: 'Cafes' },
  cafes: { key: 'amenity', value: 'cafe', label: 'Cafes' },
  dentist: { key: 'amenity', value: 'dentist', label: 'Dentists' },
  dentists: { key: 'amenity', value: 'dentist', label: 'Dentists' },
  pharmacy: { key: 'amenity', value: 'pharmacy', label: 'Pharmacies' },
  pharmacies: { key: 'amenity', value: 'pharmacy', label: 'Pharmacies' },
  restaurant: { key: 'amenity', value: 'restaurant', label: 'Restaurants' },
  restaurants: { key: 'amenity', value: 'restaurant', label: 'Restaurants' },
  solicitor: { key: 'office', value: 'lawyer', label: 'Solicitors' },
  solicitors: { key: 'office', value: 'lawyer', label: 'Solicitors' },
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const isOption = (value) => value.startsWith('--')
const asCleanText = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()

const parseArgs = (argv) => {
  const options = {
    category: '',
    location: '',
    countryCode: 'GB',
    maxResults: 10,
    write: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]
    const takeValue = () => {
      if (!next || isOption(next)) throw new Error(`Missing value for ${arg}.`)
      index += 1
      return next
    }

    if (arg === '--category') options.category = takeValue()
    else if (arg === '--location') options.location = takeValue()
    else if (arg === '--country-code') options.countryCode = takeValue()
    else if (arg === '--max-results') options.maxResults = Number(takeValue())
    else if (arg === '--write') options.write = true
    else if (arg === '--dry-run') options.write = false
    else if (arg === '--help' || arg === '-h') options.help = true
    else throw new Error(`Unknown option: ${arg}`)
  }

  return options
}

const printHelp = () => {
  console.log(`
Usage:
  npm run scrape:osm -- --category "dentists" --location "Manchester" --max-results 10 --dry-run
  npm run scrape:osm -- --category "dentists" --location "Manchester" --max-results 10 --write

Options:
  --category      Supported values: ${Object.keys(categoryFilters).join(', ')}
  --location      City or local authority area name to query in OpenStreetMap
  --country-code  ISO 3166-1 alpha-2 country code for disambiguation (default: GB)
  --max-results   Maximum records to request, capped at ${MAX_RESULTS_CAP}
  --dry-run       Log extracted records without writing to Convex (default)
  --write         Create a Convex scrape run and save deduplicated leads
`)
}

const validateOptions = (options) => {
  if (options.help) return

  options.category = asCleanText(options.category).toLowerCase()
  options.location = asCleanText(options.location)
  options.countryCode = asCleanText(options.countryCode).toUpperCase()
  options.maxResults = Math.min(MAX_RESULTS_CAP, Math.max(1, Math.floor(options.maxResults || 0)))

  if (!options.category) throw new Error('Provide --category.')
  if (!categoryFilters[options.category]) {
    throw new Error(`Unsupported category "${options.category}". Run with --help for supported values.`)
  }
  if (!options.location) throw new Error('Provide --location.')
  if (!/^[A-Z]{2}$/.test(options.countryCode)) throw new Error('Provide --country-code as an ISO alpha-2 code, such as GB.')
}

const buildOverpassQuery = ({ category, location, countryCode, maxResults }) => {
  const filter = categoryFilters[category]
  const escapedLocation = location.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  const escapedCountryCode = countryCode.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

  return `
[out:json][timeout:25];
area["ISO3166-1"="${escapedCountryCode}"]["admin_level"="2"]->.country;
relation["name"="${escapedLocation}"]["boundary"="administrative"](area.country);
map_to_area->.searchArea;
(
  node["${filter.key}"="${filter.value}"](area.searchArea);
  way["${filter.key}"="${filter.value}"](area.searchArea);
  relation["${filter.key}"="${filter.value}"](area.searchArea);
);
out center tags ${maxResults};
`
}

const fetchOverpass = async (query, attempt = 0) => {
  const response = await fetch(OVERPASS_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'user-agent': process.env.OSM_WORKER_USER_AGENT || DEFAULT_USER_AGENT,
    },
    body: new URLSearchParams({ data: query }),
  })

  if (response.ok) return await response.json()

  const body = await response.text()
  if (attempt < MAX_RETRIES && [408, 429, 500, 502, 503, 504].includes(response.status)) {
    await wait(RETRY_DELAY_MS * (attempt + 1))
    return await fetchOverpass(query, attempt + 1)
  }

  throw new Error(`Overpass request failed with ${response.status}: ${body.slice(0, 240)}`)
}

const getTag = (tags, ...keys) => {
  for (const key of keys) {
    const value = asCleanText(tags[key])
    if (value) return value
  }
  return ''
}

const formatAddress = (tags) => {
  const streetLine = [getTag(tags, 'addr:housenumber'), getTag(tags, 'addr:street')].filter(Boolean).join(' ')
  return [
    streetLine,
    getTag(tags, 'addr:suburb'),
    getTag(tags, 'addr:city', 'addr:town', 'addr:village'),
    getTag(tags, 'addr:postcode'),
  ]
    .filter(Boolean)
    .join(', ')
}

const scoreLead = (lead) => {
  let score = 35
  if (lead.phone) score += 20
  if (lead.website) score += 20
  if (lead.address) score += 15
  if (lead.sourceUrl) score += 10
  return Math.min(100, score)
}

const mapElementToLead = (element, options) => {
  const tags = element.tags ?? {}
  const businessName = getTag(tags, 'name', 'operator', 'brand')
  if (!businessName) return null

  const filter = categoryFilters[options.category]
  const sourceUrl = `https://www.openstreetmap.org/${element.type}/${element.id}`
  const lead = {
    businessName,
    category: getTag(tags, filter.key) || filter.label,
    city: getTag(tags, 'addr:city', 'addr:town', 'addr:village') || options.location,
    directory: SOURCE_NAME,
    website: getTag(tags, 'website', 'contact:website', 'url'),
    email: getTag(tags, 'email', 'contact:email'),
    phone: getTag(tags, 'phone', 'contact:phone'),
    address: formatAddress(tags),
    sourceUrl,
    score: 0,
    signals: [`Source: ${SOURCE_NAME}`, `OSM ${element.type}/${element.id}`],
    status: 'New',
  }
  lead.score = scoreLead(lead)

  if (lead.website) lead.signals.push('Website listed')
  if (lead.phone) lead.signals.push('Phone listed')
  if (lead.address) lead.signals.push('Address listed')
  if (!lead.website && !lead.phone) lead.signals.push('Needs contact enrichment')

  return lead
}

const collectLeads = async (options) => {
  await wait(REQUEST_DELAY_MS)
  const query = buildOverpassQuery(options)
  const data = await fetchOverpass(query)
  const elements = Array.isArray(data.elements) ? data.elements : []
  const leads = elements.map((element) => mapElementToLead(element, options)).filter(Boolean)

  return {
    osmTimestamp: data.osm3s?.timestamp_osm_base,
    leads,
  }
}

const writeToConvex = async (options, leads) => {
  const convexUrl = process.env.CONVEX_URL || process.env.VITE_CONVEX_URL
  if (!convexUrl) throw new Error('Set CONVEX_URL or VITE_CONVEX_URL before running with --write.')

  const client = new ConvexHttpClient(convexUrl)
  const runId = await client.mutation(api.scrapeRuns.create, {
    targetCategory: categoryFilters[options.category].label,
    targetLocation: `${options.location}, ${options.countryCode}`,
    maxPages: 1,
  })

  await client.mutation(api.scrapeRuns.markRunning, {
    scrapeRunId: runId,
    logLine: `Worker querying ${SOURCE_NAME}.`,
  })

  let created = 0
  let duplicates = 0

  for (const lead of leads) {
    const result = await client.mutation(api.scrapeRuns.recordLead, {
      scrapeRunId: runId,
      lead,
    })
    if (result.created) created += 1
    else duplicates += 1
  }

  await client.mutation(api.scrapeRuns.complete, {
    scrapeRunId: runId,
    progress: {
      pagesChecked: 1,
      leadsFound: leads.length,
      leadsSaved: created,
      duplicatesSkipped: duplicates,
      failures: 0,
    },
    summary: `Completed ${SOURCE_NAME} run: ${created} saved, ${duplicates} duplicate(s) skipped.`,
  })

  return { runId, created, duplicates }
}

const main = async () => {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }
  validateOptions(options)

  console.log(`Source: ${SOURCE_NAME}`)
  console.log(`Rules: ${SOURCE_RULES_URL}`)
  console.log(`License: OSM data is ODbL; attribution required (${OSM_COPYRIGHT_URL})`)
  console.log(`Mode: ${options.write ? 'write to Convex' : 'dry run'}`)
  console.log(`Target: ${categoryFilters[options.category].label} in ${options.location}, ${options.countryCode}`)

  const { osmTimestamp, leads } = await collectLeads(options)
  console.log(`OSM data timestamp: ${osmTimestamp || 'not provided'}`)
  console.log(`Extracted records: ${leads.length}`)

  for (const lead of leads) {
    console.log(JSON.stringify(lead))
  }

  if (!options.write) {
    console.log('Dry run complete. No Convex records were written.')
    return
  }

  const result = await writeToConvex(options, leads)
  console.log(`Convex scrape run ${result.runId} completed: ${result.created} saved, ${result.duplicates} duplicate(s).`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
