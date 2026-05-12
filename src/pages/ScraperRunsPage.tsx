import { Activity, PlayCircle } from 'lucide-react'
import type { Doc } from '../../convex/_generated/dataModel'
import { ScrapeRunCard } from '../components/ScrapeRunCard'
import { scraperCategories, type ScraperCategory } from '../types'

type ScraperRunsPageProps = {
  countryCode: string
  category: ScraperCategory
  location: string
  maxResults: number
  scrapeRuns: Doc<'scrapeRuns'>[] | undefined
  onCategoryChange: (category: ScraperCategory) => void
  onCountryCodeChange: (countryCode: string) => void
  onCreateManualRun: () => void
  onLocationChange: (location: string) => void
  onMaxResultsChange: (maxResults: number) => void
  onQueueRun: () => void
}

export function ScraperRunsPage({
  countryCode,
  category,
  location,
  maxResults,
  scrapeRuns,
  onCategoryChange,
  onCountryCodeChange,
  onCreateManualRun,
  onLocationChange,
  onMaxResultsChange,
  onQueueRun,
}: ScraperRunsPageProps) {
  return (
    <section className="scrape-runs" aria-labelledby="scrape-runs-title">
      <div className="scrape-runs-heading">
        <Activity size={18} />
        <div>
          <h2 id="scrape-runs-title">Scrape runs</h2>
          <p>Recent worker jobs, progress counts, and summary logs.</p>
        </div>
        <button className="ghost-button" type="button" onClick={onCreateManualRun}>
          <PlayCircle size={17} />
          Create manual run
        </button>
      </div>

      <div className="scrape-operator">
        <label>
          <span>Source</span>
          <input type="text" value="OpenStreetMap / Overpass" readOnly />
        </label>
        <label>
          <span>Category</span>
          <select value={category} onChange={(event) => onCategoryChange(event.target.value as ScraperCategory)}>
            {scraperCategories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Location</span>
          <input value={location} onChange={(event) => onLocationChange(event.target.value)} />
        </label>
        <label>
          <span>Country</span>
          <input maxLength={2} value={countryCode} onChange={(event) => onCountryCodeChange(event.target.value)} />
        </label>
        <label>
          <span>Max results</span>
          <input
            min={1}
            max={50}
            type="number"
            value={maxResults}
            onChange={(event) => onMaxResultsChange(Number(event.target.value))}
          />
        </label>
        <button className="primary-button" type="button" onClick={onQueueRun}>
          <PlayCircle size={17} />
          Queue scrape run
        </button>
        <p>Public Overpass source, capped at 50 records, no proxy rotation or bypass logic.</p>
      </div>

      <div className="scrape-run-list">
        {(scrapeRuns ?? []).length > 0 ? (
          scrapeRuns?.map((run) => <ScrapeRunCard key={run._id} run={run} />)
        ) : (
          <p className="empty-scrape-runs">
            {scrapeRuns === undefined ? 'Loading scrape runs...' : 'No scrape runs recorded yet.'}
          </p>
        )}
      </div>
    </section>
  )
}
