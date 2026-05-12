import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import Papa from 'papaparse'
import { z } from 'zod'
import { useMutation, useQuery } from 'convex/react'
import {
  ArrowDownToLine,
  Building2,
  CheckCircle2,
  Filter,
  Globe2,
  History,
  Mail,
  MapPin,
  Phone,
  RotateCcw,
  Search,
  UploadCloud,
} from 'lucide-react'
import { api } from '../convex/_generated/api'
import type { Doc, Id } from '../convex/_generated/dataModel'
import './App.css'

const statuses = ['New', 'Contacted', 'Qualified', 'Rejected'] as const
type LeadStatus = (typeof statuses)[number]

type Lead = {
  id: string
  businessName: string
  category: string
  city: string
  directory: string
  website: string
  email: string
  phone: string
  address: string
  sourceUrl: string
  score: number
  signals: string[]
  status: LeadStatus
}

const rowSchema = z.record(z.string(), z.unknown())
type LeadInput = Omit<Lead, 'id'>

const demoLeads: Lead[] = [
  {
    id: 'demo-1',
    businessName: 'Northline Dental Studio',
    category: 'Dentists',
    city: 'Manchester',
    directory: 'Local Health Index',
    website: 'northlinedental.example',
    email: 'hello@northlinedental.example',
    phone: '+44 161 555 0134',
    address: '18 Deansgate, Manchester',
    sourceUrl: 'https://directory.example/northline-dental',
    score: 92,
    signals: ['Email found', 'Booking link', 'Outdated website'],
    status: 'New',
  },
  {
    id: 'demo-2',
    businessName: 'Summit Roof Care',
    category: 'Roofing',
    city: 'Austin',
    directory: 'Trade Directory',
    website: 'summitroofcare.example',
    email: 'jobs@summitroofcare.example',
    phone: '+1 512 555 0148',
    address: '2408 E 7th St, Austin',
    sourceUrl: 'https://directory.example/summit-roof-care',
    score: 86,
    signals: ['High-value category', 'Phone verified', 'No CRM widget'],
    status: 'Qualified',
  },
  {
    id: 'demo-3',
    businessName: 'Cedar & Co Accountants',
    category: 'Accounting',
    city: 'London',
    directory: 'Chamber Listings',
    website: 'cedaraccountants.example',
    email: 'team@cedaraccountants.example',
    phone: '+44 20 5555 0173',
    address: '42 Fleet Street, London',
    sourceUrl: 'https://directory.example/cedar-co-accountants',
    score: 78,
    signals: ['LinkedIn found', 'Contact form', 'Multi-office'],
    status: 'Contacted',
  },
  {
    id: 'demo-4',
    businessName: 'Bluebird Family Clinic',
    category: 'Healthcare',
    city: 'Birmingham',
    directory: 'Care Finder',
    website: 'bluebirdclinic.example',
    email: 'reception@bluebirdclinic.example',
    phone: '+44 121 555 0182',
    address: '9 Cornwall Street, Birmingham',
    sourceUrl: 'https://directory.example/bluebird-family-clinic',
    score: 73,
    signals: ['Email found', 'Reviews rising', 'Needs social links'],
    status: 'New',
  },
  {
    id: 'demo-5',
    businessName: 'Harbor View Legal',
    category: 'Legal',
    city: 'Liverpool',
    directory: 'Professional Register',
    website: 'harborviewlegal.example',
    email: 'intake@harborviewlegal.example',
    phone: '+44 151 555 0116',
    address: '31 Water Street, Liverpool',
    sourceUrl: 'https://directory.example/harbor-view-legal',
    score: 69,
    signals: ['Contact form', 'Local intent', 'No live chat'],
    status: 'Rejected',
  },
  {
    id: 'demo-6',
    businessName: 'Oak & Pixel Web Studio',
    category: 'Marketing',
    city: 'Leeds',
    directory: 'Agency Map',
    website: 'oakpixel.example',
    email: 'studio@oakpixel.example',
    phone: '+44 113 555 0194',
    address: '7 Park Row, Leeds',
    sourceUrl: 'https://directory.example/oak-pixel-web-studio',
    score: 81,
    signals: ['Social links', 'Technology detected', 'Fast site'],
    status: 'Qualified',
  },
  {
    id: 'demo-7',
    businessName: 'BrightPath Tutoring',
    category: 'Education',
    city: 'Chicago',
    directory: 'City Business Hub',
    website: 'brightpathtutoring.example',
    email: 'learn@brightpathtutoring.example',
    phone: '+1 312 555 0169',
    address: '105 W Madison St, Chicago',
    sourceUrl: 'https://directory.example/brightpath-tutoring',
    score: 64,
    signals: ['Email found', 'Seasonal demand', 'Missing analytics'],
    status: 'New',
  },
  {
    id: 'demo-8',
    businessName: 'Pinecrest Fitness',
    category: 'Fitness',
    city: 'Denver',
    directory: 'Wellness Directory',
    website: 'pinecrestfitness.example',
    email: 'members@pinecrestfitness.example',
    phone: '+1 720 555 0177',
    address: '1401 Blake St, Denver',
    sourceUrl: 'https://directory.example/pinecrest-fitness',
    score: 71,
    signals: ['Booking link', 'Instagram found', 'No email automation'],
    status: 'Contacted',
  },
]

const normalizeKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')
const csvEscape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`

const uniqueOptions = (items: string[]) => Array.from(new Set(items.filter(Boolean))).sort()

const getRecordValue = (record: Record<string, unknown>, aliases: string[]) => {
  const normalizedRecord = Object.fromEntries(
    Object.entries(record).map(([key, value]) => [normalizeKey(key), String(value ?? '').trim()]),
  )

  for (const alias of aliases) {
    const value = normalizedRecord[normalizeKey(alias)]
    if (value) return value
  }

  return ''
}

const parseSignals = (value: string) =>
  value
    .split(/[;|]/)
    .map((signal) => signal.trim())
    .filter(Boolean)

const normalizeStatus = (value: string): LeadStatus =>
  statuses.find((status) => status.toLowerCase() === value.toLowerCase()) ?? 'New'

const generateId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `lead-${Date.now()}-${Math.random().toString(16).slice(2)}`

const calculateScore = (lead: Omit<Lead, 'id' | 'score' | 'status'>) => {
  const score =
    45 +
    (lead.email ? 18 : 0) +
    (lead.phone ? 10 : 0) +
    (lead.website ? 12 : 0) +
    (lead.sourceUrl ? 5 : 0) +
    Math.min(10, lead.signals.length * 3)

  return Math.min(100, score)
}

const buildLeadFromRecord = (record: Record<string, unknown>): Lead | null => {
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
  const scoreValue = Number(getRecordValue(record, ['Score', 'Lead Score']))
  const score = Number.isFinite(scoreValue) ? Math.max(0, Math.min(100, scoreValue)) : calculateScore(baseLead)

  return {
    ...baseLead,
    id: generateId(),
    score,
    status: normalizeStatus(getRecordValue(record, ['Status', 'Lead Status'])),
  }
}

const toLeadInput = (lead: Lead): LeadInput => {
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

const toClientLead = (lead: Doc<'leads'>): Lead => ({
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

const scoreLabel = (score: number) => {
  if (score >= 85) return 'Hot'
  if (score >= 72) return 'Warm'
  return 'Nurture'
}

function App() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const hasRequestedDemoSeed = useRef(false)
  const convexLeads = useQuery(api.leads.list)
  const importHistory = useQuery(api.leads.listImports)
  const importLeads = useMutation(api.leads.importMany)
  const updateLeadStatusMutation = useMutation(api.leads.updateStatus)
  const replaceWithDemoData = useMutation(api.leads.replaceWithDemoData)
  const [searchTerm, setSearchTerm] = useState('')
  const [category, setCategory] = useState('All categories')
  const [city, setCity] = useState('All cities')
  const [minScore, setMinScore] = useState(60)
  const [importMessage, setImportMessage] = useState<string | null>(null)

  const leadData = useMemo(() => (convexLeads ?? []).map(toClientLead), [convexLeads])
  const statusMessage =
    importMessage ??
    (convexLeads === undefined
      ? 'Loading leads from Convex...'
      : leadData.length > 0
        ? 'Leads loaded from Convex. Import a CSV to add client leads.'
        : 'Loading demo data into Convex...')

  useEffect(() => {
    if (convexLeads === undefined) return

    if (convexLeads.length > 0 || hasRequestedDemoSeed.current) return

    hasRequestedDemoSeed.current = true
    void replaceWithDemoData({ leads: demoLeads.map(toLeadInput) })
      .then(() => setImportMessage('Demo data loaded. Import a CSV to add client leads.'))
      .catch((error: Error) => {
        hasRequestedDemoSeed.current = false
        setImportMessage(`Could not load demo data: ${error.message}`)
      })
  }, [convexLeads, replaceWithDemoData])

  const categories = useMemo(
    () => ['All categories', ...uniqueOptions(leadData.map((lead) => lead.category))],
    [leadData],
  )
  const cities = useMemo(
    () => ['All cities', ...uniqueOptions(leadData.map((lead) => lead.city))],
    [leadData],
  )

  const filteredLeads = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return leadData
      .filter((lead) => {
        const matchesSearch =
          normalizedSearch.length === 0 ||
          [
            lead.businessName,
            lead.category,
            lead.city,
            lead.directory,
            lead.email,
            lead.phone,
            lead.signals.join(' '),
          ]
            .join(' ')
            .toLowerCase()
            .includes(normalizedSearch)
        const matchesCategory = category === 'All categories' || lead.category === category
        const matchesCity = city === 'All cities' || lead.city === city
        const matchesScore = lead.score >= minScore

        return matchesSearch && matchesCategory && matchesCity && matchesScore
      })
      .sort((a, b) => b.score - a.score)
  }, [category, city, leadData, minScore, searchTerm])

  const metrics = useMemo(() => {
    const visible = filteredLeads.length
    const qualified = filteredLeads.filter((lead) => lead.status === 'Qualified').length
    const averageScore =
      visible === 0
        ? 0
        : Math.round(filteredLeads.reduce((total, lead) => total + lead.score, 0) / visible)
    const emails = filteredLeads.filter((lead) => lead.email).length

    return { visible, qualified, averageScore, emails }
  }, [filteredLeads])

  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data
          .map((row) => rowSchema.safeParse(row))
          .filter((result) => result.success)
          .map((result) => result.data)
        const importedLeads = rows
          .map((row) => buildLeadFromRecord(row))
          .filter((lead): lead is Lead => Boolean(lead))

        if (importedLeads.length === 0) {
          setImportMessage(`No new leads imported from ${file.name}. Check required name/company fields.`)
          event.target.value = ''
          return
        }

        try {
          const result = await importLeads({
            fileName: file.name,
            rowsReceived: rows.length,
            leads: importedLeads.map(toLeadInput),
          })
          const prefix =
            result.leadsCreated === 0
              ? `No new leads imported from ${file.name}.`
              : `Imported ${result.leadsCreated} leads from ${file.name}.`
          setImportMessage(
            `${prefix} ${result.duplicatesSkipped} duplicates skipped, ${result.invalidRowsSkipped} invalid rows skipped.`,
          )
          setCategory('All categories')
          setCity('All cities')
        } catch (error) {
          setImportMessage(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        } finally {
          event.target.value = ''
        }
      },
      error: (error) => {
        setImportMessage(`Import failed: ${error.message}`)
        event.target.value = ''
      },
    })
  }

  const updateLeadStatus = (leadId: string, status: LeadStatus) => {
    void updateLeadStatusMutation({ leadId: leadId as Id<'leads'>, status }).catch((error: Error) => {
      setImportMessage(`Status update failed: ${error.message}`)
    })
  }

  const resetDemoData = () => {
    void replaceWithDemoData({ leads: demoLeads.map(toLeadInput) })
      .then(() => {
        setCategory('All categories')
        setCity('All cities')
        setSearchTerm('')
        setMinScore(60)
        setImportMessage('Demo data restored.')
      })
      .catch((error: Error) => {
        setImportMessage(`Demo reset failed: ${error.message}`)
      })
  }

  const exportCsv = () => {
    const headers = [
      'Business Name',
      'Category',
      'City',
      'Directory',
      'Website',
      'Email',
      'Phone',
      'Address',
      'Score',
      'Status',
      'Signals',
      'Source URL',
    ]
    const rows = filteredLeads.map((lead) => [
      lead.businessName,
      lead.category,
      lead.city,
      lead.directory,
      lead.website,
      lead.email,
      lead.phone,
      lead.address,
      lead.score,
      lead.status,
      lead.signals.join('; '),
      lead.sourceUrl,
    ])
    const csv = [headers, ...rows]
      .map((row) => row.map((value) => csvEscape(value)).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'business-directory-leads.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="app-shell">
      <nav className="topbar" aria-label="Dashboard navigation">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <Building2 size={20} />
          </span>
          <span>LeadVault</span>
        </div>
        <div className="topbar-actions">
          <input
            ref={fileInputRef}
            className="sr-only"
            type="file"
            accept=".csv,text/csv"
            onChange={handleImport}
          />
          <button className="ghost-button" type="button" onClick={() => fileInputRef.current?.click()}>
            <UploadCloud size={17} />
            Import CSV
          </button>
          <button className="ghost-button icon-button" type="button" onClick={resetDemoData} aria-label="Reset demo data">
            <RotateCcw size={17} />
          </button>
          <button className="primary-button" type="button" onClick={exportCsv}>
            <ArrowDownToLine size={17} />
            Export CSV
          </button>
        </div>
      </nav>

      <section className="workspace-heading" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Business Directory Lead Scraper</p>
          <h1 id="page-title">Lead discovery dashboard</h1>
        </div>
        <div className="run-status" aria-label="Latest scraper run status">
          <CheckCircle2 size={18} />
          <span>{leadData.length} records loaded</span>
        </div>
      </section>

      <p className="import-status" role="status">
        {statusMessage}
      </p>

      <section className="import-history" aria-labelledby="import-history-title">
        <div className="import-history-heading">
          <History size={18} />
          <div>
            <h2 id="import-history-title">Import history</h2>
            <p>Latest backend import batches and validation counts.</p>
          </div>
        </div>

        <div className="import-history-list">
          {(importHistory ?? []).length > 0 ? (
            importHistory?.map((importRecord) => (
              <article className="import-record" key={importRecord._id}>
                <div>
                  <strong>{importRecord.fileName}</strong>
                  <span>{new Date(importRecord.createdAt).toLocaleString()}</span>
                </div>
                <dl>
                  <div>
                    <dt>Rows</dt>
                    <dd>{importRecord.rowsReceived}</dd>
                  </div>
                  <div>
                    <dt>Created</dt>
                    <dd>{importRecord.leadsCreated}</dd>
                  </div>
                  <div>
                    <dt>Duplicates</dt>
                    <dd>{importRecord.duplicatesSkipped}</dd>
                  </div>
                  <div>
                    <dt>Invalid</dt>
                    <dd>{importRecord.invalidRowsSkipped}</dd>
                  </div>
                </dl>
              </article>
            ))
          ) : (
            <p className="empty-import-history">
              {importHistory === undefined ? 'Loading import history...' : 'No CSV imports recorded yet.'}
            </p>
          )}
        </div>
      </section>

      <section className="metrics-grid" aria-label="Lead metrics">
        <article className="metric">
          <span>Visible leads</span>
          <strong>{metrics.visible}</strong>
        </article>
        <article className="metric">
          <span>Qualified</span>
          <strong>{metrics.qualified}</strong>
        </article>
        <article className="metric">
          <span>Average score</span>
          <strong>{metrics.averageScore}</strong>
        </article>
        <article className="metric">
          <span>Emails found</span>
          <strong>{metrics.emails}</strong>
        </article>
      </section>

      <section className="control-strip" aria-label="Lead filters">
        <label className="search-field">
          <Search size={18} />
          <span className="sr-only">Search leads</span>
          <input
            type="search"
            placeholder="Search company, signal, city, or email"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </label>

        <label className="select-field">
          <Filter size={17} />
          <span className="sr-only">Filter by category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>

        <label className="select-field">
          <MapPin size={17} />
          <span className="sr-only">Filter by city</span>
          <select value={city} onChange={(event) => setCity(event.target.value)}>
            {cities.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>

        <label className="score-field">
          <span>Min score</span>
          <input
            type="range"
            min="50"
            max="95"
            value={minScore}
            onChange={(event) => setMinScore(Number(event.target.value))}
          />
          <strong>{minScore}</strong>
        </label>
      </section>

      <section className="table-panel" aria-labelledby="lead-table-title">
        <div className="table-heading">
          <div>
            <h2 id="lead-table-title">Sales-ready leads</h2>
            <p>Sorted by lead score with enrichment signals from directory and website checks.</p>
          </div>
          <span>{filteredLeads.length} matches</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Lead</th>
                <th>Contact</th>
                <th>Signals</th>
                <th>Score</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <div className="lead-cell">
                      <strong>{lead.businessName}</strong>
                      <span>
                        {lead.category} / {lead.city}
                      </span>
                      <small>{lead.directory}</small>
                    </div>
                  </td>
                  <td>
                    <div className="contact-cell">
                      <span>
                        <Mail size={14} /> {lead.email || 'No email'}
                      </span>
                      <span>
                        <Phone size={14} /> {lead.phone || 'No phone'}
                      </span>
                      <span>
                        <Globe2 size={14} /> {lead.website || 'No website'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="signal-list">
                      {(lead.signals.length > 0 ? lead.signals : ['No signals yet']).map((signal) => (
                        <span key={signal}>{signal}</span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className="score-cell">
                      <strong>{lead.score}</strong>
                      <span className={`score-badge ${scoreLabel(lead.score).toLowerCase()}`}>
                        {scoreLabel(lead.score)}
                      </span>
                    </div>
                  </td>
                  <td>
                    <select
                      className="status-select"
                      value={lead.status}
                      onChange={(event) => updateLeadStatus(lead.id, event.target.value as LeadStatus)}
                    >
                      {statuses.map((status) => (
                        <option key={status}>{status}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

export default App
