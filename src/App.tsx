import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import Papa from 'papaparse'
import { z } from 'zod'
import { useMutation, useQuery } from 'convex/react'
import {
  ArrowDownToLine,
  Building2,
  CheckCircle2,
  PlayCircle,
  RotateCcw,
  Send,
  UploadCloud,
} from 'lucide-react'
import { api } from '../convex/_generated/api'
import type { Id } from '../convex/_generated/dataModel'
import { PageTabs } from './components/PageTabs'
import { demoLeads } from './data/demoLeads'
import {
  buildLeadFromRecord,
  csvEscape,
  toClientLead,
  toLeadInput,
  uniqueOptions,
} from './lib/leadHelpers'
import { LeadsPage } from './pages/LeadsPage'
import { ScraperRunsPage } from './pages/ScraperRunsPage'
import { type AppPage, type Lead, type LeadStatus, type ScraperCategory } from './types'
import './App.css'

const rowSchema = z.record(z.string(), z.unknown())
const sheetsWebhookStorageKey = 'leadvault:sheets-webhook-url'

function App() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const hasRequestedDemoSeed = useRef(false)
  const convexLeads = useQuery(api.leads.list)
  const importHistory = useQuery(api.leads.listImports)
  const scrapeRuns = useQuery(api.scrapeRuns.listRecent)
  const importLeads = useMutation(api.leads.importMany)
  const createScrapeRun = useMutation(api.scrapeRuns.create)
  const createManualScrapeRun = useMutation(api.scrapeRuns.createManualCompletedRun)
  const updateLeadStatusMutation = useMutation(api.leads.updateStatus)
  const replaceWithDemoData = useMutation(api.leads.replaceWithDemoData)
  const [searchTerm, setSearchTerm] = useState('')
  const [category, setCategory] = useState('All categories')
  const [city, setCity] = useState('All cities')
  const [minScore, setMinScore] = useState(60)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [scrapeCategory, setScrapeCategory] = useState<ScraperCategory>('dentists')
  const [scrapeLocation, setScrapeLocation] = useState('Manchester')
  const [scrapeCountryCode, setScrapeCountryCode] = useState('GB')
  const [scrapeMaxResults, setScrapeMaxResults] = useState(10)
  const [activePage, setActivePage] = useState<AppPage>('leads')
  const [sheetsWebhookUrl, setSheetsWebhookUrl] = useState(() => {
    if (typeof window === 'undefined') return import.meta.env.VITE_SHEETS_WEBHOOK_URL ?? ''
    return localStorage.getItem(sheetsWebhookStorageKey) ?? import.meta.env.VITE_SHEETS_WEBHOOK_URL ?? ''
  })

  const leadData = useMemo(() => (convexLeads ?? []).map(toClientLead), [convexLeads])
  const statusMessage =
    importMessage ??
    (activePage === 'leads'
      ? convexLeads === undefined
        ? 'Loading leads from Convex...'
        : leadData.length > 0
          ? 'Leads loaded from Convex. Import a CSV to add client leads.'
          : 'Loading demo data into Convex...'
      : scrapeRuns === undefined
        ? 'Loading scraper runs from Convex...'
        : 'Configure a source-specific scrape, queue it, then run the worker to process the next job.')

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

  useEffect(() => {
    const trimmedUrl = sheetsWebhookUrl.trim()
    if (!trimmedUrl) localStorage.removeItem(sheetsWebhookStorageKey)
    else localStorage.setItem(sheetsWebhookStorageKey, trimmedUrl)
  }, [sheetsWebhookUrl])

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

  const createFakeScrapeRun = () => {
    void createManualScrapeRun()
      .then(() => setImportMessage('Manual scrape run recorded. Worker contract panel updated.'))
      .catch((error: Error) => {
        setImportMessage(`Scrape run failed: ${error.message}`)
      })
  }

  const queueScrapeRun = () => {
    const location = scrapeLocation.trim()
    const countryCode = scrapeCountryCode.trim().toUpperCase()

    if (!location) {
      setImportMessage('Scrape run needs a city or local authority area.')
      return
    }

    if (!/^[A-Z]{2}$/.test(countryCode)) {
      setImportMessage('Use a two-letter country code, such as GB or US.')
      return
    }

    const maxResults = Math.min(50, Math.max(1, Math.floor(scrapeMaxResults)))
    void createScrapeRun({
      targetCategory: scrapeCategory,
      targetLocation: `${location}, ${countryCode}`,
      maxPages: maxResults,
    })
      .then(() => {
        setScrapeCountryCode(countryCode)
        setScrapeMaxResults(maxResults)
        setImportMessage(
          `Queued ${scrapeCategory} scrape for ${location}, ${countryCode}. Run npm run scrape:osm -- --process-next --write to process it.`,
        )
      })
      .catch((error: Error) => {
        setImportMessage(`Could not queue scrape run: ${error.message}`)
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

  const exportToSheets = async () => {
    const webhookUrl = sheetsWebhookUrl.trim()
    if (!webhookUrl) {
      setImportMessage('Sheets export needs a configured webhook URL.')
      return
    }

    if (filteredLeads.length === 0) {
      setImportMessage('Sheets export skipped because no leads match the current filters.')
      return
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      source: 'LeadVault dashboard',
      filters: {
        searchTerm,
        category,
        city,
        minScore,
      },
      count: filteredLeads.length,
      leads: filteredLeads.map((lead) => ({
        businessName: lead.businessName,
        category: lead.category,
        city: lead.city,
        directory: lead.directory,
        website: lead.website,
        email: lead.email,
        phone: lead.phone,
        address: lead.address,
        score: lead.score,
        status: lead.status,
        signals: lead.signals,
        sourceUrl: lead.sourceUrl,
      })),
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'content-type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) throw new Error(`Webhook returned ${response.status}`)
      setImportMessage(`Sent ${filteredLeads.length} leads to Google Sheets.`)
    } catch (error) {
      setImportMessage(`Sheets export failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
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
          {activePage === 'leads' ? (
            <>
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
              <button
                className="ghost-button icon-button"
                type="button"
                onClick={resetDemoData}
                aria-label="Reset demo data"
              >
                <RotateCcw size={17} />
              </button>
              <button className="primary-button" type="button" onClick={exportCsv}>
                <ArrowDownToLine size={17} />
                Export CSV
              </button>
              <button className="ghost-button" type="button" onClick={exportToSheets}>
                <Send size={17} />
                Send to Sheets
              </button>
            </>
          ) : (
            <button className="primary-button" type="button" onClick={queueScrapeRun}>
              <PlayCircle size={17} />
              Queue run
            </button>
          )}
        </div>
      </nav>

      <section className="workspace-heading" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Business Directory Lead Scraper</p>
          <h1 id="page-title">{activePage === 'leads' ? 'Lead discovery dashboard' : 'Scraper operations'}</h1>
        </div>
        <div className="run-status" aria-label="Latest scraper run status">
          <CheckCircle2 size={18} />
          <span>
            {activePage === 'leads' ? `${leadData.length} records loaded` : `${scrapeRuns?.length ?? 0} recent runs`}
          </span>
        </div>
      </section>

      <PageTabs activePage={activePage} onPageChange={setActivePage} />

      <p className="import-status" role="status">
        {statusMessage}
      </p>

      {activePage === 'leads' ? (
        <LeadsPage
          categories={categories}
          cities={cities}
          category={category}
          city={city}
          filteredLeads={filteredLeads}
          importHistory={importHistory}
          metrics={metrics}
          minScore={minScore}
          searchTerm={searchTerm}
          sheetsWebhookUrl={sheetsWebhookUrl}
          onCategoryChange={setCategory}
          onCityChange={setCity}
          onMinScoreChange={setMinScore}
          onSearchTermChange={setSearchTerm}
          onSheetsWebhookUrlChange={setSheetsWebhookUrl}
          onStatusChange={updateLeadStatus}
        />
      ) : (
        <ScraperRunsPage
          countryCode={scrapeCountryCode}
          category={scrapeCategory}
          location={scrapeLocation}
          maxResults={scrapeMaxResults}
          scrapeRuns={scrapeRuns}
          onCategoryChange={setScrapeCategory}
          onCountryCodeChange={(value) => setScrapeCountryCode(value.toUpperCase())}
          onCreateManualRun={createFakeScrapeRun}
          onLocationChange={setScrapeLocation}
          onMaxResultsChange={setScrapeMaxResults}
          onQueueRun={queueScrapeRun}
        />
      )}
    </main>
  )
}

export default App
