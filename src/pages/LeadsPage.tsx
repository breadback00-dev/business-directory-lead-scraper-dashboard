import { Filter, MapPin, Search, Send } from 'lucide-react'
import type { Doc } from '../../convex/_generated/dataModel'
import { ImportHistory } from '../components/ImportHistory'
import { LeadTable } from '../components/LeadTable'
import type { Lead, LeadStatus } from '../types'

type LeadMetrics = {
  visible: number
  qualified: number
  averageScore: number
  emails: number
}

type LeadsPageProps = {
  categories: string[]
  cities: string[]
  category: string
  city: string
  filteredLeads: Lead[]
  importHistory: Doc<'imports'>[] | undefined
  metrics: LeadMetrics
  minScore: number
  searchTerm: string
  sheetsWebhookUrl: string
  onCategoryChange: (category: string) => void
  onCityChange: (city: string) => void
  onMinScoreChange: (minScore: number) => void
  onSearchTermChange: (searchTerm: string) => void
  onSheetsWebhookUrlChange: (url: string) => void
  onStatusChange: (leadId: string, status: LeadStatus) => void
}

export function LeadsPage({
  categories,
  cities,
  category,
  city,
  filteredLeads,
  importHistory,
  metrics,
  minScore,
  searchTerm,
  sheetsWebhookUrl,
  onCategoryChange,
  onCityChange,
  onMinScoreChange,
  onSearchTermChange,
  onSheetsWebhookUrlChange,
  onStatusChange,
}: LeadsPageProps) {
  return (
    <>
      <ImportHistory imports={importHistory} />

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
          <span>Email-ready leads</span>
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
            onChange={(event) => onSearchTermChange(event.target.value)}
          />
        </label>

        <label className="select-field">
          <Filter size={17} />
          <span className="sr-only">Filter by category</span>
          <select value={category} onChange={(event) => onCategoryChange(event.target.value)}>
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>

        <label className="select-field">
          <MapPin size={17} />
          <span className="sr-only">Filter by city</span>
          <select value={city} onChange={(event) => onCityChange(event.target.value)}>
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
            onChange={(event) => onMinScoreChange(Number(event.target.value))}
          />
          <strong>{minScore}</strong>
        </label>

        <label className="webhook-field">
          <Send size={17} />
          <span className="sr-only">Google Sheets webhook URL</span>
          <input
            type="url"
            placeholder="Sheets webhook URL"
            value={sheetsWebhookUrl}
            onChange={(event) => onSheetsWebhookUrlChange(event.target.value)}
          />
        </label>
      </section>

      <LeadTable leads={filteredLeads} onStatusChange={onStatusChange} />
    </>
  )
}
